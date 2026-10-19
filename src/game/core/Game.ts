
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
} from "babylonjs";

import { GridManager } from "../simulation/GridManager";
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

const INITIAL_CAMERA_ALPHA = -Math.PI / 2;
const INITIAL_CAMERA_BETA = 0.01;
const INITIAL_CAMERA_RADIUS = 250;

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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // --------------------------------------------------
    // Mundo lógico
    // --------------------------------------------------

    this.gridManager = new GridManager(20, 20);
    this.laneGraph = buildLaneGraph(this.gridManager);
    // Una partida nueva comienza con el mapa vacío.

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

    this.selectionHighlight = new TileHighlight(
      this.scene, this.gridManager.width, this.gridManager.height, 0.16,
    );
    this.laneOverlay = new LaneOverlayRenderer(this.scene, this.gridManager.width, this.gridManager.height);

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
    camera.lowerBetaLimit = 0.01;
    camera.upperBetaLimit = Math.PI / 2.4;

    // Límites del zoom.
    camera.lowerRadiusLimit = 20;   // Máximo acercamiento.
    camera.upperRadiusLimit = 600;  // Máximo alejamiento.

    // Sensibilidad del zoom con la rueda del ratón.
    camera.wheelPrecision = 20;

    camera.attachControl(this.canvas, true);

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
      const connections = (Object.keys(directions) as RoadDirection[])
        .filter((direction) => tile.roadConnections[direction])
        .map((direction) => directions[direction]);
      sections.push({
        title: "Trazado",
        fields: [
          { label: "Tipo", value: shapes[getRoadGeometry(this.gridManager, x, y).shape] },
          { label: `Conexiones (${connections.length})`, value: connections.join(", ") || "Sin conexiones" },
        ],
      });
      const lanes = [...this.laneGraph.lanes.values()].filter((lane) => lane.tileX === x && lane.tileY === y);
      this.laneOverlay.show(lanes);
      sections.push({
        title: "Carriles dirigidos",
        fields: lanes.length ? lanes.flatMap((lane) => [
          { label: "Entrada → salida", value: `${directions[lane.entry]} → ${directions[lane.exit]}` },
          { label: "Longitud", value: `${lane.trajectory.length.toFixed(2)} m` },
          { label: "Continuidad", value: lane.nextLaneId ? `Conecta con ${lane.nextLaneId}` : "Sin continuación de carril" },
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
        return { screen: "gameplay" };
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
        this.simulationManager.resetClock();
        this.screen = "gameplay";
        this.modeManager.selectMode("construction");
        this.camera.alpha = INITIAL_CAMERA_ALPHA;
        this.camera.beta = INITIAL_CAMERA_BETA;
        this.camera.radius = INITIAL_CAMERA_RADIUS;
        this.camera.setTarget(Vector3.Zero());
        this.camera.attachControl(this.canvas, true);
        this.engine.resize();
        this.simulationManager.resume();
        this.notifyNavigationChange();
        break;
    }
  }

  private returnToMainMenu(): void {
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
