import { Vector3 } from "babylonjs";
import { TILE_SIZE } from "../../config/world";

export function gridToWorld(
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number,
): Vector3 {
  const offsetX = gridWidth % 2 === 0 ? 0.5 : 0;
  const offsetY = gridHeight % 2 === 0 ? 0.5 : 0;

  return new Vector3(
    (x + offsetX) * TILE_SIZE,
    0,
    (y + offsetY) * TILE_SIZE,
  );
}

export function worldToGrid(
  worldX: number,
  worldZ: number,
  gridWidth: number,
  gridHeight: number,
): { x: number; y: number } {
  const offsetX = gridWidth % 2 === 0 ? 0.5 : 0;
  const offsetY = gridHeight % 2 === 0 ? 0.5 : 0;

  return {
    x: Math.floor(worldX / TILE_SIZE + 0.5 - offsetX),
    y: Math.floor(worldZ / TILE_SIZE + 0.5 - offsetY),
  };
}