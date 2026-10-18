
import type { GridManager } from "../GridManager";
import { emptyRoadConnections, type RoadShape, type RoadDirection } from "./types";

export interface RoadGeometry {
  shape: RoadShape;
  rotation: number;
}

export function getRoadGeometry(
  grid: GridManager,
  x: number,
  y: number,
): RoadGeometry {
  const tile = grid.getTile(x, y);

  if (!tile || tile.type !== "road") {
    return { shape: "isolated", rotation: 0 };
  }

  const { north, east, south, west } = tile.roadConnections;
  const count = [north, east, south, west].filter(Boolean).length;

  if (count === 0) {
    return { shape: "isolated", rotation: 0 };
  }

  if (count === 1) {
    return {
      shape: "end",
      rotation: north ? 0 : west ? 90 : south ? 180 : 270,
    };
  }

  if (count === 2) {
    if (north && south) {
      return { shape: "straight", rotation: 0 };
    }

    if (east && west) {
      return { shape: "straight", rotation: 90 };
    }

    return {
      shape: "corner",
      rotation:
        north && east ? 0 :
        north && west ? 90 :
        south && west ? 180 : 270,
    };
  }

  if (count === 3) {
    return {
      shape: "t-junction",
      rotation:
        !south ? 0 :
        !east ? 90 :
        !north ? 180 : 270,
    };
  }

  return { shape: "cross", rotation: 0 };
}


export function connectRoads(
  grid: GridManager,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const a = grid.getTile(ax, ay);
  const b = grid.getTile(bx, by);

  if (!a || !b) return false;
  if (a.type !== "road" || b.type !== "road") return false;

  const dx = bx - ax;
  const dy = by - ay;

  let directionA: RoadDirection;
  let directionB: RoadDirection;

  if (dx === 1 && dy === 0) {
    directionA = "east";
    directionB = "west";
  } else if (dx === -1 && dy === 0) {
    directionA = "west";
    directionB = "east";
  } else if (dx === 0 && dy === 1) {
    directionA = "south";
    directionB = "north";
  } else if (dx === 0 && dy === -1) {
    directionA = "north";
    directionB = "south";
  } else {
    return false;
  }

  a.roadConnections[directionA] = true;
  b.roadConnections[directionB] = true;

  return true;
}

export function disconnectRoad(
  grid: GridManager,
  x: number,
  y: number,
): boolean {
  const tile = grid.getTile(x, y);

  if (!tile || tile.type !== "road") return false;

  const neighbors = [
    { x, y: y - 1, opposite: "south" },
    { x: x + 1, y, opposite: "west" },
    { x, y: y + 1, opposite: "north" },
    { x: x - 1, y, opposite: "east" },
  ] as const;

  for (const neighbor of neighbors) {
    const other = grid.getTile(neighbor.x, neighbor.y);

    if (other?.type === "road") {
      other.roadConnections[neighbor.opposite] = false;
    }
  }

  tile.roadConnections = emptyRoadConnections();

  return true;
}


