
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Game } from "../../core/Game";
  import TilePicker from "./TilePicker.svelte";

  import type { ToolId } from '../../tools/types';
  import type { UIConfig } from "../../ui/types";
  import type { GameModeId } from "@/game/modes/GameMode";

  let canvas: HTMLCanvasElement;

  let game: Game | null = null;

  let uiConfig = $state<UIConfig | null>(null);
  let activeMode = $state<GameModeId>("construction");
  let activeTool = $state<ToolId | null>(null);

  function selectTool(tool: ToolId): void {
    if (!game) return;

    game.selectTool(tool);
    activeTool = game.getActiveTool();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    game?.onKeyDown(event);
  }

  function selectMode(mode: GameModeId): void {
    game?.selectMode(mode);
    activeMode = mode;
  }


  onMount(() => {
    game = new Game(canvas);

    uiConfig = game.getUIConfig();
    activeTool = game.getActiveTool();

    

    window.addEventListener("keydown", handleKeyDown);


    return () => {
      game?.dispose();
      game = null;
    };
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeyDown);
  })
</script>

<div class="game-container">
  <canvas bind:this={canvas}></canvas>

  <div class="game-ui">
    <div class="mode-selector">
      <button onclick={() => selectMode("normal")}>
        Normal
      </button>

      <button onclick={() => selectMode("construction")}>
        Construcción
      </button>
    </div>

    {#if activeMode === "construction" && uiConfig?.components.tilePicker}
      <TilePicker
        tools={uiConfig.availableTools}
        {activeTool}
        onSelect={selectTool}
      />
    {/if}
  </div>
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
  top: 16px;
  left: 16px;
  z-index: 10;

  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
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
