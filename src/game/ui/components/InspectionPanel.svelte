<script lang="ts">
  import type { InspectionState } from "../inspection/types";
  let { inspection, onClose }: { inspection: InspectionState; onClose: () => void } = $props();
  const id = $props.id();
</script>

<aside aria-labelledby={`${id}-title`}>
  <header><h2 id={`${id}-title`}>{inspection.title}</h2><button onclick={onClose}>{inspection.closeLabel}</button></header>
  {#each inspection.sections as section}
    <section>
      <h3>{section.title}</h3>
      <dl>
        {#each section.fields as field}
          <dt>{field.label}</dt><dd>{field.value}</dd>
        {/each}
      </dl>
    </section>
  {/each}
</aside>

<style>
  aside { position: absolute; top: 64px; right: 16px; width: min(300px, calc(100% - 32px)); max-height: calc(100% - 80px); overflow: auto; pointer-events: auto; padding: 20px; border: 1px solid #40505c; border-radius: 12px; background: #202830; color: white; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  h2 { margin: 0; font-size: 20px; font-weight: 600; }
  button { padding: 6px 10px; border: 1px solid #52616d; border-radius: 6px; background: #34424d; color: white; cursor: pointer; }
  button:focus-visible { outline: 2px solid #70c9a2; outline-offset: 3px; }
  h3 { margin: 20px 0 0; font-size: 15px; font-weight: 600; }
  dl { margin: 12px 0 0; }
  dt { margin-top: 14px; color: #9caab5; font-size: 13px; }
  dd { margin: 4px 0 0; }
</style>
