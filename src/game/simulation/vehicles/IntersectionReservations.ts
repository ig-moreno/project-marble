import { INTERSECTION_CONFIG as CONFIG, VEHICLE_CONFIG, VEHICLE_DIMENSIONS } from "../../../config/game/simulation";
import { sampleLane, type DirectedLane, type LaneGraph, type LanePoint } from "../road/LaneGraph";
import type { LaneVehicle } from "./Vehicle";
import { followingSpace, laneOccupancy, routeSpans, type LaneOccupancy, type RouteSpan } from "./RouteOccupancy";
import { brakingTravel } from "./Braking";

interface Reservation { predictedExit?: boolean; key: string; vehicleId: string; lane: DirectedLane; span: RouteSpan; width: number; wheelbase: number; overhang: number }
interface Request { ticket: number; reservation: Reservation }

function exitSpace(vehicle: LaneVehicle, lane: DirectedLane): number {
  const path = lane.trajectory;
  const axleSpan = path.kind === "arc" ? 2 * path.radius * Math.asin(Math.min(1, vehicle.dimensions.wheelbase / (2 * path.radius)))
    : vehicle.dimensions.wheelbase;
  return axleSpan + vehicle.dimensions.frontOverhang + vehicle.dimensions.rearOverhang
    + VEHICLE_CONFIG.minimumGapMeters + CONFIG.exitSpaceMarginMeters;
}

/** Conservative swept-path conflicts. Compatible movements can hold reservations together. */
export function movementsConflict(a: DirectedLane, b: DirectedLane, widthA: number, widthB: number,
  wheelbaseA: number = VEHICLE_DIMENSIONS.wheelbase, wheelbaseB: number = VEHICLE_DIMENSIONS.wheelbase,
  overhangA: number = VEHICLE_DIMENSIONS.frontOverhang, overhangB: number = VEHICLE_DIMENSIONS.frontOverhang): boolean {
  if (a.tileX !== b.tileX || a.tileY !== b.tileY) return false;
  // Vehicles following the identical directed movement are separated by lane
  // occupancy, not mutual exclusion of the whole intersection trajectory.
  if (a.id === b.id) return false;
  if (a.entry === b.entry || a.exit === b.exit) return true;
  function radius(lane: DirectedLane, width: number, wheelbase: number, overhang: number): number {
    const path = lane.trajectory;
    const offtracking = path.kind === "arc" ? path.radius - Math.sqrt(Math.max(0, path.radius ** 2 - (wheelbase / 2) ** 2))
      + overhang ** 2 / (2 * path.radius) : 0;
    return width / 2 + CONFIG.clearanceMeters + offtracking;
  }
  const margin = radius(a, widthA, wheelbaseA, overhangA) + radius(b, widthB, wheelbaseB, overhangB)
    + CONFIG.conflictSampleStepMeters;
  function points(lane: DirectedLane): LanePoint[] {
    const count = Math.ceil(lane.trajectory.length / CONFIG.conflictSampleStepMeters);
    return Array.from({ length: count + 1 }, (_, i) => sampleLane(lane.trajectory, lane.trajectory.length * i / count).position);
  }
  const pa = points(a), pb = points(b);
  return pa.some((p) => pb.some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= margin));
}

export class IntersectionReservations {
  private readonly held = new Map<string, Reservation>();
  private readonly waiting = new Map<string, Request>();
  private ticket = 0;
  private readonly conflictCache = new Map<string, boolean>();
  private readonly approachSpeeds = new Map<string, number>();

  public clear(): void { this.held.clear(); this.waiting.clear(); this.conflictCache.clear(); this.approachSpeeds.clear(); this.ticket = 0; }

  public approachSpeed(vehicleId: string): number { return this.approachSpeeds.get(vehicleId) ?? Infinity; }

  /** Explicit diagnostic placement inside a junction must own its movement before appearing. */
  public reserveSpawn(vehicle: LaneVehicle, graph: LaneGraph, others: readonly LaneVehicle[]): boolean {
    const spans = routeSpans(vehicle, vehicle.rearRouteDistance - vehicle.dimensions.rearOverhang,
      vehicle.traveledDistance + vehicle.dimensions.frontOverhang).filter((span) => graph.lanes.get(span.laneId)?.junction);
    const occupancy = laneOccupancy(others);
    const staged: Reservation[] = [];
    for (const span of spans) {
      const lane = graph.lanes.get(span.laneId)!;
      const reservation: Reservation = {
        key: `${vehicle.id}:${span.start}:${lane.id}`, vehicleId: vehicle.id, lane, span,
        width: vehicle.dimensions.width, wheelbase: vehicle.dimensions.wheelbase,
        overhang: Math.max(vehicle.dimensions.frontOverhang, vehicle.dimensions.rearOverhang),
      };
      if ([...this.held.values()].some((other) => this.conflicts(reservation, other))) return false;
      for (const item of occupancy) {
        const otherLane = graph.lanes.get(item.laneId)!;
        const other = others.find((candidate) => candidate.id === item.vehicleId)!;
        if (otherLane.junction && movementsConflict(lane, otherLane, vehicle.dimensions.width, other.dimensions.width,
          vehicle.dimensions.wheelbase, other.dimensions.wheelbase)) return false;
      }
      const length = exitSpace(vehicle, lane);
      if (routeSpans(vehicle, span.end + 1e-6, span.end + length).some((exit) => occupancy.some((item) => item.laneId === exit.laneId
        && item.from < length - (exit.start - span.end)))) return false;
      staged.push(reservation);
    }
    for (const reservation of staged) this.held.set(reservation.key, reservation);
    return true;
  }

