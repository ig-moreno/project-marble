export type GameModeId = "normal" | "construction";

export interface GameMode {
  readonly id: GameModeId;

  onEnter(): void;
  onExit(): void;

  onTileHover?(x: number, y: number): void;
  onTileLeave?(): void;
  onTileClick?(x: number, y: number): boolean;
  onKeyDown?(event: KeyboardEvent): boolean;
}