
export type PauseMenuActionId =
  | "resume"
  | "settings"
  | "save"
  | "restart"
  | "exit";

export type PauseMenuContext =
  | "game"
  | "tutorial"
  | "editor";

export interface PauseMenuOption {
  id: PauseMenuActionId;
  label: string;
  disabled?: boolean;
  variant?: "primary" | "default" | "danger";
}

export interface PauseMenuState {
  open: boolean;
  options: PauseMenuOption[];
}
