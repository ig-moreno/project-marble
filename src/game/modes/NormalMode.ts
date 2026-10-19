import type { GameMode } from "./GameMode";

export class NormalMode implements GameMode {
  readonly id = "normal" as const;

  constructor(
    private readonly onSelect: (x: number, y: number) => void,
    private readonly onClear: () => boolean,
  ) {}

  onEnter(): void {}

  onExit(): void { this.onClear(); }

  onTileClick(x: number, y: number): boolean {
    this.onSelect(x, y);
    return false; // Seleccionar no modifica el mundo.
  }

  onKeyDown(event: KeyboardEvent): boolean {
    return event.key === "Escape" && this.onClear();
  }
}
