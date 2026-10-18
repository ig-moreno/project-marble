
import type { GameMode, GameModeId } from "./GameMode";

export class GameModeManager {
  private modes = new Map<GameModeId, GameMode>();
  private activeMode: GameMode | null = null;

  register(mode: GameMode): void {
    this.modes.set(mode.id, mode);
  }

  selectMode(id: GameModeId): void {
    const next = this.modes.get(id);

    if (!next || this.activeMode === next) return;

    this.activeMode?.onExit();
    this.activeMode = next;
    this.activeMode.onEnter();
  }

  getActiveMode(): GameModeId | null {
    return this.activeMode?.id ?? null;
  }

  onTileHover(x: number, y: number): void {
    this.activeMode?.onTileHover?.(x, y);
  }

  onTileLeave(): void {
    this.activeMode?.onTileLeave?.();
  }

  onTileClick(x: number, y: number): boolean {
    return this.activeMode?.onTileClick?.(x, y) ?? false;
  }

  onKeyDown(event: KeyboardEvent): boolean {
    return this.activeMode?.onKeyDown?.(event) ?? false;
  }

  dispose(): void {
    this.activeMode?.onExit();
    this.activeMode = null;
    this.modes.clear();
  }
}
