<script lang="ts">
  import { onMount } from "svelte";
  import type { Game } from "../../core/Game";

  let { game }: { game: Game } = $props();
  let selected = $state<1 | 2 | 4>(1);

  onMount(() => {
    selected = game.getSimulationSpeed();
  });
</script>

<div class="speed-controls" role="group" aria-label="Velocidad de simulaci?n">
  {#each game.getSimulationSpeedOptions() as option (option.speed)}
    <button
      type="button"
      title={option.label}
      aria-label={option.label}
      aria-pressed={selected === option.speed}
      onclick={() => {
        selected = option.speed;
        game.setSimulationSpeed(selected);
      }}
    >{option.icon}</button>
  {/each}
</div>

<style>
  .speed-controls { display: flex; gap: 4px; pointer-events: auto; }
  button {
    min-width: 38px;
    padding: 7px;
    border: 1px solid #55616b;
    border-radius: 4px;
    background: #252b30;
    color: white;
    cursor: pointer;
    touch-action: none;
    user-select: none;
  }
  button[aria-pressed="true"] { border-color: #47a980; background: #358c69; }
  button:focus-visible { outline: 2px solid white; outline-offset: 2px; }
</style>
