
<script lang="ts">
  import type {
    PauseMenuActionId,
    PauseMenuOption,
  } from "../pause/types";

  interface Props {
    options: PauseMenuOption[];
    onSelect: (id: PauseMenuActionId) => void;
  }

  let {
    options,
    onSelect,
  }: Props = $props();
</script>

<div class="pause-overlay">
  <div
    class="pause-menu"
    role="dialog"
    aria-modal="true"
    aria-labelledby="pause-title"
  >
    <div class="menu-header">
      <h1 id="pause-title">PAUSA</h1>
      <p>El juego está pausado</p>
    </div>

    <div class="menu-actions">
      {#each options as option (option.id)}
        <button
          class:primary={option.variant === "primary"}
          class:danger={option.variant === "danger"}
          disabled={option.disabled ?? false}
          onclick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .pause-overlay {
    position: absolute;
    inset: 0;
    z-index: 1000;

    display: flex;
    align-items: center;
    justify-content: center;

    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(5px);

    pointer-events: auto;
  }

  .pause-menu {
    display: flex;
    flex-direction: column;
    gap: 28px;

    width: 320px;
    max-width: calc(100% - 32px);
    padding: 32px;

    background: #202830;
    border: 1px solid #40505c;
    border-radius: 14px;

    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    color: white;
  }

  .menu-header {
    text-align: center;
  }

  .menu-header h1 {
    margin: 0;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 4px;
  }

  .menu-header p {
    margin: 10px 0 0;
    color: #9caab5;
    font-size: 13px;
  }

  .menu-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  button {
    width: 100%;
    padding: 14px 18px;

    background: #34424d;
    color: white;

    border: 1px solid #52616d;
    border-radius: 8px;

    font-size: 15px;
    font-weight: 500;

    cursor: pointer;

    transition:
      background 0.15s ease,
      transform 0.15s ease;
  }

  button:hover:not(:disabled) {
    background: #465967;
    transform: translateY(-1px);
  }

  button:active:not(:disabled) {
    transform: translateY(0);
  }

  button.primary {
    background: #358c69;
    border-color: #47a980;
  }

  button.primary:hover:not(:disabled) {
    background: #40a47b;
  }

  button.danger {
    border-color: #975354;
  }

  button.danger:hover:not(:disabled) {
    background: #814044;
  }

  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
