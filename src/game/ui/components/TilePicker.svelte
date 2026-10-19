
<script lang="ts">
  import type { ToolId } from "../../modes/construction/tools/types"; 
  interface Props {
    tools: ToolId[];
    activeTool: ToolId | null;
    onSelect: (tool: ToolId) => void;
  }

  let { tools, activeTool, onSelect }: Props = $props();

  const labels: Record<ToolId, string> = {
    road: "Carretera",
    house: "Casa",
    factory: "Fábrica",
    forest: "Bosque",
    mineral: "Mineral",
    erase: "Borrar",
  };
</script>

<div class="tile-picker">
  {#each tools as tool}
    <button
      class:active={activeTool === tool}
      onclick={() => onSelect(tool)}
    >
      {labels[tool]}
    </button>
  {/each}
</div>

<style>
  .tile-picker {
    display: flex;
    gap: 8px;
    padding: 12px;
    background: #252b30;
    border-radius: 8px;
    pointer-events: auto;
  }

  button {
    padding: 10px 14px;
    border: 1px solid #55616b;
    border-radius: 6px;
    background: #39434b;
    color: white;
    cursor: pointer;
  }

  button.active {
    background: #397d65;
    border-color: #6dd5a4;
  }
</style>
