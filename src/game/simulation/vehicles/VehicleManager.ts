import { VEHICLE_CONFIG, INTERSECTION_CONFIG } from "../../../config/game/simulation";
import { laneOccupancy, followingConstraint, routeSpans } from "./RouteOccupancy";
import { safeFollowingSpeed } from "./Braking";
import { IntersectionReservations } from "./IntersectionReservations";


import type { GridManager } from "../GridManager";

import type { Vehicle, LegacyVehicle, LaneVehicle } from "./Vehicle";
import { DEFAULT_VEHICLE_DIMENSIONS, type VehicleDimensions } from "./Vehicle";
import { sampleLane, type LaneGraph } from "../road/LaneGraph";
import type { LaneRoute } from "../road/LanePathFinder";
import { advanceLaneVehicle, updateLaneVehiclePose } from "./LaneVehicleMovement";
import {
  findRoadPath,
  type RoadPosition,
} from "./RoadPathFinder";

import type {
  VehicleArrivedEvent,
  VehicleArrivedListener,
} from "./VehicleEvents";

export class VehicleManager {
  public static readonly minimumGap = VEHICLE_CONFIG.minimumGapMeters;
  public static readonly queueReactionTime = VEHICLE_CONFIG.queueReactionTimeSeconds;
  private readonly vehicles = new Map<string, Vehicle> ();
  private readonly arrivalListeners = new Set<VehicleArrivedListener> ();
  private nextId = 1;
  private laneGraph: LaneGraph | null = null;
  private readonly intersections = new IntersectionReservations();

  constructor(private readonly grid: GridManager) {}

  createVehicle(
    start: RoadPosition,
    destination: RoadPosition,
  ): LegacyVehicle | null {
    const path = findRoadPath(
      this.grid,
      start,
      destination,
    );

    if (!path || path.length < 2) {
      return null;
    }

    const vehicle: LegacyVehicle = {
      kind: "legacy",
      id: `vehicle-${this.nextId++}`,
      x: start.x,
      y: start.y,
      speed: VEHICLE_CONFIG.legacySpeedTilesPerSecond,
      path,
      targetIndex: 1,
    };

    this.vehicles.set(vehicle.id, vehicle);

    return vehicle;
  }

  update(deltaTime: number): void {
    // Snapshot occupancy before moving anyone: results do not depend on map iteration order.
    const laneVehicles = [...this.vehicles.values()].filter((vehicle): vehicle is LaneVehicle => vehicle.kind === "lane");
    const occupancy = laneOccupancy(laneVehicles);
    const intersectionLimits = this.laneGraph ? this.intersections.limits(laneVehicles, this.laneGraph, occupancy) : new Map<string, number>();
    for (const vehicle of this.vehicles.values()) {
      if (vehicle.kind === "lane") {
        const lookahead = Math.max(INTERSECTION_CONFIG.lookaheadMeters,
          vehicle.speed ** 2 / (2 * VEHICLE_CONFIG.brakingMetersPerSecondSquared) + vehicle.speed * Math.max(0, deltaTime)
            + VehicleManager.minimumGap + vehicle.dimensions.frontOverhang);
        const following = followingConstraint(vehicle, occupancy, lookahead, VehicleManager.minimumGap);
        const intersectionSpace = intersectionLimits.get(vehicle.id) ?? Infinity;
        const available = Math.min(following.distance, intersectionSpace);
        let dt = Math.max(0, deltaTime);
        // Only stopped followers acquire a reaction delay. Braking remains immediate,
        // and the first vehicle is free to start as soon as instructed.
        if (vehicle.speed < VEHICLE_CONFIG.stoppedSpeedMetersPerSecond && available <= VEHICLE_CONFIG.restartClearanceMeters && vehicle.cruiseSpeed > 0) {
          vehicle.restartDelay = VehicleManager.queueReactionTime;
          vehicle.speed = 0;
          dt = 0;
        } else if (vehicle.restartDelay > 0) {
          const waiting = Math.min(dt, vehicle.restartDelay);
          vehicle.restartDelay -= waiting;
          dt -= waiting;
        }
        const targetSpeed = Math.min(vehicle.cruiseSpeed, this.intersections.approachSpeed(vehicle.id),
          safeFollowingSpeed(following.distance, following.leaderSpeed),
          Math.sqrt(2 * VEHICLE_CONFIG.brakingMetersPerSecondSquared * Math.max(0, intersectionSpace)));
        const speed = vehicle.speed < targetSpeed ? Math.min(targetSpeed, vehicle.speed + VEHICLE_CONFIG.accelerationMetersPerSecondSquared * dt)
          : Math.max(targetSpeed, vehicle.speed - VEHICLE_CONFIG.brakingMetersPerSecondSquared * dt);
        // Reserve space before advancing; never correct an overlap after moving.
        vehicle.speed = Math.max(0, Math.min(speed, dt > 0 ? Math.max(0, available) / dt : speed));
        if (advanceLaneVehicle(vehicle, dt)) {
          this.vehicles.delete(vehicle.id);
          this.notifyVehicleArrived(vehicle.id);
        }
      } else this.updateVehicle(vehicle, deltaTime);
    }
  }

