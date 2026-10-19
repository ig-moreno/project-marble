<script lang="ts">
  import { onMount } from "svelte";
  import { SIMULATION_CONFIG } from "../../../config/game/simulation";
  import type { Game } from "../../core/Game";
  import GameplayUI from "./GameplayUI.svelte";
  import MainMenuScreen from "./MainMenuScreen.svelte";
  import RouteTestPanel from "./RouteTestPanel.svelte";

  import type { ToolId } from "../../modes/construction/tools/types";
  import type { UIConfig } from "../../ui/types";
  import type { GameModeId } from "@/game/modes/GameMode";
  import PauseMenu from "./PauseMenu.svelte";
  import ConfirmationModal from "./ConfirmationModal.svelte";
  import SettingsScreen from "./SettingsScreen.svelte";
  import type { ConfirmationDialogState } from "../confirmation/types";

  import type { PauseMenuOption } from "../../ui/pause/types";

  import type { NavigationState } from "../navigation/types";
  import type { InspectionState } from "../inspection/types";

  let { game }: { game: Game } = $props();

  let uiConfig = $state<UIConfig | null>(null);
  let activeMode = $state<GameModeId>("construction");
  let activeTool = $state<ToolId | null>(null);
  let pauseMenuOpen = $state(false);
  let pauseMenuOptions = $state<PauseMenuOption[]>([]);
  let confirmation = $state<ConfirmationDialogState | null>(null);
  let navigation = $state<NavigationState | null>(null);
  let inspection = $state<InspectionState | null>(null);
  let clockMinutes = $state<number>(SIMULATION_CONFIG.initialClockMinutes);

  function selectTool(tool: ToolId): void {
    game.selectTool(tool);
    activeTool = game.getActiveTool();
  }

  function selectMode(mode: GameModeId): void {
    game.selectMode(mode);
    activeMode = game.getActiveMode() ?? "construction";
    activeTool = game.getActiveTool();
  }

  onMount(() => {
    const unsubscribeClock = game.onClockChange((minutes) => { clockMinutes = minutes; });
    const unsubscribeInspection = game.onInspectionChange((state) => { inspection = state; });
    uiConfig = game.getUIConfig();
    activeTool = game.getActiveTool();

    const unsubscribePause = game.onPauseMenuChange(
      (state) => {
        pauseMenuOpen = state.open;
        pauseMenuOptions = state.options;
      },
    );

    const unsubscribeConfirmation = game.onConfirmationChange((state) => {
      confirmation = state;
    });

    const unsubscribeNavigation = game.onNavigationChange((state) => {
      navigation = state;
      activeMode = game.getActiveMode() ?? "construction";
      activeTool = game.getActiveTool();
    });

    return () => {
      unsubscribeClock();
      unsubscribePause();
      unsubscribeInspection();
      unsubscribeConfirmation();
      unsubscribeNavigation();
    };
  });

</script>

{#if navigation?.screen === "main-menu"}
  <MainMenuScreen menu={navigation.menu} onSelect={(action) => game.executeMainMenuAction(action)} />
{:else if navigation?.screen === "settings"}
  <SettingsScreen
    settings={navigation.settings}
    onSelectTab={(tab) => game.selectSettingsTab(tab)}
    onBack={() => game.closeSettings()}
    onReset={() => game.requestSettingsReset()}
  />
{:else if navigation?.screen === "gameplay"}
  {#if navigation.routeTest}
    <RouteTestPanel state={navigation.routeTest} onSelect={(id) => game.selectTestRoute(id)} />
  {/if}
  <GameplayUI {game} {uiConfig} {activeMode} {activeTool} {inspection} {clockMinutes} onCloseInspection={() => game.clearInspection()} onSelectMode={selectMode} onSelectTool={selectTool} />
{/if}

{#if pauseMenuOpen}
  <PauseMenu options={pauseMenuOptions} onSelect={(action) => game.executePauseMenuAction(action)} />
{/if}
{#if confirmation}
  <ConfirmationModal dialog={confirmation} onRespond={(response) => game.respondToConfirmation(response)} />
{/if}