  private conflicts(a: Reservation, b: Reservation): boolean {
    const key = [a.lane.id, b.lane.id, a.width, b.width, a.wheelbase, b.wheelbase, a.overhang, b.overhang].join("|");
    let result = this.conflictCache.get(key);
    if (result === undefined) {
      result = movementsConflict(a.lane, b.lane, a.width, b.width, a.wheelbase, b.wheelbase, a.overhang, b.overhang);
      this.conflictCache.set(key, result);
    }
    return result;
  }

  private guaranteedRearAdvance(vehicle: LaneVehicle, graph: LaneGraph, occupancy: readonly LaneOccupancy[]): number {
    const stoppingDistance = brakingTravel(vehicle.speed);
    if (!stoppingDistance) return 0;
    const lookahead = Math.max(CONFIG.lookaheadMeters, stoppingDistance + vehicle.dimensions.frontOverhang + CONFIG.stopMarginMeters);
    let room = followingSpace(vehicle, occupancy, lookahead, VEHICLE_CONFIG.minimumGapMeters);
    for (const span of routeSpans(vehicle, vehicle.traveledDistance, vehicle.traveledDistance + lookahead)) {
      if (!graph.lanes.get(span.laneId)?.junction || span.end <= vehicle.traveledDistance) continue;
      const key = `${vehicle.id}:${span.start}:${span.laneId}`;
      if (!this.held.has(key)) room = Math.min(room,
        span.start - vehicle.traveledDistance - vehicle.dimensions.frontOverhang - CONFIG.stopMarginMeters);
    }
    // The rear axle may lag further behind when the front axle enters a tighter curve.
    let longestAxleSpan = vehicle.dimensions.wheelbase;
    for (const path of vehicle.trajectories) {
      if (path.kind !== "arc") continue;
      if (vehicle.dimensions.wheelbase >= path.radius * 2) return 0;
      longestAxleSpan = Math.max(longestAxleSpan,
        2 * path.radius * Math.asin(vehicle.dimensions.wheelbase / (2 * path.radius)));
    }
    const extraLag = Math.max(0, longestAxleSpan - (vehicle.traveledDistance - vehicle.rearRouteDistance));
    return Math.max(0, Math.min(stoppingDistance, room) - extraLag);
  }

  private exitRemainsBlocked(vehicle: LaneVehicle, reservation: Reservation, graph: LaneGraph,
    occupancy: readonly LaneOccupancy[], byId: ReadonlyMap<string, LaneVehicle>): boolean {
    const length = exitSpace(vehicle, reservation.lane);
    return routeSpans(vehicle, reservation.span.end + 1e-6, reservation.span.end + length).some((span) => occupancy.some((item) => {
      if (item.vehicleId === vehicle.id || item.laneId !== span.laneId) return false;
      const needed = length - (span.start - reservation.span.end + item.rearOffset);
      return needed > 0 && needed > this.guaranteedRearAdvance(byId.get(item.vehicleId)!, graph, occupancy);
    }));
  }

