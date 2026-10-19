import type { LaneVehicle } from "./Vehicle";

export interface RouteSpan { laneId: string; index: number; start: number; end: number }
export interface LaneOccupancy {
  vehicleId: string; laneId: string; from: number; to: number;
  rearOffset: number; // Unclipped rear-bumper coordinate, including when it is in a previous lane.
  speed: number;
}

/** Absolute distances retain lap history; only the route spans wrap. */
export function routeSpans(vehicle: LaneVehicle, from: number, to: number): RouteSpan[] {
  const result: RouteSpan[] = [];
  const first = vehicle.loop ? Math.floor(from / vehicle.routeLength) : 0;
  const last = vehicle.loop ? Math.floor(to / vehicle.routeLength) : 0;
  for (let lap = first; lap <= last; lap++) {
    let start = lap * vehicle.routeLength;
    for (let i = 0; i < vehicle.laneIds.length; i++) {
      const end = start + vehicle.trajectories[i].length;
      if (end >= from && start <= to) result.push({ laneId: vehicle.laneIds[i], index: i, start, end });
      start = end;
    }
  }
  return result;
}

export function laneOccupancy(vehicles: readonly LaneVehicle[]): LaneOccupancy[] {
  return vehicles.flatMap((vehicle) => {
    const rear = vehicle.rearRouteDistance - vehicle.dimensions.rearOverhang;
    const front = vehicle.traveledDistance + vehicle.dimensions.frontOverhang;
    return routeSpans(vehicle, rear, front).map((span) => ({
      vehicleId: vehicle.id, laneId: span.laneId,
      from: Math.max(rear, span.start) - span.start,
      to: Math.min(front, span.end) - span.start,
      rearOffset: rear - span.start,
      speed: vehicle.speed,
    }));
  });
}

/** Space ahead on shared directed lanes, even for different routes and across the lap seam. */
export function followingSpace(vehicle: LaneVehicle, occupancy: readonly LaneOccupancy[], lookahead: number, gap: number): number {
  return followingConstraint(vehicle, occupancy, lookahead, gap).distance;
}

export function followingConstraint(vehicle: LaneVehicle, occupancy: readonly LaneOccupancy[], lookahead: number, gap: number): { distance: number; leaderSpeed: number } {
  let space = Infinity;
  let leaderSpeed = 0;
  for (const span of routeSpans(vehicle, vehicle.traveledDistance, vehicle.traveledDistance + lookahead)) {
    for (const other of occupancy) {
      if (other.vehicleId === vehicle.id || other.laneId !== span.laneId) continue;
      if (span.start + other.to <= vehicle.traveledDistance) continue;
      const distance = span.start + other.rearOffset - vehicle.traveledDistance - vehicle.dimensions.frontOverhang - gap;
      if (distance < space) { space = distance; leaderSpeed = other.speed; }
    }
  }
  return { distance: space, leaderSpeed };
}
