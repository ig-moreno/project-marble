
import type { GridManager } from "../../../simulation/GridManager";

import { disconnectRoad } from "../../../simulation/road/RoadUtils";
import { createTile, type TileType } from "../../../simulation/Tile";

import type { GameTool } from "./GameTool";
import type { ToolId } from "./types";

export class TilePaintTool implements GameTool {
  constructor(
    public readonly id: ToolId,
    private readonly tileType: TileType,
    private readonly grid: GridManager,
  ) {}

  onTileClick(x: number, y: number): boolean {
    const tile = this.grid.getTile(x, y);

    if (!tile || tile.type === this.tileType) {
      return false;
    }

    // Si sustituimos una carretera, desconectamos sus vecinas.
    if (tile.type === "road") {
      disconnectRoad(this.grid, x, y);
    }

    // Creamos la nueva tile y la almacenamos.
    return this.grid.setTile(
      x,
      y,
      createTile(x, y, this.tileType)
    );
  }
}
