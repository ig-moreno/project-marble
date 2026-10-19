<script lang="ts">
  import type { RouteTestState } from "../../scenarios/TestScenario";
  let { state, onSelect }: { state: RouteTestState; onSelect: (id: string) => void } = $props();
</script>

<aside aria-label={state.title}>
  <h2>{state.title}</h2>
  <p>{state.description}</p>
  <div class="actions">
    {#each state.options as option (option.id)}
      <button disabled={option.disabled ?? false} aria-pressed={state.activeId === option.id} onclick={() => onSelect(option.id)}>{option.label}</button>
    {/each}
  </div>
  <p role="status">{state.status}</p>
</aside>

<style>
  aside { position: absolute; left: 16px; bottom: 16px; z-index: 15; width: min(360px, calc(100% - 32px)); max-height: 45%; overflow: auto; padding: 16px; border: 1px solid #52616d; border-radius: 12px; background: #202830ed; color: white; }
  h2 { margin: 0; font-size: 17px; font-weight: 600; }
  p { margin: 10px 0; font-size: 13px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  button { padding: 8px; border: 1px solid #52616d; border-radius: 6px; background: #34424d; color: white; cursor: pointer; }
  button[aria-pressed="true"] { border-color: #39d9ff; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  button:focus-visible { outline: 2px solid #39d9ff; outline-offset: 2px; }
</style>
