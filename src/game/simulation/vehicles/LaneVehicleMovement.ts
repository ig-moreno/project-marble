import { sampleLane } from "../road/LaneGraph";
import { AXLE_SOLVER_CONFIG } from "../../../config/game/simulation";
import type { LaneVehicle } from "./Vehicle";

function routePosition(vehicle: LaneVehicle, distance: number) {
  if (vehicle.loop) distance = ((distance % vehicle.routeLength) + vehicle.routeLength) % vehicle.routeLength;
  const first = sampleLane(vehicle.trajectories[0], 0);
  // At spawn the rear axle is still approaching the route's first point.
  if (distance < 0) return {
    x: first.position.x + first.tangent.x * distance,
    y: first.position.y + first.tangent.y * distance,
  };
  for (const path of vehicle.trajectories) {
    if (distance <= path.length) return sampleLane(path, distance).position;
    distance -= path.length;
  }
  const last = vehicle.trajectories[vehicle.trajectories.length - 1];
  return sampleLane(last, last.length).position;
}

/** Both axle centres lie on the route, separated by the rigid wheelbase.
 * A fixed arc-distance offset would incorrectly shorten the wheelbase in curves. */
export function updateLaneVehiclePose(vehicle: LaneVehicle): void {
  const front = routePosition(vehicle, vehicle.traveledDistance);
  const wheelbase = vehicle.dimensions.wheelbase;
  const separation = (behind: number) => {
    const rear = routePosition(vehicle, vehicle.traveledDistance - behind);
    return Math.hypot(front.x - rear.x, front.y - rear.y);
  };
  const step = Math.min(AXLE_SOLVER_CONFIG.maxSearchStepMeters, wheelbase / AXLE_SOLVER_CONFIG.stepsPerWheelbase);
  let near = 0, far = step;
  while (separation(far) < wheelbase) { near = far; far += step; }
  for (let i = 0; i < AXLE_SOLVER_CONFIG.bisectionIterations; i++) {
    const middle = (near + far) / 2;
    if (separation(middle) < wheelbase) near = middle;
    else far = middle;
  }
  const rear = routePosition(vehicle, vehicle.traveledDistance - (near + far) / 2);
  vehicle.rearRouteDistance = vehicle.traveledDistance - (near + far) / 2;
  const tangent = { x: (front.x - rear.x) / wheelbase, y: (front.y - rear.y) / wheelbase };
  const offset = (vehicle.dimensions.frontOverhang - vehicle.dimensions.rearOverhang) / 2;
  vehicle.frontAxle = front;
  vehicle.rearAxle = rear;
  vehicle.tangent = tangent;
  vehicle.position = {
    x: (front.x + rear.x) / 2 + tangent.x * offset,
    y: (front.y + rear.y) / 2 + tangent.y * offset,
  };
}

/** Advances physical distance, preserving any remaining distance across lane boundaries.
 * Returns true on arrival. This does not implement traffic permissions or collisions. */
export function advanceLaneVehicle(vehicle: LaneVehicle, deltaTime: number): boolean {
  let remaining = vehicle.speed * Math.max(0, deltaTime);
  while (vehicle.trajectoryIndex < vehicle.trajectories.length) {
    const path = vehicle.trajectories[vehicle.trajectoryIndex];
    const step = Math.min(remaining, path.length - vehicle.distance);
    vehicle.distance += step;
    vehicle.traveledDistance += step;
    remaining -= step;
    if (vehicle.distance < path.length) break;
    vehicle.trajectoryIndex++;
    vehicle.distance = 0;
    if (vehicle.loop && vehicle.trajectoryIndex === vehicle.trajectories.length) {
      vehicle.trajectoryIndex = 0;
      vehicle.completedLaps++;
    }
    if (remaining <= 0) break;
  }
  updateLaneVehiclePose(vehicle);
  return !vehicle.loop && vehicle.trajectoryIndex >= vehicle.trajectories.length;
}
