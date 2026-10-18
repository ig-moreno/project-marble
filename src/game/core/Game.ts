
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  PointerEventTypes,
} from "babylonjs";

import { GridManager } from "../simulation/GridManager";
import type { Tile } from "../simulation/Tile";

import { WorldRenderer } from "../rendering/WorldRenderer";
import { DebugRenderer } from "../rendering/DebugRenderer";
import { TileHighlight } from "../rendering/TileHighlght";
import { TileRenderer } from "../rendering/TileRenderer";

import { worldToGrid } from "../utils/coordinates";

import { UIManager } from "../ui/UIManager";
import type { UIConfig } from "../ui/types";

import { GameModeManager } from "../modes/GameModeManager";
import { NormalMode } from "../modes/NormalMode";
import { ConstructionMode } from "../modes/construction/ConstructionMode";

import type { GameModeId } from "../modes/GameMode";
import type { ToolId } from "../modes/construction/tools/types";

export class Game {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;

  private readonly gridManager: GridManager;

  private readonly worldRenderer: WorldRenderer;
  private readonly debugRenderer: DebugRenderer;
  private readonly tileHighlight: TileHighlight;
  private readonly tileRenderer: TileRenderer;

  private readonly uiManager: UIManager;

  private readonly modeManager: GameModeManager;
  private readonly constructionMode: ConstructionMode;

  private readonly resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Mundo lógico
    this.gridManager = new GridManager(20, 20);

    // Motor y escena
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.scene = new Scene(this.engine);

    // Renderizadores
    this.worldRenderer = new WorldRenderer(
      this.scene,
      this.gridManager,
    );

    this.debugRenderer = new DebugRenderer(this.scene);

    this.tileHighlight = new TileHighlight(
      this.scene,
      this.gridManager.width,
      this.gridManager.height,
    );

    this.tileRenderer = new TileRenderer(
      this.scene,
      this.gridManager,
    );

    // Modos
    this.modeManager = new GameModeManager();

    this.constructionMode = new ConstructionMode(
      this.gridManager,

      (x, y) => {
        const tile = this.gridManager.getTile(x, y);

        if (tile) {
          this.tileHighlight.show(x, y);
        }
      },

      () => {
        this.tileHighlight.hide();
      },
    );

    this.modeManager.register(new NormalMode());
    this.modeManager.register(this.constructionMode);
    this.modeManager.selectMode("construction");

    // Configuración de UI
    this.uiManager = new UIManager({
      components: {
        tilePicker: true,
        infoPanel: false,
        modal: false,
      },
      availableTools: [
        "road",
        "house",
        "forest",
        "mineral",
        "erase",
      ],
    });

    // Escena y eventos
    this.initializeScene();
    this.setupPointerEvents();

    // Renderizado
    this.startRenderLoop();

    // Resize
    this.resizeHandler = () => {
      this.engine.resize();
    };

    window.addEventListener("resize", this.resizeHandler);
  }

  // --------------------------------------------------
  // Escena
  // --------------------------------------------------

  private initializeScene(): void {
    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 2.5,
      15,
      Vector3.Zero(),
      this.scene,
    );

    camera.attachControl(this.canvas, true);
    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 50;

    const light = new HemisphericLight(
      "light",
      new Vector3(0, 1, 0),
      this.scene,
    );

    light.intensity = 0.7;
  }

  // --------------------------------------------------
  // Eventos del puntero
  // --------------------------------------------------

  private setupPointerEvents(): void {
    this.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERMOVE: {
          const tile = this.getTileUnderPointer();

          if (tile) {
            this.modeManager.onTileHover(tile.x, tile.y);
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

          const modified = this.modeManager.onTileClick(
            tile.x,
            tile.y,
          );

          if (modified) {
            this.updateTileAndNeighbors(tile.x, tile.y);
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
      this.gridManager.width,
      this.gridManager.height,
    );

    return this.gridManager.getTile(
      coords.x,
      coords.y,
    );
  }

  // --------------------------------------------------
  // Actualización visual
  // --------------------------------------------------

  private updateTileAndNeighbors(
    x: number,
    y: number,
  ): void {
    const positions = [
      { x, y },
      { x, y: y - 1 },
      { x: x + 1, y },
      { x, y: y + 1 },
      { x: x - 1, y },
    ];

    for (const position of positions) {
      const tile = this.gridManager.getTile(
        position.x,
        position.y,
      );

      if (tile) {
        this.tileRenderer.updateTile(tile);
      }
    }
  }

  // --------------------------------------------------
  // Render loop
  // --------------------------------------------------

  private startRenderLoop(): void {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  // --------------------------------------------------
  // Modos
  // --------------------------------------------------

  public selectMode(id: GameModeId): void {
    this.modeManager.selectMode(id);
  }

  public getActiveMode(): GameModeId | null {
    return this.modeManager.getActiveMode();
  }

  // --------------------------------------------------
  // Herramientas de construcción
  // --------------------------------------------------

  public selectTool(tool: ToolId): void {
    this.constructionMode.selectTool(tool);
  }

  public getActiveTool(): ToolId | null {
    return this.constructionMode.getActiveTool();
  }

  // --------------------------------------------------
  // Teclado
  // --------------------------------------------------

  public onKeyDown(event: KeyboardEvent): boolean {
    return this.modeManager.onKeyDown(event);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  public getUIConfig(): UIConfig {
    return this.uiManager.getConfig();
  }

  // --------------------------------------------------
  // Limpieza
  // --------------------------------------------------

  public dispose(): void {
    this.engine.stopRenderLoop();

    window.removeEventListener(
      "resize",
      this.resizeHandler,
    );

    this.modeManager.dispose();

    this.scene.dispose();
    this.engine.dispose();
  }
}
