import type { LaneGraph } from "./LaneGraph";

export interface LaneRoute { laneIds: string[]; length: number; loop?: boolean }

/** Closed route through explicit movements. The closing link is validated, not teleported. */
export function findCircularLaneRoute(graph: LaneGraph, waypoints: readonly string[]): LaneRoute | null {
  if (waypoints.length < 2) return null;
  const laneIds: string[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    const part = findLaneRoute(graph, waypoints[i], waypoints[(i + 1) % waypoints.length]);
    if (!part || part.laneIds.length < 2) return null;
    laneIds.push(...part.laneIds.slice(0, -1));
  }
  return { laneIds, length: laneIds.reduce((sum, id) => sum + graph.lanes.get(id)!.trajectory.length, 0), loop: true };
}

/** Shortest complete-lane route in metres. A route does not grant permission to move. */
export function findLaneRoute(graph: LaneGraph, startId: string, endId: string): LaneRoute | null {
  const start = graph.lanes.get(startId);
  if (!start || !graph.lanes.has(endId)) return null;
  const distances = new Map([[startId, start.trajectory.length]]);
  const previous = new Map<string, string>();
  const pending = new Set([startId]);
  const visited = new Set<string>();
  // The current map is small: a simple Dijkstra avoids a separate queue abstraction.
  while (pending.size) {
    let current = [...pending][0];
    for (const id of pending) if (distances.get(id)! < distances.get(current)!) current = id;
    pending.delete(current);
    if (current === endId) {
      const laneIds = [current];
      while (previous.has(laneIds[0])) laneIds.unshift(previous.get(laneIds[0])!);
      return { laneIds, length: distances.get(current)! };
    }
    visited.add(current);
    for (const nextId of graph.lanes.get(current)!.nextLaneIds) {
      const next = graph.lanes.get(nextId);
      if (!next || visited.has(nextId)) continue;
      const distance = distances.get(current)! + next.trajectory.length;
      if (distance < (distances.get(nextId) ?? Infinity)) {
        distances.set(nextId, distance);
        previous.set(nextId, current);
        pending.add(nextId);
      }
    }
  }
  return null;
}
