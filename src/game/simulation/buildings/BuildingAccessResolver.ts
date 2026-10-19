
import type { GridManager } from "../GridManager";
import type { Tile } from "../Tile";

export interface GridPosition {
  x: number;
  y: number;
}

export class BuildingAccessResolver {
  constructor(
    private readonly grid: GridManager,
  ) {}

  public getRoadAccesses(
    building: GridPosition,
  ): GridPosition[] {
    const tile = this.grid.getTile(
      building.x,
      building.y,
    );

    if (
      !tile ||
      (tile.type !== "house" &&
        tile.type !== "factory")
    ) {
      return [];
    }

    const neighbors = [
      { x: building.x, y: building.y - 1 },
      { x: building.x + 1, y: building.y },
      { x: building.x, y: building.y + 1 },
      { x: building.x - 1, y: building.y },
    ];

    return neighbors.filter(({ x, y }) => {
      const neighbor: Tile | null =
        this.grid.getTile(x, y) ?? null;

      return neighbor?.type === "road";
    });
  }
}
