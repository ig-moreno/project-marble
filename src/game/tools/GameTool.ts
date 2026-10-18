import type { ToolId } from "./types";

export interface GameTool {
  readonly id: ToolId;

  onTileClick(x: number, y: number): boolean;

  onKeyDown?(event: KeyboardEvent): boolean;
  onActivate?(): void;
  onDeactivate?(): void;
}