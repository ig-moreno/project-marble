
import type { GridManager } from "../GridManager";

export interface RoadPosition {
  x: number;
  y: number;
}

const DIRECTIONS = [
  { key: "north", dx: 0, dy: -1, opposite: "south" },
  { key: "east", dx: 1, dy: 0, opposite: "west" },
  { key: "south", dx: 0, dy: 1, opposite: "north" },
  { key: "west", dx: -1, dy: 0, opposite: "east" },
] as const;

function key(position: RoadPosition): string {
  return `${position.x},${position.y}`;
}

export function getConnectedRoadNeighbors(
  grid: GridManager,
  position: RoadPosition,
): RoadPosition[] {
  const tile = grid.getTile(position.x, position.y);

  if (!tile || tile.type !== "road") {
    return [];
  }

  const neighbors: RoadPosition[] = [];

  for (const direction of DIRECTIONS) {
    if (!tile.roadConnections[direction.key]) {
      continue;
    }

    const x = position.x + direction.dx;
    const y = position.y + direction.dy;

    const neighbor = grid.getTile(x, y);

    if (
      neighbor?.type === "road" &&
      neighbor.roadConnections[direction.opposite]
    ) {
      neighbors.push({ x, y });
    }
  }

  return neighbors;
}

export function findRoadPath(
  grid: GridManager,
  start: RoadPosition,
  end: RoadPosition,
): RoadPosition[] | null {
  if (
    grid.getTile(start.x, start.y)?.type !== "road" ||
    grid.getTile(end.x, end.y)?.type !== "road"
  ) {
    return null;
  }

  const queue: RoadPosition[] = [start];
  const visited = new Set<string>([key(start)]);
  const previous = new Map<string, RoadPosition>();

  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];

    if (
      current.x === end.x &&
      current.y === end.y
    ) {
      const path: RoadPosition[] = [current];
      let cursor = current;

      while (key(cursor) !== key(start)) {
        const parent = previous.get(key(cursor));

        if (!parent) return null;

        path.unshift(parent);
        cursor = parent;
      }

      return path;
    }

    for (const neighbor of getConnectedRoadNeighbors(
      grid,
      current,
    )) {
      const neighborKey = key(neighbor);

      if (visited.has(neighborKey)) continue;

      visited.add(neighborKey);
      previous.set(neighborKey, current);
      queue.push(neighbor);
    }
  }

  return null;
}
