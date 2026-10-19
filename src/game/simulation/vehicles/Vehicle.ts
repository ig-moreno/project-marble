
import type { RoadPosition } from "./RoadPathFinder";
import { VEHICLE_DIMENSIONS } from "../../../config/game/simulation";
import type { LanePoint, LaneTrajectory } from "../road/LaneGraph";

export interface LegacyVehicle {
  kind: "legacy";
  id: string;

  // Posición lógica continua, en unidades de grid.
  x: number;
  y: number;

  speed: number; // Tiles por segundo.

  path: RoadPosition[];

  // Índice del próximo punto del recorrido.
  targetIndex: number;
}

export interface LaneVehicle {
  kind: "lane";
  id: string;
  position: LanePoint;
  tangent: LanePoint;
  frontAxle: LanePoint;
  rearAxle: LanePoint;
  dimensions: VehicleDimensions;
  traveledDistance: number; // Distance travelled by the front axle along the route.
  rearRouteDistance: number;
  laneIds: string[];
  cruiseSpeed: number;
  restartDelay: number; // Physical seconds remaining before a stopped follower reacts.
  loop: boolean;
  routeLength: number;
  completedLaps: number;
  color?: string;
  speed: number; // Physical metres per second, independent of the city clock.
  trajectories: LaneTrajectory[];
  trajectoryIndex: number;
  distance: number;
}

export interface VehicleDimensions {
  wheelbase: number;
  frontOverhang: number;
  rearOverhang: number;
  width: number;
  height: number;
}

export const DEFAULT_VEHICLE_DIMENSIONS: VehicleDimensions = VEHICLE_DIMENSIONS;

export type Vehicle = LegacyVehicle | LaneVehicle;
