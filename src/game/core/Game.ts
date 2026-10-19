
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
} from "babylonjs";

import { GridManager } from "../simulation/GridManager";
import { TEST_SCENARIO_CONFIG } from "../../config/game/testScenario";
import { VEHICLE_CONFIG, VEHICLE_DIMENSIONS } from "../../config/game/simulation";
import { findLaneRoute, type LaneRoute } from "../simulation/road/LanePathFinder";
import { populateTestScenario, testRoutes, circularTestRoutes, type RouteTestState } from "../scenarios/TestScenario";
import { getConnectedRoadNeighbors } from "../simulation/vehicles/RoadPathFinder";
import { buildLaneGraph, type LaneGraph } from "../simulation/road/LaneGraph";
import type { TileType } from "../simulation/Tile";
import { getRoadGeometry } from "../simulation/road/RoadUtils";
import type { RoadShape, RoadDirection } from "../simulation/road/types";
import type { InspectionState } from "../ui/inspection/types";
import type { MainMenuActionId, MainMenuState } from "../ui/menu/types";
import type { NavigationState, GameScreen } from "../ui/navigation/types";
import type { SettingsState, SettingsTabId } from "../ui/settings/types";
import { settingsTabs } from "../ui/settings/content";

import { WorldRenderer } from "../rendering/WorldRenderer";
import { DebugRenderer } from "../rendering/DebugRenderer";
import { TileHighlight } from "../rendering/TileHighlght";
import { TileRenderer } from "../rendering/TileRenderer";
import { LaneOverlayRenderer } from "../rendering/LaneOverlayRenderer";
import { VehicleRenderer } from "../rendering/VehicleRenderer";

import { UIManager } from "../ui/UIManager";
import type { UIConfig } from "../ui/types";

import { GameModeManager } from "../modes/GameModeManager";
import { NormalMode } from "../modes/NormalMode";
import { ConstructionMode } from "../modes/construction/ConstructionMode";

import { InputManager } from "../input/InputManager";

import { SimulationManager } from "../simulation/SimulationManager";
import { VehicleManager } from "../simulation/vehicles/VehicleManager";

import type { GameModeId } from "../modes/GameMode";
import type { ToolId } from "../modes/construction/tools/types";

import { PauseMenuManager } from "../ui/pause/PauseMenuManager";

import { MobilityManager } from "../simulation/mobility/MobilityManager";
import type {
  ConfirmationDialogRequest,
  ConfirmationDialogState,
  ConfirmationResponse,
} from "../ui/confirmation/types";


import type {
  PauseMenuActionId,
  PauseMenuContext,
  PauseMenuOption,
  PauseMenuState,
} from "../ui/pause/types";

import { DEFAULT_SESSION_SETTINGS } from "../../config/sessionSettings";
import { RENDERING_CONFIG } from "../../config/game/rendering";

