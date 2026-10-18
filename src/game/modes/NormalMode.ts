import type { GameMode } from "./GameMode";

export class NormalMode implements GameMode {
  readonly id = "normal" as const;

  onEnter(): void {}

  onExit(): void {}
}