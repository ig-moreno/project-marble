
import type { RoadConnections } from "./road/types";
import { emptyRoadConnections } from "./road/types";

export type TileType =
  | "empty"
  | "road"
  | "house"
  | "factory"
  | "forest"
  | "mineral";

interface BaseTile {
  x: number;
  y: number;
  occupantId: string | null;
}

export interface RoadTile extends BaseTile {
  type: "road";
  roadConnections: RoadConnections;
}

export interface GenericTile extends BaseTile {
  type: Exclude<TileType, "road">;
}

export type Tile = RoadTile | GenericTile;

export function createTile(
  x: number,
  y: number,
  type: TileType,
): Tile {
  const base = {
    x,
    y,
    occupantId: null,
  };

  if (type === "road") {
    return {
      ...base,
      type: "road",
      roadConnections: emptyRoadConnections(),
    };
  }

  return {
    ...base,
    type,
  };
}

