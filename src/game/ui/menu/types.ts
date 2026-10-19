export type MainMenuActionId = "new-game" | "load-game" | "scenario-editor" | "settings";

export interface MainMenuState {
  title: string;
  description: string;
  notice: string;
  options: { id: MainMenuActionId; label: string; disabled?: boolean }[];
}
