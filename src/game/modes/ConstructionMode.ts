
import type { GameMode } from "./GameMode";
import type { ToolManager } from "../tools/ToolManager";

export class ConstructionMode implements GameMode {
  readonly id = "construction" as const;

  constructor(
    private readonly tools: ToolManager,
    private readonly showHighlight: (
      x: number,
      y: number,
    ) => void,
    private readonly hideHighlight: () => void,
  ) {}

  onEnter(): void {}

  onExit(): void {
    this.tools.deactivate();
    this.hideHighlight();
  }

  onTileHover(x: number, y: number): void {
    this.showHighlight(x, y);
  }

  onTileLeave(): void {
    this.hideHighlight();
  }

  onTileClick(x: number, y: number): boolean {
    return this.tools.onTileClick(x, y);
  }

  onKeyDown(event: KeyboardEvent): boolean {
    return this.tools.onKeyDown(event);
  }
}