  /** Called before any vehicle moves. Limits apply to front-axle travel this tick. */
  public limits(vehicles: readonly LaneVehicle[], graph: LaneGraph, occupancy: readonly LaneOccupancy[]): Map<string, number> {
    this.approachSpeeds.clear();
    const expectedWait = new Map<string, number>();
    const stoppedBlockers = new Set<string>();
    const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    for (const [key, reservation] of this.held) {
      const vehicle = byId.get(reservation.vehicleId);
      if (!vehicle || vehicle.rearRouteDistance - vehicle.dimensions.rearOverhang > reservation.span.end + CONFIG.clearanceMeters) this.held.delete(key);
    }
    // A forecast never permits crossing a newly blocked stop line: revalidate while approaching.
    for (const [key, reservation] of this.held) {
      const vehicle = byId.get(reservation.vehicleId)!;
      if (reservation.predictedExit && vehicle.traveledDistance + vehicle.dimensions.frontOverhang < reservation.span.start
        && this.exitRemainsBlocked(vehicle, reservation, graph, occupancy, byId)) this.held.delete(key);
    }
    const candidates: { vehicle: LaneVehicle; reservation: Reservation; distance: number }[] = [];
    for (const vehicle of vehicles) {
      for (const span of routeSpans(vehicle, vehicle.traveledDistance, vehicle.traveledDistance + CONFIG.lookaheadMeters)) {
        const lane = graph.lanes.get(span.laneId);
        if (!lane?.junction || span.end <= vehicle.traveledDistance) continue;
        const key = `${vehicle.id}:${span.start}:${lane.id}`;
        const distance = span.start - vehicle.traveledDistance - vehicle.dimensions.frontOverhang - CONFIG.stopMarginMeters;
        const reservation: Reservation = {
          key, vehicleId: vehicle.id, lane, span, width: vehicle.dimensions.width,
          wheelbase: vehicle.dimensions.wheelbase, overhang: Math.max(vehicle.dimensions.frontOverhang, vehicle.dimensions.rearOverhang),
        };
        candidates.push({ vehicle, reservation, distance });
        // Reserve just the nearest upcoming intersection, not a whole route at once.
        break;
      }
    }
    const live = new Set(candidates.map(({ reservation }) => reservation.key));
    for (const key of this.waiting.keys()) if (!live.has(key)) this.waiting.delete(key);
    candidates.sort((a, b) => a.distance - b.distance || a.vehicle.id.localeCompare(b.vehicle.id));
    for (const { vehicle, reservation, distance } of candidates) {
      const accessClear = followingSpace(vehicle, occupancy, CONFIG.lookaheadMeters, VEHICLE_CONFIG.minimumGapMeters) >= Math.max(0, distance);
      if (!accessClear) this.waiting.delete(reservation.key);
      if (accessClear && distance <= CONFIG.requestDistanceMeters && !this.held.has(reservation.key) && !this.waiting.has(reservation.key)) {
        this.waiting.set(reservation.key, { ticket: this.ticket++, reservation });
      }
    }
    for (const { reservation } of [...this.waiting.values()].sort((a, b) => a.ticket - b.ticket)) {
      const vehicle = byId.get(reservation.vehicleId)!;
      // Reserve enough downstream room for the whole vehicle, not only its front axle.
      const exitLength = exitSpace(vehicle, reservation.lane);
      const exitSpans = routeSpans(vehicle, reservation.span.end + 1e-6, reservation.span.end + exitLength);
      let wait = 0;
      reservation.predictedExit = false;
      for (const span of exitSpans) {
        for (const other of occupancy) {
          if (other.vehicleId === vehicle.id || other.laneId !== span.laneId) continue;
          const distanceToClear = exitLength - (span.start - reservation.span.end + other.rearOffset);
          if (distanceToClear <= 0) continue;
          const leader = byId.get(other.vehicleId)!;
          // Credit only travel backed by braking distance and an unobstructed corridor.
          if (this.guaranteedRearAdvance(leader, graph, occupancy) >= distanceToClear) {
            reservation.predictedExit = true;
            continue;
          }
          if (leader.cruiseSpeed <= 0) stoppedBlockers.add(reservation.key);
          wait = Math.max(wait, leader.speed > VEHICLE_CONFIG.stoppedSpeedMetersPerSecond
            ? distanceToClear / leader.speed : Infinity);
        }
      }
      for (const other of this.held.values()) {
        if (other.key === reservation.key || !this.conflicts(reservation, other)) continue;
        const owner = byId.get(other.vehicleId)!;
        if (owner.cruiseSpeed <= 0) stoppedBlockers.add(reservation.key);
        const remaining = other.span.end + CONFIG.clearanceMeters - owner.rearRouteDistance + owner.dimensions.rearOverhang;
        wait = Math.max(wait, owner.speed > VEHICLE_CONFIG.stoppedSpeedMetersPerSecond ? Math.max(0, remaining) / owner.speed : Infinity);
      }
      if (wait === 0) { this.held.set(reservation.key, reservation); this.waiting.delete(reservation.key); }
      else expectedWait.set(reservation.key, wait);
    }
    const limits = new Map<string, number>();
    for (const { vehicle, reservation, distance } of candidates) {
      if (!this.held.has(reservation.key)) {
        limits.set(vehicle.id, Math.max(0, distance));
        const wait = expectedWait.get(reservation.key);
        // Advisory only: never use a prediction as permission to enter an occupied exit.
        if (wait !== undefined && !stoppedBlockers.has(reservation.key)) {
          const approachTime = Number.isFinite(wait) ? wait + CONFIG.approachTimeBufferSeconds
            : CONFIG.unknownClearanceApproachSeconds;
          this.approachSpeeds.set(vehicle.id, Math.max(0, distance) / approachTime);
        }
      }
    }
    return limits;
  }

  public getActiveMovements(): { vehicleId: string; laneId: string }[] {
    return [...this.held.values()].map((item) => ({ vehicleId: item.vehicleId, laneId: item.lane.id }));
  }
}
