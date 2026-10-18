
import type { RoadPosition } from "./RoadPathFinder";

export interface Vehicle {
  id: string;

  // Posición lógica continua, en unidades de grid.
  x: number;
  y: number;

  speed: number; // Tiles por segundo.

  path: RoadPosition[];

  // Índice del próximo punto del recorrido.
  targetIndex: number;
}
