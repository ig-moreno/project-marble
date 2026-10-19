
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
} from "babylonjs";

import { GridManager } from "../simulation/GridManager";

import { WorldRenderer } from "../rendering/WorldRenderer";
import { DebugRenderer } from "../rendering/DebugRenderer";
import { TileHighlight } from "../rendering/TileHighlght";
import { TileRenderer } from "../rendering/TileRenderer";
import { VehicleRenderer } from "../rendering/VehicleRenderer";

import { UIManager } from "../ui/UIManager";
import type { UIConfig } from "../ui/types";

import { GameModeManager } from "../modes/GameModeManager";
import { NormalMode } from "../modes/NormalMode";
import { ConstructionMode } from "../modes/construction/ConstructionMode";

import { InputManager } from "../input/InputManager";

import { SimulationManager } from "../simulation/SimulationManager";
import { VehicleManager } from "../simulation/vehicles/VehicleManager";
import { findRoadPath } from "../simulation/vehicles/RoadPathFinder";

import type { GameModeId } from "../modes/GameMode";
import type { ToolId } from "../modes/construction/tools/types";

import { PauseMenuManager } from "../ui/pause/PauseMenuManager";
import { BuildingPathResolver } from "../simulation/buildings/BuildingPathResolver";

import { MobilityManager } from "../simulation/mobility/MobilityManager";
import type { Trip } from "../simulation/mobility/Trip";

import {
  createTestScenario,
  type TestScenarioData,
} from "../scenarios/TestScenario";

import type {
  PauseMenuActionId,
  PauseMenuContext,
  PauseMenuOption,
  PauseMenuState,
} from "../ui/pause/types";

export class Game {
  // ==================================================
  // BABYLON
  // ==================================================

  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;

  private readonly camera: ArcRotateCamera;

  // ==================================================
  // MUNDO
  // ==================================================

  private readonly gridManager: GridManager;

  // ==================================================
  // RENDERIZADO
  // ==================================================

  private readonly worldRenderer: WorldRenderer;
  private readonly debugRenderer: DebugRenderer;
  private readonly tileHighlight: TileHighlight;
  private readonly tileRenderer: TileRenderer;
  private readonly vehicleRenderer: VehicleRenderer;

  // ==================================================
  // SIMULACIÓN
  // ==================================================

  private readonly simulationManager: SimulationManager;
  private readonly vehicleManager: VehicleManager;
  private readonly mobilityManager: MobilityManager;

  // ==================================================
  // MODOS Y HERRAMIENTAS
  // ==================================================

  private readonly modeManager: GameModeManager;
  private readonly constructionMode: ConstructionMode;

  // ==================================================
  // INPUT Y UI
  // ==================================================

  private readonly inputManager: InputManager;
  private readonly uiManager: UIManager;

  // ==================================================
  // PAUSA
  // ==================================================

  private readonly pauseMenuManager = new PauseMenuManager();

  private pauseMenuOpen = false;
  private wasPausedBeforeMenu = false;

  private readonly pauseMenuListeners = new Set<
    (state: PauseMenuState) => void
  >();

  // ==================================================
  // ESCENARIOS
  // ==================================================

  private readonly testScenario: TestScenarioData;

  // ==================================================
  // EVENTOS
  // ==================================================

  private readonly resizeHandler: () => void;

  // ==================================================
  // CONSTRUCTOR
  // ==================================================

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // --------------------------------------------------
    // Mundo lógico
    // --------------------------------------------------

    this.gridManager = new GridManager(20, 20);
    this.testScenario = createTestScenario(
      this.gridManager,
    );

    console.log(
      "Home:",
      this.gridManager.getTile(-6, 0),
    );

    console.log(
      "Workplace:",
      this.gridManager.getTile(5, 0),
    );


    // --------------------------------------------------
    // Babylon.js
    // --------------------------------------------------

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.scene = new Scene(this.engine);

    // --------------------------------------------------
    // Escena y cámara
    // --------------------------------------------------

    this.camera = this.initializeScene();

    // --------------------------------------------------
    // Renderizadores
    // --------------------------------------------------

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

    // Renderizar el estado inicial del mundo.
    this.tileRenderer.renderAll();

    this.vehicleRenderer = new VehicleRenderer(
      this.scene,
      this.gridManager.width,
      this.gridManager.height,
    );

    // --------------------------------------------------
    // Simulación
    // --------------------------------------------------

    this.simulationManager = new SimulationManager();
    

    
    this.vehicleManager = new VehicleManager(
      this.gridManager,
    );

    this.mobilityManager = new MobilityManager(
      this.gridManager,
      this.vehicleManager,
    );

    // Registrar los edificios del escenario.
    this.mobilityManager.registerBuilding(
      this.testScenario.home,
    );

    this.mobilityManager.registerBuilding(
      this.testScenario.workplace,
    );

