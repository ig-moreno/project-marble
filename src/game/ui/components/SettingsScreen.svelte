<script lang="ts">
  import type { SettingsState, SettingsTabId } from "../settings/types";

  let { settings, onSelectTab, onBack, onReset }: {
    settings: SettingsState;
    onSelectTab: (tab: SettingsTabId) => void;
    onBack: () => void;
    onReset: () => void;
  } = $props();

  const id = $props.id();
  const activeTab = $derived(settings.tabs.find((tab) => tab.id === settings.activeTab));

  function navigateTabs(event: KeyboardEvent, index: number): void {
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + 1) % settings.tabs.length; break;
      case "ArrowLeft": next = (index + settings.tabs.length - 1) % settings.tabs.length; break;
      case "Home": next = 0; break;
      case "End": next = settings.tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const tab = settings.tabs[next];
    onSelectTab(tab.id);
    document.getElementById(`${id}-tab-${tab.id}`)?.focus();
  }
</script>

<section class="settings-screen" aria-labelledby={`${id}-title`}>
  <div class="settings-card">
    <header>
      <h1 id={`${id}-title`}>{settings.title}</h1>
      <button onclick={onBack}>{settings.backLabel}</button>
    </header>
    <p class="notice">{settings.notice}</p>
    <div class="tabs" role="tablist" aria-label={settings.title}>
      {#each settings.tabs as tab, index (tab.id)}
        <button
          id={`${id}-tab-${tab.id}`}
          role="tab"
          aria-selected={tab.id === settings.activeTab}
          aria-controls={`${id}-panel-${tab.id}`}
          tabindex={tab.id === settings.activeTab ? 0 : -1}
          onclick={() => onSelectTab(tab.id)}
          onkeydown={(event) => navigateTabs(event, index)}
        >{tab.label}</button>
      {/each}
    </div>
    {#each settings.tabs as tab (tab.id)}
      <div
        id={`${id}-panel-${tab.id}`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${tab.id}`}
        hidden={tab.id !== settings.activeTab}
        tabindex="0"
      >
        {#if tab.id === activeTab?.id}
          {#each tab.sections as section}
            <section class="settings-section">
              <h2>{section.title}</h2>
              <p>{section.description}</p>
              {#each section.fields as field}
                <label class="setting-row">
                  <span>{field.label}</span>
                  <input disabled value={field.preview} />
                </label>
              {/each}
            </section>
          {/each}
        {/if}
      </div>
    {/each}
    <footer>
      <button class="danger" onclick={onReset}>{settings.resetLabel}</button>
    </footer>
  </div>
</section>

<style>
  .settings-screen {
    position: absolute;
    inset: 0;
    z-index: 20;
    overflow: auto;
    padding: 32px 20px;
    background: #151e25;
    color: white;
  }
  .settings-card { max-width: 800px; margin: 0 auto; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: 30px; font-weight: 700; }
  .notice { margin: 24px 0; padding: 16px; border: 1px solid #40505c; border-radius: 8px; color: #b8c5cf; }
  button { padding: 12px 18px; border: 1px solid #52616d; border-radius: 8px; background: #252f38; color: white; cursor: pointer; }
  button:hover { background: #34424d; }
  button.danger { background: #814044; border-color: #975354; }
  button.danger:hover { background: #975054; }
  button:focus-visible, [role="tabpanel"]:focus-visible { outline: 2px solid #70c9a2; outline-offset: 3px; }
  .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
  [role="tab"][aria-selected="true"] { background: #358c69; border-color: #47a980; }
  .settings-section { margin-bottom: 20px; padding: 24px; border: 1px solid #40505c; border-radius: 12px; background: #202830; }
  h2 { margin: 0; font-size: 19px; font-weight: 600; }
  .settings-section p { margin: 8px 0 20px; color: #9caab5; }
  .setting-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 12px 0; border-top: 1px solid #35434f; }
  input { width: 160px; max-width: 100%; padding: 9px 12px; border: 1px solid #40505c; border-radius: 6px; background: #182129; color: #9caab5; cursor: not-allowed; }
</style>
