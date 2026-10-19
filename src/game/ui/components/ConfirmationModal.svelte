<script lang="ts">
  import { onMount } from "svelte";
  import type { ConfirmationDialogState, ConfirmationResponse } from "../confirmation/types";

  let { dialog, onRespond }: {
    dialog: ConfirmationDialogState;
    onRespond: (response: ConfirmationResponse) => void;
  } = $props();

  const id = $props.id();
  let element: HTMLDialogElement;
  let cancelButton: HTMLButtonElement;

  onMount(() => {
    element.showModal();
    cancelButton.focus();
    return () => element.close();
  });
</script>

<dialog
  bind:this={element}
  aria-labelledby={`${id}-title`}
  aria-describedby={`${id}-message`}
  oncancel={(event) => {
    event.preventDefault();
    onRespond("cancel");
  }}
>
  <h2 id={`${id}-title`}>{dialog.title}</h2>
  <p id={`${id}-message`}>{dialog.message}</p>
  <div class="actions">
    <button bind:this={cancelButton} onclick={() => onRespond("cancel")}>{dialog.cancelLabel}</button>
    <button
      class="confirm"
      class:danger={dialog.confirmVariant === "danger"}
      onclick={() => onRespond("confirm")}
    >{dialog.confirmLabel}</button>
  </div>
</dialog>

<style>
  dialog {
    margin: auto;
    width: min(420px, calc(100% - 32px));
    max-height: calc(100% - 32px);
    overflow: auto;
    padding: 28px;
    border: 1px solid #40505c;
    border-radius: 14px;
    background: #202830;
    color: white;
    box-shadow: 0 20px 60px #0007;
  }
  dialog::backdrop { background: #0009; backdrop-filter: blur(5px); }
  h2 { margin: 0; font-size: 22px; font-weight: 700; }
  p { margin: 16px 0 24px; color: #b8c5cf; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; }
  button {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid #52616d;
    border-radius: 8px;
    background: #34424d;
    color: white;
    cursor: pointer;
  }
  button:hover { filter: brightness(1.15); }
  button:focus-visible { outline: 2px solid white; outline-offset: 3px; }
  .confirm { background: #358c69; border-color: #47a980; }
  .danger { background: #814044; border-color: #975354; }
</style>