    // Crear la primera persona de prueba.
    this.mobilityManager.registerPerson({
      id: "person-001",
      homeId: this.testScenario.home.id,
      workplaceId: this.testScenario.workplace.id,
      currentBuildingId: this.testScenario.home.id,
    });

    // Actualizar los vehículos antes de comprobar
    // si han finalizado sus viajes.
    this.simulationManager.register((deltaTime) => {
      this.vehicleManager.update(deltaTime);
    });


    // --------------------------------------------------
    // Modos
    // --------------------------------------------------

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

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

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

    // --------------------------------------------------
    // Input
    // --------------------------------------------------

    this.inputManager = new InputManager(
      this.scene,
      this.canvas,
      this.gridManager,
      this.modeManager,

      // Tile modificada
      (x, y) => {
        this.updateTileAndNeighbors(x, y);
      },

      // Teclado no consumido por el modo activo
      (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          this.openPauseMenu();
        }
      },

      // Bloquear interacciones cuando hay un modal
      () => this.pauseMenuOpen,

      // Teclado cuando el menú está abierto
      (event) => {
        if (event.key === "Escape") {
          this.closePauseMenu();
          return true;
        }

        return false;
      },
    );

    // --------------------------------------------------
    // Render loop
    // --------------------------------------------------

    this.startRenderLoop();

    // --------------------------------------------------
    // Resize
    // --------------------------------------------------

    this.resizeHandler = () => {
      this.engine.resize();
    };

    window.addEventListener(
      "resize",
      this.resizeHandler,
    );
  }

  // ==================================================
  // ESCENA
  // ==================================================

  private initializeScene(): ArcRotateCamera {
    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 2.5,
      50,
      Vector3.Zero(),
      this.scene,
    );

    camera.attachControl(this.canvas, true);

    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 200;

    const light = new HemisphericLight(
      "light",
      new Vector3(0, 1, 0),
      this.scene,
    );

    light.intensity = 0.7;

    return camera;
  }

  // ==================================================
  // ACTUALIZACIÓN VISUAL
  // ==================================================

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

  // ==================================================
  // RENDER LOOP
  // ==================================================

  private startRenderLoop(): void {
    this.engine.runRenderLoop(() => {
      const deltaTime = this.engine.getDeltaTime() / 1000;

      // Actualizar lógica del juego.
      this.simulationManager.update(deltaTime);

      // Sincronizar vehículos con Babylon.js.
      this.vehicleRenderer.update(
        this.vehicleManager.getVehicles(),
      );

      // Renderizar escena.
      this.scene.render();
    });
  }

  // ==================================================
  // MODOS
  // ==================================================

  public selectMode(id: GameModeId): void {
    if (this.pauseMenuOpen) return;

    this.modeManager.selectMode(id);
  }

  public getActiveMode(): GameModeId | null {
    return this.modeManager.getActiveMode();
  }

  // ==================================================
  // HERRAMIENTAS
  // ==================================================

  public selectTool(tool: ToolId): void {
    if (this.pauseMenuOpen) return;

    this.constructionMode.selectTool(tool);
  }

  public getActiveTool(): ToolId | null {
    return this.constructionMode.getActiveTool();
  }

  // ==================================================
  // SIMULACIÓN
  // ==================================================

  public pauseSimulation(): void {
    this.simulationManager.pause();
  }

  public resumeSimulation(): void {
    if (this.pauseMenuOpen) return;

    this.simulationManager.resume();
  }

  public isSimulationPaused(): boolean {
    return this.simulationManager.isPaused();
  }

  // ==================================================
  // VEHÍCULOS
  // ==================================================

  
  public spawnTestVehicle(): boolean {
    if (this.pauseMenuOpen) return false;

    const roads = this.gridManager.getTilesByType("road");

    if (roads.length < 2) {
      return false;
    }

    let bestPath: { x: number; y: number }[] | null = null;

    // Buscar la ruta más larga entre carreteras conectadas.
    for (const start of roads) {
      for (const end of roads) {
        if (
          start.x === end.x &&
          start.y === end.y
        ) {
          continue;
        }

        const path = findRoadPath(
          this.gridManager,
          { x: start.x, y: start.y },
          { x: end.x, y: end.y },
        );

        if (
          path &&
          (!bestPath || path.length > bestPath.length)
        ) {
          bestPath = path;
        }
      }
    }

    if (!bestPath || bestPath.length < 2) {
      return false;
    }

    const start = bestPath[0];
    const destination = bestPath[bestPath.length - 1];

    return (
      this.vehicleManager.createVehicle(
        start,
        destination,
      ) !== null
    );
  }


  // ==================================================
  // MENÚ DE PAUSA
  // ==================================================

  
