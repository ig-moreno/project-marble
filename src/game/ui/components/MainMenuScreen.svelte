<script lang="ts">
  import type { MainMenuActionId, MainMenuState } from "../menu/types";
  let { menu, onSelect }: { menu: MainMenuState; onSelect: (action: MainMenuActionId) => void } = $props();
</script>

    <section class="session-menu" aria-labelledby="game-title">
      <div class="menu-card">
        <h1 id="game-title">{menu.title}</h1>
        <p>{menu.description}</p>
        {#each menu.options as option (option.id)}
          <button disabled={option.disabled ?? false} onclick={() => onSelect(option.id)}>
            {option.label}
          </button>
        {/each}
        <small>{menu.notice}</small>
      </div>
    </section>

<style>
.session-menu {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  overflow: auto;
  padding: 24px;
  background: #151e25;
  color: white;
}
.menu-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: min(100%, 380px);
  padding: 32px;
  border: 1px solid #40505c;
  border-radius: 14px;
  background: #202830;
  text-align: center;
}
.menu-card h1, .menu-card p { margin: 0; }
.menu-card h1 { font-size: 30px; font-weight: 700; }
.menu-card p, .menu-card small { color: #9caab5; }
.menu-card button {
  padding: 14px 18px;
  border: 1px solid #47a980;
  border-radius: 8px;
  background: #358c69;
  color: white;
  font-size: 16px;
  cursor: pointer;
}
.menu-card button:hover:not(:disabled) { background: #40a47b; }
.menu-card button:disabled { opacity: 0.4; cursor: not-allowed; }
.menu-card button:focus-visible { outline: 2px solid white; outline-offset: 4px; }

</style>
