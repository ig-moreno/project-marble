<script lang="ts">
  import { onMount } from "svelte";
  import { Game } from "../../core/Game";
  import GameUI from "./GameUI.svelte";

  let canvas: HTMLCanvasElement;
  let game = $state<Game | null>(null);

  onMount(() => {
    const testScenario = import.meta.env.DEV && new URLSearchParams(window.location.search).get("scenario") === "test";
    const instance = new Game(canvas, { testScenario });
    game = instance;
    return () => instance.dispose();
  });
</script>

<div class="game-container">
  <canvas bind:this={canvas}></canvas>
  {#if game}
    <GameUI {game} />
  {/if}
</div>

<style>
  .game-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  canvas { display: block; width: 100%; height: 100%; }
</style>
