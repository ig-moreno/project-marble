<script lang="ts">
  import TilePicker from "./TilePicker.svelte";
  import InspectionPanel from "./InspectionPanel.svelte";
  import type { InspectionState } from "../inspection/types";
  import type { UIConfig } from "../types";
  import type { GameModeId } from "../../modes/GameMode";
  import type { ToolId } from "../../modes/construction/tools/types";

  let { uiConfig, activeMode, activeTool, onSelectMode, onSelectTool, inspection, onCloseInspection }: {
    inspection: InspectionState | null;
    onCloseInspection: () => void;
    uiConfig: UIConfig | null;
    activeMode: GameModeId;
    activeTool: ToolId | null;
    onSelectMode: (mode: GameModeId) => void;
    onSelectTool: (tool: ToolId) => void;
  } = $props();
</script>

  <div class="game-ui">
    <div class="mode-selector">
      {#each uiConfig?.availableModes ?? [] as mode (mode.id)}
        <button
          onclick={() => onSelectMode(mode.id)}
          disabled={mode.disabled ?? false}
          aria-pressed={activeMode === mode.id}
          style="pointer-events: auto;"
        >
          {mode.label}
        </button>
      {/each}
    </div>
    {#if activeMode === "construction" && uiConfig?.components.tilePicker}
      <TilePicker
        tools={uiConfig.availableTools}
        {activeTool}
        onSelect={onSelectTool}
      />
    {/if}

    {#if activeMode === "normal"}
      {#if inspection}
        <InspectionPanel {inspection} onClose={onCloseInspection} />
      {:else}
        <p class="inspection-hint">Haz clic en una baldosa para inspeccionarla.</p>
      {/if}
    {/if}
  </div>

<style>
.inspection-hint { margin: 12px; color: white; text-shadow: 0 1px 4px black; }
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

.mode-selector button[aria-pressed="true"] { border-color: #47a980; background: #358c69; }
.mode-selector button:disabled { opacity: 0.4; cursor: not-allowed; }

</style>
