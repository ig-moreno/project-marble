export type RoadDirection = "north" | "east" | "south" | "west";

export type RoadConnections = Record<RoadDirection, boolean>;

export type RoadShape =
  | "isolated"
  | "end"
  | "straight"
  | "corner"
  | "t-junction"
  | "cross";

export function emptyRoadConnections(): RoadConnections {
  return {
    north: false,
    east: false,
    south: false,
    west: false,
  };
}