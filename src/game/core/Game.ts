
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PointerEventTypes
} from "babylonjs";
import { GridManager } from "../simulation/GridManager";
import { WorldRenderer } from "../rendering/WorldRenderer";
import { DebugRenderer } from "../rendering/DebugRenderer";
import { worldToGrid } from "../utils/coordinates";
import { TileHighlight } from "../rendering/TileHighlght";
import { ToolManager } from "../tools/ToolManager";
import { UIManager } from "../ui/UIManager";
import type { ToolId } from "../tools/types";
import type { UIConfig } from "../ui/types";
import { TileRenderer } from "../rendering/TileRenderer";
import { GameModeManager } from "../modes/GameModeManager";
import { NormalMode } from "../modes/NormalMode";
import { ConstructionMode } from "../modes/ConstructionMode";

import { RoadBuilderTool } from "../tools/RoadBuilderTool";
import { TilePaintTool } from "../tools/TilePaintTool";
import type { GameModeId } from "../modes/GameMode";
import type { Tile } from "../simulation/Tile";

export class Game {
  private engine: Engine;
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private gridManager: GridManager;
  private worldRenderer: WorldRenderer;
  private debugRenderer: DebugRenderer;
  private tileHighlight: TileHighlight;
  private toolManager: ToolManager;
  private uiManager: UIManager;
  private tileRenderer: TileRenderer;
  private modeManager: GameModeManager;

  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Inicializar el mundo lógico
    this.gridManager = new GridManager(20, 20);

    
    // 1. Inicializar motor y escena
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.scene = new Scene(this.engine);

    this.worldRenderer = new WorldRenderer(this.scene, this.gridManager);
    this.debugRenderer = new DebugRenderer(this.scene);
    this.tileHighlight = new TileHighlight(
      this.scene, 
      this.gridManager.width,
      this.gridManager.height
    )
    this.tileRenderer = new TileRenderer(
      this.scene,
      this.gridManager
    )

    this.toolManager = new ToolManager();

    this.toolManager.register(
      new RoadBuilderTool(this.gridManager),
    );

    this.toolManager.register(
      new TilePaintTool("house", "house", this.gridManager),
    );

    this.toolManager.register(
      new TilePaintTool("forest", "forest", this.gridManager),
    );

    this.toolManager.register(
      new TilePaintTool("mineral", "mineral", this.gridManager),
    );

    this.toolManager.register(
      new TilePaintTool("erase", "empty", this.gridManager),
    );

    this.toolManager.selectTool("road");

    this.modeManager = new GameModeManager();

    this.modeManager.register(new NormalMode());

    this.modeManager.register(
      new ConstructionMode(
        this.toolManager,
        (x, y) => {
          const tile = this.gridManager.getTile(x, y);
          if (tile) {
            // Aquí llama al método que ya utilizas
            // para mostrar el highlight.
          }
        },
        () => {
          // Aquí llama al método que ya utilizas
          // para ocultar el highlight.
        },
      ),
    );

    this.modeManager.selectMode("construction");


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



    // 2. Configurar escena
    this.initializeScene();

    this.setupPointerEvents();

    // 3. Iniciar renderizado
    this.startRenderLoop();

    // 4. Registrar resize
    this.resizeHandler = () => {
      this.engine.resize();
    };

    window.addEventListener("resize", this.resizeHandler);
  }

  private initializeScene(): void {
    // Cámara
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

    // Iluminación
    const light = new HemisphericLight(
      "light",
      new Vector3(0, 1, 0),
      this.scene,
    );

    light.intensity = 0.7;

    // Esfera de prueba
    /*
    const sphere = MeshBuilder.CreateSphere(
      "sphere",
      { diameter: 2, segments: 32 },
      this.scene,
    );
    */


    //// Crear un cubo perfecto (todos los lados iguales)
    /*const cube = MeshBuilder.CreateBox("miCubo", { size: 2 }, this.scene);

    cube.position.y = 1;

    const cubeMaterial = new StandardMaterial(
      "cubeMat",
      this.scene,
    );

    cubeMaterial.diffuseColor = new Color3(0.6, 0.2, 0.8);
    cube.material = cubeMaterial;
*/
    // Animación de prueba
    this.scene.onBeforeRenderObservable.add(() => {
      const deltaTime = this.engine.getDeltaTime() / 1000;

     // cube.rotation.y += deltaTime;
    });
  }

  
  
  
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
          // Solo botón izquierdo
          if (pointerInfo.event.button !== 0) return;

          const tile = this.getTileUnderPointer();
          if (!tile) return;

          // Delegar la acción al modo activo
          const modified = this.modeManager.onTileClick(
            tile.x,
            tile.y
          );

          if (modified) {
            // Actualizar la tile y sus vecinas
            this.updateTileAndNeighbors(tile.x, tile.y);
          }

          break;
        }
      }
    });
  }


  
  private getTileUnderPointer(): Tile | null {
    // Lanzar un rayo desde el ratón hacia el suelo
    const pick = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      (mesh) => mesh.name === "ground"
    );

    if (!pick?.hit || !pick.pickedPoint) {
      return null;
    }

    // Posición del ratón en el mundo 3D
    const { x, z } = pick.pickedPoint;

    // Convertir coordenadas del mundo a coordenadas del grid
    const coords = worldToGrid(
      x,
      z,
      this.gridManager.width,
      this.gridManager.height
    );

    // Obtener la celda
    return this.gridManager.getTile(coords.x, coords.y);
  }

  
  private updateTileAndNeighbors(x: number, y: number): void {
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



  private startRenderLoop(): void {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }


  public selectMode(id: GameModeId): void {
    this.modeManager.selectMode(id);
  }

  public getActiveMode(): GameModeId | null {
    return this.modeManager.getActiveMode();
  }

  public onKeyDown(event: KeyboardEvent): boolean {
    return this.modeManager.onKeyDown(event);
  }


  public selectTool(tool: ToolId): void {
    this.toolManager.selectTool(tool);
  }

  public getActiveTool(): ToolId | null {
    return this.toolManager.getActiveTool();
  }

  public getUIConfig(): UIConfig {
    return this.uiManager.getConfig();
  }

  public dispose(): void {
    // Detener el renderizado
    this.engine.stopRenderLoop();

    // Eliminar listener de resize
    window.removeEventListener("resize", this.resizeHandler);

    // Liberar recursos de Babylon.js
    this.scene.dispose();
    this.engine.dispose();
    this.modeManager.dispose();
  }
}
