import type { GridManager } from "../GridManager";
import { TILE_SIZE, ROAD_END_LENGTH, LANE_WIDTH } from "../../../config/game/world";
import { getRoadGeometry } from "./RoadUtils";
import type { RoadDirection } from "./types";

export { LANE_WIDTH } from "../../../config/game/world";

/** Metres in the logical ground plane: x east, y south; tile (0,0) is centred at (0,0).
 * The renderer's grid offset is a translation, not part of the simulation. */
export interface LanePoint { x: number; y: number }

export type LaneTrajectory =
  | { kind: "line"; start: LanePoint; end: LanePoint; length: number }
  | { kind: "arc"; center: LanePoint; radius: number; startAngle: number; sweep: number; length: number };

export interface DirectedLane {
  id: string;
  tileX: number;
  tileY: number;
  /** Null denotes the closed asphalt edge, not a connection to another tile. */
  entry: RoadDirection | null;
  exit: RoadDirection | null;
  trajectory: LaneTrajectory;
  movement: "straight" | "left" | "right" | "terminal";
  junction: boolean;
  /** Alternative movements in the next tile. These links confer no right of way. */
  nextLaneIds: string[];
}

export interface LaneGraph { lanes: ReadonlyMap<string, DirectedLane> }

const directions: Record<RoadDirection, LanePoint & { opposite: RoadDirection }> = {
  north: { x: 0, y: -1, opposite: "south" },
  east: { x: 1, y: 0, opposite: "west" },
  south: { x: 0, y: 1, opposite: "north" },
  west: { x: -1, y: 0, opposite: "east" },
};
const sides = Object.keys(directions) as RoadDirection[];
const laneId = (x: number, y: number, entry: RoadDirection | null) => `${x},${y}:${entry ?? "terminal"}`;

function port(x: number, y: number, side: RoadDirection, entering: boolean): LanePoint {
  const outward = directions[side];
  const sign = entering ? -1 : 1;
  // Logical (x,y) maps to Babylon (x,z). From above (+world Y), the right
  // of travel is up × forward = (dy, -dx), independent of camera rotation.
  return {
    x: x * TILE_SIZE + outward.x * TILE_SIZE / 2 + outward.y * sign * LANE_WIDTH / 2,
    y: y * TILE_SIZE + outward.y * TILE_SIZE / 2 - outward.x * sign * LANE_WIDTH / 2,
  };
}

function trajectory(x: number, y: number, entry: RoadDirection, exit: RoadDirection): LaneTrajectory {
  const start = port(x, y, entry, true);
  const end = port(x, y, exit, false);
  const a = directions[entry];
  const b = directions[exit];
  if (a.opposite === exit) {
    return { kind: "line", start, end, length: TILE_SIZE };
  }
  // Same corner centre and radii as the existing road surface, offset by half a lane.
  const center = {
    x: x * TILE_SIZE + (a.x + b.x) * TILE_SIZE / 2,
    y: y * TILE_SIZE + (a.y + b.y) * TILE_SIZE / 2,
  };
  const radius = Math.hypot(start.x - center.x, start.y - center.y);
  const sweep = Math.sign(-a.x * b.y + a.y * b.x) * Math.PI / 2;
  return {
    kind: "arc", center, radius, sweep,
    startAngle: Math.atan2(start.y - center.y, start.x - center.x),
    length: radius * Math.abs(sweep),
  };
}

/** Sample by physical distance in metres; tangent is a unit travel direction. */
export function sampleLane(path: LaneTrajectory, distance: number): { position: LanePoint; tangent: LanePoint } {
  const t = Math.max(0, Math.min(path.length, distance)) / path.length;
  if (path.kind === "line") {
    return {
      position: { x: path.start.x + (path.end.x - path.start.x) * t, y: path.start.y + (path.end.y - path.start.y) * t },
      tangent: { x: (path.end.x - path.start.x) / path.length, y: (path.end.y - path.start.y) / path.length },
    };
  }
  const angle = path.startAngle + path.sweep * t;
  const sign = Math.sign(path.sweep);
  return {
    position: { x: path.center.x + Math.cos(angle) * path.radius, y: path.center.y + Math.sin(angle) * path.radius },
    tangent: { x: -Math.sin(angle) * sign, y: Math.cos(angle) * sign },
  };
}

/** Rebuild explicit movements, without U-turns, priorities or permission to enter a junction.
 * Junction trajectories share access ports; they are alternatives, not extra physical lanes. */
export function buildLaneGraph(grid: GridManager): LaneGraph {
  const lanes = new Map<string, DirectedLane>();
  for (const tile of grid.tiles()) {
    if (tile.type !== "road") continue;
    const shape = getRoadGeometry(grid, tile.x, tile.y).shape;
    if (shape === "isolated") continue;
    const connected = sides.filter((side) => tile.roadConnections[side]);
    if (shape === "end") {
      const side = connected[0];
      const outward = directions[side];
      // The existing end surface extends 8 m from its connected tile boundary.
      for (const entering of [true, false]) {
        const boundary = port(tile.x, tile.y, side, entering);
        const terminal = {
          x: boundary.x - outward.x * ROAD_END_LENGTH,
          y: boundary.y - outward.y * ROAD_END_LENGTH,
        };
        const entry = entering ? side : null;
        const id = laneId(tile.x, tile.y, entry);
        lanes.set(id, {
          id, tileX: tile.x, tileY: tile.y, entry, exit: entering ? null : side,
          trajectory: {
            kind: "line", start: entering ? boundary : terminal,
            end: entering ? terminal : boundary, length: ROAD_END_LENGTH,
          },
          movement: "terminal", junction: false, nextLaneIds: [],
        });
      }
      continue;
    }
    for (const entry of connected) {
      for (const exit of connected.filter((side) => side !== entry)) {
        const baseId = laneId(tile.x, tile.y, entry);
        const id = connected.length > 2 ? `${baseId}->${exit}` : baseId;
        const path = trajectory(tile.x, tile.y, entry, exit);
        lanes.set(id, {
          id, tileX: tile.x, tileY: tile.y, entry, exit,
          trajectory: path,
          movement: path.kind === "line" ? "straight" : path.sweep < 0 ? "right" : "left",
          junction: connected.length > 2,
          nextLaneIds: [],
        });
      }
    }
  }
  const entries = new Map<string, DirectedLane[]>();
  for (const lane of lanes.values()) {
    if (lane.entry === null) continue;
    const key = laneId(lane.tileX, lane.tileY, lane.entry);
    const alternatives = entries.get(key) ?? [];
    alternatives.push(lane);
    entries.set(key, alternatives);
  }
  for (const lane of lanes.values()) {
    if (lane.exit === null) continue;
    const direction = directions[lane.exit];
    const x = lane.tileX + direction.x;
    const y = lane.tileY + direction.y;
    const neighbor = grid.getTile(x, y);
    if (neighbor?.type !== "road" || !neighbor.roadConnections[direction.opposite]) continue;
    lane.nextLaneIds = (entries.get(laneId(x, y, direction.opposite)) ?? []).map((next) => next.id);
  }
  return { lanes };
}
