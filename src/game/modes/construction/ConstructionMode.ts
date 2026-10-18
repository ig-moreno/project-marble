
import type { GridManager } from "../../simulation/GridManager";
import type { GameMode } from "../GameMode";

import { createConstructionTools } from "./createConstructionTools";
import type { ToolManager } from "./tools/ToolManager";
import type { ToolId } from "./tools/types";

export class ConstructionMode implements GameMode {
  readonly id = "construction" as const;

  private readonly toolManager: ToolManager;

  constructor(
    grid: GridManager,
    private readonly showHighlight: (
      x: number,
      y: number,
    ) => void,
    private readonly hideHighlight: () => void,
  ) {
    this.toolManager = createConstructionTools(grid);
  }

  onEnter(): void {
    // El highlight aparecerá al mover el cursor.
  }

  onExit(): void {
    this.hideHighlight();

    // Cancela la operación actual.
    this.toolManager.deactivate();
  }

  onTileHover(x: number, y: number): void {
    this.showHighlight(x, y);
  }

  onTileLeave(): void {
    this.hideHighlight();
  }

  onTileClick(x: number, y: number): boolean {
    return this.toolManager.onTileClick(x, y);
  }

  onKeyDown(event: KeyboardEvent): boolean {
    return this.toolManager.onKeyDown(event);
  }

  selectTool(id: ToolId): void {
    this.toolManager.selectTool(id);
  }

  getActiveTool(): ToolId | null {
    return this.toolManager.getActiveTool();
  }
}
