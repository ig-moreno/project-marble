
import type { GameTool } from "./GameTool";
import type { ToolId } from "./types";

export class ToolManager {
  private tools = new Map<ToolId, GameTool>();
  private activeTool: GameTool | null = null;

  register(tool: GameTool): void {
    this.tools.set(tool.id, tool);
  }

  selectTool(id: ToolId): void {
    const next = this.tools.get(id);
    if (!next || this.activeTool === next) return;

    this.activeTool?.onDeactivate?.();
    this.activeTool = next;
    this.activeTool.onActivate?.();
  }

  getActiveTool(): ToolId | null {
    return this.activeTool?.id ?? null;
  }

  onTileClick(x: number, y: number): boolean {
    return this.activeTool?.onTileClick(x, y) ?? false;
  }

  onKeyDown(event: KeyboardEvent): boolean {
    return this.activeTool?.onKeyDown?.(event) ?? false;
  }

  deactivate(): void {
    this.activeTool?.onDeactivate?.();
  }
}
