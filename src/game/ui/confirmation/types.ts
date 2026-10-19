export interface ConfirmationDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: "primary" | "danger";
}

export interface ConfirmationDialogRequest extends ConfirmationDialogState {
  onConfirm: () => void;
  onCancel: () => void;
}

export type ConfirmationResponse = "confirm" | "cancel";
