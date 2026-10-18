
import type { GridManager } from "../simulation/GridManager";
import { createTile } from "../simulation/Tile";
import { connectRoads } from "../simulation/road/RoadUtils";
import type { GameTool } from "./GameTool";

export class RoadBuilderTool implements GameTool {
  readonly id = "road" as const;

  private lastTile: { x: number; y: number } | null = null;

  constructor(private grid: GridManager) {}

  onTileClick(x: number, y: number): boolean {
    const tile = this.grid.getTile(x, y);
    if (!tile) return false;

    if (tile.type !== "empty" && tile.type !== "road") {
      this.cancel();
      return false;
    }

    if (tile.type === "empty") {
      this.grid.setTile(
        x,
        y,
        createTile(x, y, "road")
      );
    }

    if (this.lastTile) {
      const distance =
        Math.abs(this.lastTile.x - x) +
        Math.abs(this.lastTile.y - y);

      if (distance === 1) {
        connectRoads(
          this.grid,
          this.lastTile.x,
          this.lastTile.y,
          x,
          y,
        );
      }
    }

    this.lastTile = { x, y };
    return true;
  }

  onKeyDown(event: KeyboardEvent): boolean {
    if (event.key !== "Escape") return false;

    if (!this.lastTile) return false;

    this.cancel();
    return true;
  }

  onDeactivate(): void {
    this.cancel();
  }

  private cancel(): void {
    this.lastTile = null;
  }
}