import {
  CAMERA_CONFIG,
  INITIAL_CAMERA_ALPHA,
  INITIAL_CAMERA_BETA,
  INITIAL_CAMERA_RADIUS
} from "../../config/game/camera";



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
  private laneGraph: LaneGraph;
  private activeTestRoute: string | null = null;
  private diagnosticVehicleId: string | null = null;
  private diagnosticVehicleIds: string[] = [];
  private diagnosticLeaderHeld = false;
  private diagnosticLapCount = 0;
  private diagnosticStatus = "";
  private readonly routeOverlay: LaneOverlayRenderer;

  // ==================================================
  // RENDERIZADO
  // ==================================================

  private readonly worldRenderer: WorldRenderer;
  private readonly debugRenderer: DebugRenderer;
  private readonly tileHighlight: TileHighlight;
  private readonly selectionHighlight: TileHighlight;
  private readonly laneOverlay: LaneOverlayRenderer;
  private inspection: InspectionState | null = null;
  private readonly inspectionListeners = new Set<(state: InspectionState | null) => void>();
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
  private screen: GameScreen = "main-menu";
  private settingsTab: SettingsTabId = "general";
  private readonly navigationListeners = new Set<(state: NavigationState) => void>();

  // ==================================================
  // PAUSA
  // ==================================================

  private readonly pauseMenuManager = new PauseMenuManager();

  private pauseMenuOpen = false;
  private wasPausedBeforeMenu = false;
  private confirmation: ConfirmationDialogRequest | null = null;
  private wasPausedBeforeConfirmation = false;
  private readonly confirmationListeners = new Set<
    (state: ConfirmationDialogState | null) => void
  >();

  private readonly pauseMenuListeners = new Set<
    (state: PauseMenuState) => void
  >();

  // ==================================================
  // EVENTOS
  // ==================================================

  private readonly resizeHandler: () => void;

  // ==================================================
  // CONSTRUCTOR
  // ==================================================

  constructor(canvas: HTMLCanvasElement, private readonly options: { testScenario?: boolean } = {}) {
    this.canvas = canvas;

    // --------------------------------------------------
    // Mundo lógico
    // --------------------------------------------------

    this.gridManager = new GridManager(DEFAULT_SESSION_SETTINGS.worldTilesX, DEFAULT_SESSION_SETTINGS.worldTilesY);
    this.laneGraph = buildLaneGraph(this.gridManager);
    // Una partida nueva comienza con el mapa vacío.

    // --------------------------------------------------
    // Babylon.js
    // --------------------------------------------------

    this.engine = new Engine(this.canvas, RENDERING_CONFIG.antialias, {
      preserveDrawingBuffer: RENDERING_CONFIG.preserveDrawingBuffer,
      stencil: RENDERING_CONFIG.stencil,
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

    this.selectionHighlight = new TileHighlight(
      this.scene, this.gridManager.width, this.gridManager.height, 0.16,
    );
    this.laneOverlay = new LaneOverlayRenderer(this.scene, this.gridManager.width, this.gridManager.height);
    this.routeOverlay = new LaneOverlayRenderer(this.scene, this.gridManager.width, this.gridManager.height);

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
    this.simulationManager.pause();
    

    
    this.vehicleManager = new VehicleManager(
      this.gridManager,
    );

    this.mobilityManager = new MobilityManager(
      this.gridManager,
      this.vehicleManager,
    );

    // Los edificios y habitantes se crearán desde la partida.

    // Actualizar los vehículos antes de comprobar
    // si han finalizado sus viajes.
    this.simulationManager.register((deltaTime) => {
      this.vehicleManager.update(deltaTime);
      const laps = this.vehicleManager.getVehicles().reduce((sum, vehicle) => sum + (vehicle.kind === "lane" ? vehicle.completedLaps : 0), 0);
      if (laps !== this.diagnosticLapCount) {
        this.diagnosticLapCount = laps;
        this.notifyNavigationChange();
      }
      if (this.diagnosticVehicleId && !this.vehicleManager.getVehicles().some((vehicle) => vehicle.id === this.diagnosticVehicleId || this.diagnosticVehicleIds.includes(vehicle.id))) {
        this.diagnosticVehicleId = null;
        this.diagnosticVehicleIds = [];
        this.diagnosticStatus = "Recorrido completado";
        this.notifyNavigationChange();
      }
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

    this.modeManager.register(new NormalMode(
      (x, y) => this.inspectTile(x, y),
      () => this.clearInspection(),
    ));
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
      availableModes: [
        { id: "normal", label: "Normal" },
        { id: "construction", label: "Construcción" },
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
      () => this.screen !== "gameplay" || this.pauseMenuOpen || this.confirmation !== null,

      // Teclado cuando el menú está abierto
      (event) => {
        if (event.key === "Escape") {
          if (this.screen === "settings" && !this.confirmation) {
            this.closeSettings();
            return true;
          }
          if (this.confirmation) {
            this.respondToConfirmation("cancel");
          } else {
            this.closePauseMenu();
          }
          return true;
        }

        return false;
      },
    );

    this.camera.detachControl();

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
      INITIAL_CAMERA_ALPHA,
      INITIAL_CAMERA_BETA,
      INITIAL_CAMERA_RADIUS,
      Vector3.Zero(),
      this.scene,
    );

    // Permite inclinar la cámara desde una vista cenital
    // hasta aproximadamente 75° respecto a la vertical.
    camera.lowerBetaLimit = CAMERA_CONFIG.lowerBetaLimit;
    camera.upperBetaLimit = CAMERA_CONFIG.upperBetaLimit;

    // Límites del zoom.
    camera.lowerRadiusLimit = CAMERA_CONFIG.lowerRadiusLimit;   // Máximo acercamiento.
    camera.upperRadiusLimit = CAMERA_CONFIG.upperRadiusLimit;  // Máximo alejamiento.

    // Sensibilidad del zoom con la rueda del ratón.
    camera.wheelPrecision = CAMERA_CONFIG.wheelPrecision;
    camera.zoomToMouseLocation = CAMERA_CONFIG.zoomToMouseLocation;

    camera.attachControl(this.canvas, true);

    const light = new HemisphericLight(
      "light",
      new Vector3(0, 1, 0),
      this.scene,
    );

    light.intensity = RENDERING_CONFIG.hemisphericLightIntensity;

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

    this.laneGraph = buildLaneGraph(this.gridManager);

    for (const position of positions) {
      const tile = this.gridManager.getTile(
        position.x,
        position.y,
      );

      if (tile) {
        this.tileRenderer.updateTile(tile);
      }
    }
    this.refreshTestRoute();
  }

  // ==================================================
  // RENDER LOOP
  // ==================================================

  private startRenderLoop(): void {
    this.engine.runRenderLoop(() => {
      if (this.screen !== "gameplay") return;
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
    if (this.screen !== "gameplay" || this.pauseMenuOpen || this.confirmation) return;

    const option = this.getUIConfig().availableModes.find((mode) => mode.id === id);
    if (!option || option.disabled) return;

    this.modeManager.selectMode(id);
  }

  public getActiveMode(): GameModeId | null {
    return this.modeManager.getActiveMode();
  }

  // ==================================================
  // HERRAMIENTAS
  // ==================================================

  public selectTool(tool: ToolId): void {
    if (this.screen !== "gameplay" || this.pauseMenuOpen || this.confirmation) return;

    this.constructionMode.selectTool(tool);
  }

  public getActiveTool(): ToolId | null {
    return this.constructionMode.getActiveTool();
  }

  // ==================================================
  // SIMULACIÓN
  // ==================================================

  public getSimulationSpeedOptions() {
    return [
      { speed: 1, icon: ">", label: "Velocidad normal" },
      { speed: 2, icon: ">>", label: "Velocidad ?2" },
      { speed: 4, icon: ">>>", label: "Velocidad ?4" },
    ] as const;
  }

  public getSimulationSpeed(): 1 | 2 | 4 { return this.simulationManager.getSpeedMultiplier(); }

  public setSimulationSpeed(speed: 1 | 2 | 4): void {
    this.simulationManager.setSpeedMultiplier(speed);
  }

  public pauseSimulation(): void {
    this.simulationManager.pause();
  }

  public resumeSimulation(): void {
    if (this.screen !== "gameplay" || this.pauseMenuOpen || this.confirmation) return;

    this.simulationManager.resume();
  }

  public isSimulationPaused(): boolean {
    return this.simulationManager.isPaused();
  }

  public onClockChange(listener: (minutes: number) => void): () => void {
    return this.simulationManager.onClockChange(listener);
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
    if (this.screen !== "gameplay" || this.pauseMenuOpen || this.confirmation) return;

    this.wasPausedBeforeMenu =
      this.simulationManager.isPaused();

    this.pauseMenuOpen = true;

    this.simulationManager.pause();

    this.modeManager.onTileLeave();
    this.camera.detachControl();

    this.notifyPauseMenuChange();
  }

  public closePauseMenu(): void {
    if (!this.pauseMenuOpen || this.confirmation) return;

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
    if (!this.pauseMenuOpen || this.confirmation) return;

    // Solo se pueden ejecutar acciones disponibles.
    const option = this.getPauseMenuOptions().find(
      (item) => item.id === actionId,
    );

    if (!option || option.disabled) return;

    switch (actionId) {
      case "resume":
        this.closePauseMenu();
        break;

      case "exit":
        this.requestConfirmation({
          title: "¿Salir al menú?",
          message: "La partida no se ha guardado. Si sales, perderás todo el progreso.",
          confirmLabel: "Salir sin guardar",
          cancelLabel: "Seguir en la partida",
          confirmVariant: "danger",
          onConfirm: () => this.returnToMainMenu(),
          onCancel: () => {}, // Mantener abierto el menú de pausa.
        });
        break;

      // Se implementarán cuando existan
      // los sistemas correspondientes.
      case "settings":
      case "save":
      case "restart":
        break;
    }
  }

  public requestConfirmation(request: ConfirmationDialogRequest): void {
    if (this.confirmation) return;

    this.wasPausedBeforeConfirmation = this.simulationManager.isPaused();
    this.confirmation = request;
    this.simulationManager.pause();
    this.modeManager.onTileLeave();
    this.camera.detachControl();
    this.notifyConfirmationChange();
  }

  public onConfirmationChange(
    listener: (state: ConfirmationDialogState | null) => void,
  ): () => void {
    this.confirmationListeners.add(listener);
    listener(this.getConfirmationState());
    return () => { this.confirmationListeners.delete(listener); };
  }

  private getConfirmationState(): ConfirmationDialogState | null {
    if (!this.confirmation) return null;
    const { onConfirm, onCancel, ...state } = this.confirmation;
    return state;
  }

  public respondToConfirmation(response: ConfirmationResponse): void {
    const request = this.confirmation;
    if (!request) return;

    this.confirmation = null;
    if (this.screen === "gameplay" && !this.pauseMenuOpen) {
      this.camera.attachControl(this.canvas, true);
      if (!this.wasPausedBeforeConfirmation) this.simulationManager.resume();
    }
    this.notifyConfirmationChange();
    if (response === "confirm") request.onConfirm();
    else request.onCancel();
  }

  private notifyConfirmationChange(): void {
    const state = this.getConfirmationState();
    for (const listener of this.confirmationListeners) listener(state);
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

  private inspectTile(x: number, y: number): void {
    this.laneOverlay.clear();
    const tile = this.gridManager.getTile(x, y);
    if (!tile) {
      this.clearInspection();
      return;
    }

    const shapes: Record<RoadShape, string> = {
      isolated: "Tramo aislado",
      end: "Calle sin salida",
      straight: "Recta",
      corner: "Curva",
      "t-junction": "Intersección en T",
      cross: "Cruce",
    };
    const directions: Record<RoadDirection, string> = {
      north: "Norte", east: "Este", south: "Sur", west: "Oeste",
    };
    const titles: Record<TileType, string> = {
      empty: "Baldosa vacía", road: "Carretera", house: "Casa",
      factory: "Fábrica", forest: "Bosque", mineral: "Mineral",
    };
    const sections: InspectionState["sections"] = [{
      title: "Información",
      fields: [
        { label: "Coordenadas", value: `${x}, ${y}` },
        { label: "Tipo de baldosa", value: titles[tile.type] },
      ],
    }];
    if (tile.type === "road") {
      const roadShape = getRoadGeometry(this.gridManager, x, y).shape;
      const connections = (Object.keys(directions) as RoadDirection[])
        .filter((direction) => tile.roadConnections[direction])
        .map((direction) => directions[direction]);
      sections.push({
        title: "Trazado",
        fields: [
          { label: "Tipo", value: shapes[roadShape] },
          { label: `Conexiones (${connections.length})`, value: connections.join(", ") || "Sin conexiones" },
        ],
      });
      const allLanes = [...this.laneGraph.lanes.values()];
      const lanes = allLanes.filter((lane) => lane.tileX === x && lane.tileY === y);
      const neighborTiles = new Set(getConnectedRoadNeighbors(this.gridManager, { x, y })
        .map((neighbor) => `${neighbor.x},${neighbor.y}`));
      const neighborLanes = allLanes.filter((lane) => neighborTiles.has(`${lane.tileX},${lane.tileY}`));
      this.laneOverlay.show(lanes, neighborLanes);
      sections.push({
        title: roadShape === "t-junction" || roadShape === "cross" ? "Movimientos de la intersección" : "Carriles dirigidos",
        fields: lanes.length ? lanes.flatMap((lane) => [
          { label: "Entrada → salida", value: `${lane.entry === null ? "Extremo cerrado" : directions[lane.entry]} → ${lane.exit === null ? "Extremo cerrado" : directions[lane.exit]}` },
          { label: "Movimiento", value: { straight: "Recto", left: "Giro a la izquierda", right: "Giro a la derecha", terminal: "Acceso al extremo" }[lane.movement] },
          { label: "Longitud", value: `${lane.trajectory.length.toFixed(2)} m` },
          { label: "Continuidad", value: lane.exit === null ? "Fin del recorrido, sin retorno automático" : lane.nextLaneIds.length ? `Conecta con ${lane.nextLaneIds.join(", ")}` : "Sin continuación de carril" },
        ]) : [{ label: "Estado", value: "Pendiente de modelar movimientos para este tipo de carretera" }],
      });
    }
    this.inspection = {
      title: titles[tile.type],
      closeLabel: "Cerrar",
      sections,
    };
    this.selectionHighlight.show(x, y);
    this.notifyInspectionChange();
  }

  public clearInspection(): boolean {
    if (!this.inspection) return false;
    this.inspection = null;
    this.selectionHighlight.hide();
    this.laneOverlay.clear();
    this.notifyInspectionChange();
    return true;
  }

  public onInspectionChange(listener: (state: InspectionState | null) => void): () => void {
    this.inspectionListeners.add(listener);
    listener(this.inspection ? structuredClone(this.inspection) : null);
    return () => { this.inspectionListeners.delete(listener); };
  }

  private notifyInspectionChange(): void {
    for (const listener of this.inspectionListeners) {
      listener(this.inspection ? structuredClone(this.inspection) : null);
    }
  }

  public getNavigationState(): NavigationState {
    switch (this.screen) {
      case "main-menu":
        return { screen: "main-menu", menu: this.getMainMenuState() };
      case "settings":
        return { screen: "settings", settings: this.getSettingsState() };
      case "gameplay":
        return { screen: "gameplay", routeTest: this.getRouteTestState() };
    }
  }

  private getSettingsState(): SettingsState {
    return {
      title: "Ajustes",
      notice: "Vista previa: estas opciones son ejemplos y todavía no se pueden modificar ni aplicar.",
      backLabel: "Volver al menú",
      resetLabel: "Restablecer ajustes",
      activeTab: this.settingsTab,
      tabs: structuredClone(settingsTabs),
    };
  }

  public getMainMenuState(): MainMenuState {
    return {
      title: "Project Marble",
      description: "Empieza una ciudad desde cero.",
      notice: "Las partidas todavía no se pueden guardar.",
      options: [
        { id: "new-game", label: "Nueva partida" },
        { id: "load-game", label: "Cargar partida", disabled: true },
        { id: "scenario-editor", label: "Editor de escenarios", disabled: true },
        { id: "settings", label: "Ajustes" },
      ],
    };
  }

  public onNavigationChange(listener: (state: NavigationState) => void): () => void {
    this.navigationListeners.add(listener);
    listener(this.getNavigationState());
    return () => { this.navigationListeners.delete(listener); };
  }

  public executeMainMenuAction(actionId: MainMenuActionId): void {
    if (this.screen !== "main-menu" || this.confirmation) return;
    const option = this.getMainMenuState().options.find((item) => item.id === actionId);
    if (!option || option.disabled) return;

    switch (actionId) {
      case "settings":
        this.screen = "settings";
        this.notifyNavigationChange();
        break;
      case "new-game":
        if (this.options.testScenario) {
          populateTestScenario(this.gridManager);
          this.laneGraph = buildLaneGraph(this.gridManager);
          this.tileRenderer.renderAll();
        }
        this.simulationManager.resetClock();
        this.screen = "gameplay";
        this.modeManager.selectMode("construction");
        this.camera.alpha = INITIAL_CAMERA_ALPHA;
        this.camera.beta = INITIAL_CAMERA_BETA;
        this.camera.radius = INITIAL_CAMERA_RADIUS;
        if (this.options.testScenario) {
          this.modeManager.selectMode("normal");
          this.camera.radius = TEST_SCENARIO_CONFIG.cameraRadius;
        }
        this.camera.setTarget(Vector3.Zero());
        this.camera.attachControl(this.canvas, true);
        this.engine.resize();
        this.simulationManager.resume();
        this.notifyNavigationChange();
        break;
    }
  }

  private returnToMainMenu(): void {
    this.stopDiagnosticVehicle();
    this.activeTestRoute = null;
    this.routeOverlay.clear();
    this.clearInspection();
    this.simulationManager.pause();
    this.modeManager.selectMode("normal");
    this.camera.detachControl();
    this.vehicleManager.clear();
    this.vehicleRenderer.update([]);
    this.mobilityManager.clear();
    this.gridManager.clear();
    this.laneGraph = buildLaneGraph(this.gridManager);
    this.tileRenderer.dispose();
    this.pauseMenuOpen = false;
    this.wasPausedBeforeMenu = false;
    this.screen = "main-menu";
    this.notifyPauseMenuChange();
    this.notifyNavigationChange();
  }

  public selectSettingsTab(tab: SettingsTabId): void {
    if (this.screen !== "settings" || !settingsTabs.some((item) => item.id === tab)) return;
    this.settingsTab = tab;
    this.notifyNavigationChange();
  }

  public selectTestRoute(id: string): void {
    if (!this.options.testScenario || this.screen !== "gameplay" || this.pauseMenuOpen || this.confirmation) return;
    if (id === "circular-traffic") {
      if (this.diagnosticVehicleId) return;
      const circles = circularTestRoutes(this.laneGraph);
      if (circles.some((circle) => !circle.route)) {
        this.diagnosticStatus = "Algún circuito está cortado: vuelve a iniciar el escenario";
        this.notifyNavigationChange();
        return;
      }
      for (let i = 0; i < TEST_SCENARIO_CONFIG.circularVehicleCount; i++) {
        const circle = circles[i % circles.length];
        const vehicle = this.spawnCircularVehicle(circle.route!, circle.color, i);
        if (!vehicle) { this.stopDiagnosticVehicle("No hay espacio para iniciar los circuitos"); this.notifyNavigationChange(); return; }
        this.diagnosticVehicleIds.push(vehicle.id);
      }
      this.diagnosticVehicleId = this.diagnosticVehicleIds[0];
      this.activeTestRoute = "circular-traffic";
      this.diagnosticStatus = "Circuitos continuos: dos movimientos rectos y dos giros en (0, 0)";
      this.clearInspection();
      this.routeOverlay.showColoredRoutes(circles.map((circle) => ({
        color: circle.color, lanes: circle.route!.laneIds.map((laneId) => this.laneGraph.lanes.get(laneId)!),
      })));
      this.notifyNavigationChange();
      return;
    }
    if (id === "convoy") {
      if (this.activeTestRoute !== "following" || this.diagnosticVehicleId) return;
      const preset = testRoutes.find((item) => item.id === "following")!;
      const route = findLaneRoute(this.laneGraph, preset.start, preset.end);
      if (!route) return;
      if (route.laneIds.some((laneId) => {
        const lane = this.laneGraph.lanes.get(laneId)!;
        const shape = getRoadGeometry(this.gridManager, lane.tileX, lane.tileY).shape;
        return shape === "t-junction" || shape === "cross";
      })) {
        this.diagnosticStatus = "La prueba de seguimiento necesita una ruta sin intersecciones";
        this.notifyNavigationChange();
        return;
      }
      for (const [i, distance] of TEST_SCENARIO_CONFIG.convoyStartDistancesMeters.entries()) {
        const vehicle = this.vehicleManager.createLaneVehicle(this.laneGraph, route, VEHICLE_CONFIG.cruiseSpeedMetersPerSecond,
          { ...VEHICLE_DIMENSIONS, wheelbase: i === 0 ? TEST_SCENARIO_CONFIG.leaderWheelbaseMeters : VEHICLE_DIMENSIONS.wheelbase }, distance);
        if (!vehicle) { this.stopDiagnosticVehicle("No hay espacio para crear la cola"); this.notifyNavigationChange(); return; }
        vehicle.speed = 0;
        if (i === 0) vehicle.cruiseSpeed = 0;
        this.diagnosticVehicleIds.push(vehicle.id);
      }
      this.diagnosticVehicleId = this.diagnosticVehicleIds[0];
      this.diagnosticLeaderHeld = true;
      this.diagnosticStatus = `${this.diagnosticVehicleIds.length} vehículos · primero detenido · separación mínima de ${VEHICLE_CONFIG.minimumGapMeters} m`;
      this.notifyNavigationChange();
      return;
    }
    if (id === "toggle-leader") {
      const leader = this.vehicleManager.getVehicles().find((vehicle) => vehicle.id === this.diagnosticVehicleIds[0]);
      if (!leader || leader.kind !== "lane") return;
      this.diagnosticLeaderHeld = !this.diagnosticLeaderHeld;
      leader.cruiseSpeed = this.diagnosticLeaderHeld ? 0 : VEHICLE_CONFIG.cruiseSpeedMetersPerSecond;
      this.diagnosticStatus = this.diagnosticLeaderHeld ? "Frenando al primero; la cola espera detrás" : "Primero liberado; la cola reanuda la marcha";
      this.notifyNavigationChange();
      return;
    }
    if (id === "drive") {
      const route = this.selectedTestRoute();
      if (!route || this.diagnosticVehicleId) return;
      const circle = circularTestRoutes(this.laneGraph).find((item) => item.id === this.activeTestRoute);
      const vehicle = route.loop ? this.spawnCircularVehicle(route, circle?.color ?? "#39d9ff", 0)
        : this.vehicleManager.createLaneVehicle(this.laneGraph, route);
      this.diagnosticVehicleId = vehicle?.id ?? null;
      this.diagnosticStatus = vehicle ? `Vehículo en marcha · ${VEHICLE_CONFIG.cruiseSpeedMetersPerSecond} m/s` : "No se pudo iniciar el recorrido";
      this.notifyNavigationChange();
      return;
    }
    if (id === "stop") {
      this.stopDiagnosticVehicle();
      this.notifyNavigationChange();
      return;
    }
    if (id !== "clear" && !testRoutes.some((route) => route.id === id) && !circularTestRoutes(this.laneGraph).some((route) => route.id === id)) return;
    this.stopDiagnosticVehicle();
    this.clearInspection();
    this.activeTestRoute = id === "clear" ? null : id;
    this.refreshTestRoute();
  }

  private getRouteTestState(): RouteTestState | null {
    if (!this.options.testScenario) return null;
    const preset = testRoutes.find((item) => item.id === this.activeTestRoute);
    const route = this.selectedTestRoute();
    return {
      title: "Prueba de rutas por carriles",
      description: "Carreteras de prueba. Elige un recorrido; puedes borrar tramos para comprobar alternativas.",
      options: [
        ...testRoutes.map(({ id, label }) => ({ id, label })),
        ...circularTestRoutes(this.laneGraph).map(({ id, label }) => ({ id, label })),
        { id: "circular-traffic", label: `Iniciar ${TEST_SCENARIO_CONFIG.circularVehicleCount} coches en circuitos`, disabled: this.diagnosticVehicleId !== null },
        { id: "clear", label: "Ocultar ruta" },
        { id: "drive", label: "Recorrer ruta", disabled: !route || this.diagnosticVehicleId !== null },
        { id: "convoy", label: `Probar cola (${TEST_SCENARIO_CONFIG.convoyStartDistancesMeters.length} vehículos)`, disabled: this.activeTestRoute !== "following" || !route || this.diagnosticVehicleId !== null },
        { id: "toggle-leader", label: this.diagnosticLeaderHeld ? "Soltar primero" : "Detener primero", disabled: !this.diagnosticVehicleIds.length || this.activeTestRoute !== "following" },
        { id: "stop", label: "Retirar vehículo", disabled: this.diagnosticVehicleId === null },
      ],
      activeId: this.activeTestRoute,
      status: (route ? `${route.length.toFixed(2)} m · ${route.laneIds.length} trayectorias${route.loop ? " · circuito cerrado" : ""}`
        : this.activeTestRoute === "circular-traffic" ? `${this.diagnosticVehicleIds.length} coches en circuitos` : preset ? "Sin ruta disponible" : "Elige una ruta")
        + (this.diagnosticStatus ? ` · ${this.diagnosticStatus}` : "")
        + (this.diagnosticLapCount ? ` · ${this.diagnosticLapCount} vueltas completadas` : ""),
    };
  }

  private refreshTestRoute(): void {
    if (!this.options.testScenario) return;
    this.stopDiagnosticVehicle(this.diagnosticVehicleId ? "Recorrido cancelado al editar carreteras" : this.diagnosticStatus);
    const route = this.selectedTestRoute();
    this.routeOverlay.showRoute(route ? route.laneIds.map((id) => this.laneGraph.lanes.get(id)!) : []);
    this.notifyNavigationChange();
  }

  private stopDiagnosticVehicle(status = ""): void {
    if (this.diagnosticVehicleId) this.vehicleManager.removeVehicleForTest(this.diagnosticVehicleId);
    for (const id of this.diagnosticVehicleIds) this.vehicleManager.removeVehicleForTest(id);
    this.diagnosticVehicleIds = [];
    this.diagnosticLapCount = 0;
    this.diagnosticLeaderHeld = false;
    this.diagnosticVehicleId = null;
    this.diagnosticStatus = status;
  }

  private selectedTestRoute(): LaneRoute | null {
    const preset = testRoutes.find((item) => item.id === this.activeTestRoute);
    if (preset) return findLaneRoute(this.laneGraph, preset.start, preset.end);
    return circularTestRoutes(this.laneGraph).find((item) => item.id === this.activeTestRoute)?.route ?? null;
  }

  private spawnCircularVehicle(route: LaneRoute, color: string, index: number) {
    const override = TEST_SCENARIO_CONFIG.circularStartOverrides.find((item) => item.number === index + 1);
    if (override) {
      let start = 0;
      for (const id of route.laneIds) {
        const lane = this.laneGraph.lanes.get(id)!;
        if (lane.tileX === override.tileX && lane.tileY === override.tileY) {
          const vehicle = this.vehicleManager.createLaneVehicle(this.laneGraph, route, VEHICLE_CONFIG.cruiseSpeedMetersPerSecond,
            VEHICLE_DIMENSIONS, start + lane.trajectory.length * override.progress, true);
          if (vehicle) vehicle.color = color;
          return vehicle;
        }
        start += lane.trajectory.length;
      }
      return null;
    }
    const phases = TEST_SCENARIO_CONFIG.circularSpawnFractions;
    const wave = Math.floor(index / phases.length) / Math.ceil(TEST_SCENARIO_CONFIG.circularVehicleCount / phases.length);
    const initial = route.length * ((phases[index % phases.length] + wave) % 1);
    for (let offset = 0; offset < route.length; offset += TEST_SCENARIO_CONFIG.circularSpawnSearchStepMeters) {
      const vehicle = this.vehicleManager.createLaneVehicle(this.laneGraph, route, VEHICLE_CONFIG.cruiseSpeedMetersPerSecond,
        VEHICLE_DIMENSIONS, (initial + offset) % route.length);
      if (vehicle) { vehicle.color = color; return vehicle; }
    }
    return null;
  }

  public closeSettings(): void {
    if (this.screen !== "settings" || this.confirmation) return;
    this.screen = "main-menu";
    this.notifyNavigationChange();
  }

  public requestSettingsReset(): void {
    if (this.screen !== "settings" || this.confirmation) return;
    this.requestConfirmation({
      title: "¿Restablecer ajustes?",
      message: "Se restaurarán los valores predeterminados. Por ahora esta acción es una vista previa y no modifica ningún ajuste.",
      confirmLabel: "Restablecer",
      cancelLabel: "Cancelar",
      confirmVariant: "danger",
      onConfirm: () => {}, // Pendiente de implementar la configuración real.
      onCancel: () => {},
    });
  }

  private notifyNavigationChange(): void {
    const state = this.getNavigationState();
    for (const listener of this.navigationListeners) listener(state);
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
    this.selectionHighlight.dispose();
    this.laneOverlay.dispose();
    this.routeOverlay.dispose();
    this.tileRenderer.dispose();

    // Eventos UI.
    this.pauseMenuListeners.clear();
    this.inspectionListeners.clear();
    this.navigationListeners.clear();
    this.confirmation = null;
    this.confirmationListeners.clear();

    // Babylon.js.
    this.scene.dispose();
    this.engine.dispose();
  }

}