// ==================================================
// MENÚ DE PAUSA
// ==================================================

  public isPauseMenuOpen(): boolean {
    return this.pauseMenuOpen;
  }

  public getPauseMenuOptions(): PauseMenuOption[] {
    return this.pauseMenuManager.getOptions();
  }

  public getPauseMenuContext(): PauseMenuContext {
    return this.pauseMenuManager.getContext();
  }

  public setPauseMenuContext(
    context: PauseMenuContext,
  ): void {
    if (this.pauseMenuManager.getContext() === context) {
      return;
    }

    this.pauseMenuManager.setContext(context);
    this.notifyPauseMenuChange();
  }

  public getPauseMenuState(): PauseMenuState {
    return {
      open: this.pauseMenuOpen,
      options: this.getPauseMenuOptions(),
    };
  }

  public onPauseMenuChange(
    listener: (state: PauseMenuState) => void,
  ): () => void {
    this.pauseMenuListeners.add(listener);

    // Sincronizar el estado inicial.
    listener(this.getPauseMenuState());

    return () => {
      this.pauseMenuListeners.delete(listener);
    };
  }

  public openPauseMenu(): void {
    if (this.pauseMenuOpen) return;

    this.wasPausedBeforeMenu =
      this.simulationManager.isPaused();

    this.pauseMenuOpen = true;

    this.simulationManager.pause();

    this.modeManager.onTileLeave();
    this.camera.detachControl();

    this.notifyPauseMenuChange();
  }

  public closePauseMenu(): void {
    if (!this.pauseMenuOpen) return;

    this.pauseMenuOpen = false;

    this.camera.attachControl(this.canvas, true);

    // Restaurar el estado anterior al menú.
    if (!this.wasPausedBeforeMenu) {
      this.simulationManager.resume();
    }

    this.notifyPauseMenuChange();
  }

  public executePauseMenuAction(
    actionId: PauseMenuActionId,
  ): void {
    if (!this.pauseMenuOpen) return;

    // Solo se pueden ejecutar acciones disponibles.
    const option = this.getPauseMenuOptions().find(
      (item) => item.id === actionId,
    );

    if (!option || option.disabled) return;

    switch (actionId) {
      case "resume":
        this.closePauseMenu();
        break;

      // Se implementarán cuando existan
      // los sistemas correspondientes.
      case "settings":
      case "save":
      case "restart":
      case "exit":
        break;
    }
  }

  private notifyPauseMenuChange(): void {
    const state = this.getPauseMenuState();

    for (const listener of this.pauseMenuListeners) {
      listener(state);
    }
  }


  // ==================================================
  // UI
  // ==================================================

  public getUIConfig(): UIConfig {
    return this.uiManager.getConfig();
  }

  // ==================================================
  // CLEANUP
  // ==================================================

  public dispose(): void {
    this.engine.stopRenderLoop();

    window.removeEventListener(
      "resize",
      this.resizeHandler,
    );

    // Entrada y modos.
    this.inputManager.dispose();
    this.modeManager.dispose();

    // Simulación.
    this.simulationManager.dispose();
    this.vehicleManager.clear();
    this.mobilityManager.dispose();

    // Renderizadores.
    this.vehicleRenderer.dispose();
    this.tileHighlight.dispose();

    // Eventos UI.
    this.pauseMenuListeners.clear();

    // Babylon.js.
    this.scene.dispose();
    this.engine.dispose();
  }

   // ==================================================
  // TEMP
  // ==================================================
  public testBuildingConnection(): boolean {
    if (this.pauseMenuOpen) return false;

    const resolver = new BuildingPathResolver(
      this.gridManager,
    );

    const path = resolver.findPath(
      {
        x: this.testScenario.home.x,
        y: this.testScenario.home.y,
      },
      {
        x: this.testScenario.workplace.x,
        y: this.testScenario.workplace.y,
      },
    );

    if (!path) {
      console.log(
        "No existe una ruta entre casa y fábrica.",
      );
      return false;
    }

    console.log(
      "Ruta entre casa y fábrica:",
      path,
    );

    return true;
  }

  
  public requestTestWorkTrip(): Trip | null {
    if (this.pauseMenuOpen) return null;

    const trip = this.mobilityManager.requestWorkTrip(
      "person-001",
    );

    if (!trip) {
      console.log(
        "La persona ya tiene un viaje activo o no existe.",
      );
      return null;
    }

    console.log(
      `Viaje ${trip.id}: ${trip.status}`,
    );

    return trip;
  }

  
  public requestTestHomeTrip(): Trip | null {
    if (this.pauseMenuOpen) return null;

    const trip = this.mobilityManager.requestHomeTrip(
      "person-001",
    );

    if (!trip) {
      console.log(
        "La persona no puede iniciar el viaje a casa.",
      );
      return null;
    }

    console.log(`Viaje ${trip.id}: ${trip.status}`);

    return trip;
  }

    

}
