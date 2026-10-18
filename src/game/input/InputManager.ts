
import {
  PointerEventTypes,
  type Scene,
  type Observer,
  type PointerInfo,
} from "babylonjs";

import type { GridManager } from "../simulation/GridManager";
import type { Tile } from "../simulation/Tile";
import type { GameModeManager } from "../modes/GameModeManager";

import { worldToGrid } from "../utils/coordinates";

export class InputManager {
  private pointerObserver: Observer<PointerInfo> | null = null;

  private readonly keyDownHandler: (
    event: KeyboardEvent,
  ) => void;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
    private readonly grid: GridManager,
    private readonly modeManager: GameModeManager,
    private readonly onTileModified: (
      x: number,
      y: number,
    ) => void,
    private readonly onUnhandledKeyDown?: (
      event: KeyboardEvent,
    ) => void,
    private readonly isInputBlocked: () => boolean = () => false,
    private readonly onModalKeyDown?: (
      event: KeyboardEvent
    ) => boolean,
  ) {
    this.keyDownHandler = (event) => {
      this.handleKeyDown(event);
    };

    this.setupPointerEvents();

    window.addEventListener(
      "keydown",
      this.keyDownHandler,
    );
  }

  // --------------------------------------------------
  // Ratón
  // --------------------------------------------------

  private setupPointerEvents(): void {
    this.pointerObserver =
      this.scene.onPointerObservable.add((pointerInfo) => {
        if (this.isInputBlocked()) {
          this.modeManager.onTileLeave();
          return;
        }

        switch (pointerInfo.type) {
          case PointerEventTypes.POINTERMOVE: {
            const tile = this.getTileUnderPointer();

            if (tile) {
              this.modeManager.onTileHover(
                tile.x,
                tile.y,
              );
            } else {
              this.modeManager.onTileLeave();
            }

            break;
          }

          case PointerEventTypes.POINTERDOWN: {
            if (pointerInfo.event.button !== 0) {
              return;
            }

            const tile = this.getTileUnderPointer();

            if (!tile) {
              return;
            }

            const modified =
              this.modeManager.onTileClick(
                tile.x,
                tile.y,
              );

            if (modified) {
              this.onTileModified(
                tile.x,
                tile.y,
              );
            }

            break;
          }
        }
      });
  }

  // --------------------------------------------------
  // Picking
  // --------------------------------------------------

  private getTileUnderPointer(): Tile | null {
    const pick = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      (mesh) => mesh.name === "ground",
    );

    if (!pick?.hit || !pick.pickedPoint) {
      return null;
    }

    const { x, z } = pick.pickedPoint;

    const coords = worldToGrid(
      x,
      z,
      this.grid.width,
      this.grid.height,
    );

    return this.grid.getTile(
      coords.x,
      coords.y,
    );
  }

  // --------------------------------------------------
  // Teclado
  // --------------------------------------------------

  
  private handleKeyDown(event: KeyboardEvent): void {
    const target = event.target;

    // Los modales tienen prioridad absoluta.
    if (this.isInputBlocked()) {
      const handled = this.onModalKeyDown?.(event) ?? false;

      if (handled) {
        event.preventDefault();
      }

      return;
    }

    // No procesar teclas mientras se escribe.
    if (
      target instanceof HTMLElement &&
      (
        target.isContentEditable ||
        target.closest("input, textarea, select")
      )
    ) {
      return;
    }

    // Primero, el modo y su herramienta activa.
    if (this.modeManager.onKeyDown(event)) {
      event.preventDefault();
      return;
    }

    // Después, los atajos generales.
    this.onUnhandledKeyDown?.(event);
  }


  // --------------------------------------------------
  // Limpieza
  // --------------------------------------------------

  public dispose(): void {
    if (this.pointerObserver) {
      this.scene.onPointerObservable.remove(
        this.pointerObserver,
      );

      this.pointerObserver = null;
    }

    window.removeEventListener(
      "keydown",
      this.keyDownHandler,
    );
  }
}