  createLaneVehicle(graph: LaneGraph, route: LaneRoute, speed: number = VEHICLE_CONFIG.cruiseSpeedMetersPerSecond, dimensions: VehicleDimensions = DEFAULT_VEHICLE_DIMENSIONS, initialDistance = 0, reserveInitialJunction = false): LaneVehicle | null {
    if (!Number.isFinite(speed) || speed <= 0 || !route.laneIds.length) return null;
    if (Object.values(dimensions).some((value) => !Number.isFinite(value) || value < 0)
      || dimensions.wheelbase <= 0 || dimensions.width <= 0 || dimensions.height <= 0) return null;
    const lanes = route.laneIds.map((id) => graph.lanes.get(id));
    if (lanes.some((lane) => !lane)) return null;
    for (let i = 1; i < lanes.length; i++) {
      if (!lanes[i - 1]!.nextLaneIds.includes(lanes[i]!.id)) return null;
    }
    if (route.loop && !lanes[lanes.length - 1]!.nextLaneIds.includes(lanes[0]!.id)) return null;
    const trajectories = lanes.map((lane) => lane!.trajectory);
    const length = trajectories.reduce((sum, path) => sum + path.length, 0);
    if (!Number.isFinite(initialDistance) || initialDistance < 0 || initialDistance >= length) return null;
    const sample = sampleLane(trajectories[0], 0);
    const vehicle: LaneVehicle = {
      kind: "lane", id: `vehicle-${this.nextId++}`, speed, trajectories,
      trajectoryIndex: 0, distance: 0, position: sample.position, tangent: sample.tangent,
      frontAxle: sample.position, rearAxle: sample.position,
      traveledDistance: 0, dimensions: { ...dimensions },
      rearRouteDistance: 0, laneIds: [...route.laneIds], cruiseSpeed: speed,
      restartDelay: 0,
      loop: route.loop ?? false, routeLength: length, completedLaps: 0,
    };
    if (vehicle.loop && trajectories.some((path) => path.kind === "arc" && dimensions.wheelbase >= path.radius * 2)) return null;
    updateLaneVehiclePose(vehicle);
    if (initialDistance) advanceLaneVehicle(vehicle, initialDistance / speed);
    // Do not introduce a test vehicle halfway through an unreserved junction.
    if (routeSpans(vehicle, vehicle.rearRouteDistance - dimensions.rearOverhang,
      vehicle.traveledDistance + dimensions.frontOverhang).some((span) => graph.lanes.get(span.laneId)?.junction) && !reserveInitialJunction) return null;
    const existing = [...this.vehicles.values()].filter((other): other is LaneVehicle => other.kind === "lane");
    const existingOccupancy = laneOccupancy(existing);
    const introduced = laneOccupancy([vehicle]);
    if (introduced.some((item) => existingOccupancy.some((other) => item.laneId === other.laneId
      && item.from < other.to + VehicleManager.minimumGap && other.from < item.to + VehicleManager.minimumGap))) return null;
    const rear = vehicle.rearRouteDistance - vehicle.dimensions.rearOverhang;
    const front = vehicle.traveledDistance + vehicle.dimensions.frontOverhang;
    for (const other of this.vehicles.values()) {
      if (other.kind !== "lane" || other.laneIds.join("|") !== route.laneIds.join("|")) continue;
      const otherRear = other.rearRouteDistance - other.dimensions.rearOverhang;
      const otherFront = other.traveledDistance + other.dimensions.frontOverhang;
      if (!(front + VehicleManager.minimumGap <= otherRear || otherFront + VehicleManager.minimumGap <= rear)) return null;
    }
    if (reserveInitialJunction && !this.intersections.reserveSpawn(vehicle, graph, existing)) return null;
    this.vehicles.set(vehicle.id, vehicle);
    this.laneGraph = graph;
    return vehicle;
  }

  private updateVehicle(
    vehicle: LegacyVehicle,
    deltaTime: number,
  ): void {
    let remainingDistance = vehicle.speed * deltaTime;

    while (
      remainingDistance > 0 &&
      vehicle.targetIndex < vehicle.path.length
    ) {
      const target = vehicle.path[vehicle.targetIndex];

      const dx = target.x - vehicle.x;
      const dy = target.y - vehicle.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= remainingDistance) {
        vehicle.x = target.x;
        vehicle.y = target.y;

        remainingDistance -= distance;
        vehicle.targetIndex++;
      } else {
        const ratio = remainingDistance / distance;

        vehicle.x += dx * ratio;
        vehicle.y += dy * ratio;

        remainingDistance = 0;
      }
    }

    if (vehicle.targetIndex >= vehicle.path.length) {
      this.vehicles.delete(vehicle.id);
      this.notifyVehicleArrived(vehicle.id);
      return;
    }
  }

  getVehicles(): readonly Vehicle[] {
    return [...this.vehicles.values()];
  }

  
  public onVehicleArrived(
    listener: VehicleArrivedListener,
  ): () => void {
    this.arrivalListeners.add(listener);

    return () => {
      this.arrivalListeners.delete(listener);
    };
  }

  private notifyVehicleArrived(
    vehicleId: string,
  ): void {
    console.log(
      "[VehicleManager] VehicleArrived:",
      vehicleId,
    );

    const event: VehicleArrivedEvent = {
      vehicleId,
    };

    for (const listener of this.arrivalListeners) {
      listener(event);
    }
  }
  public removeVehicleForTest(
    vehicleId: string,
  ): void {
    this.vehicles.delete(vehicleId);
  }


  clear(): void {
    this.vehicles.clear();
    this.intersections.clear();
    this.laneGraph = null;
  }

  getIntersectionReservations(): { vehicleId: string; laneId: string }[] {
    return this.intersections.getActiveMovements();
  }
}
