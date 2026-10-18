
<script lang="ts">
  import { onMount } from "svelte";
  import { Game } from "../../core/Game";
  import TilePicker from "./TilePicker.svelte";

  import type { ToolId } from "../../modes/construction/tools/types";
  import type { UIConfig } from "../../ui/types";
  import type { GameModeId } from "@/game/modes/GameMode";
  import PauseMenu from "./PauseMenu.svelte";

  import type { PauseMenuOption } from "../../ui/pause/types";




  let canvas: HTMLCanvasElement;

  let game: Game | null = null;

  let uiConfig = $state<UIConfig | null>(null);
  let activeMode = $state<GameModeId>("construction");
  let activeTool = $state<ToolId | null>(null);
  let pauseMenuOpen = $state(false);
  let pauseMenuOptions = $state<PauseMenuOption[]>([]);

  function selectTool(tool: ToolId): void {
    if (!game) return;

    game.selectTool(tool);
    activeTool = game.getActiveTool();
  }

  function selectMode(mode: GameModeId): void {
    game?.selectMode(mode);
    activeMode = mode;
  }


  onMount(() => {
    game = new Game(canvas);

    uiConfig = game.getUIConfig();
    activeTool = game.getActiveTool();

    const unsubscribePause = game.onPauseMenuChange(
      (state) => {
        pauseMenuOpen = state.open;
        pauseMenuOptions = state.options;
      },
    );



    return () => {
      game?.dispose();
      game = null;
      unsubscribePause();
    };
  });


</script>

<div class="game-container">
  <canvas bind:this={canvas}></canvas>

  <div class="game-ui">
    <div class="mode-selector">
      <button onclick={() => selectMode("normal")} style="pointer-events: auto;">
        Normal
      </button>

      <button onclick={() => selectMode("construction")}  style="pointer-events: auto;">
        Construcción
      </button>
    </div>
    <button onclick={() => game?.spawnTestVehicle()}>
      🚗 Crear vehículo
    </button>

    {#if activeMode === "construction" && uiConfig?.components.tilePicker}
      <TilePicker
        tools={uiConfig.availableTools}
        {activeTool}
        onSelect={selectTool}
      />
    {/if}

    

  </div>
  {#if pauseMenuOpen}
    <PauseMenu
      options={pauseMenuOptions}
      onSelect={(actionId) => {
        game?.executePauseMenuAction(actionId);
      }}
    />
  {/if}
</div>

<style>
.game-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.game-ui {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 10;

  pointer-events: none;
}

.mode-selector {
  display: flex;
  gap: 8px;
}

.mode-selector button {
  padding: 10px 14px;
  border: 1px solid #55616b;
  border-radius: 6px;
  background: #252b30;
  color: white;
  cursor: pointer;
}

</style>
