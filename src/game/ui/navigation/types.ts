import type { MainMenuState } from "../menu/types";
import type { SettingsState } from "../settings/types";

export type NavigationState =
  | { screen: "main-menu"; menu: MainMenuState }
  | { screen: "settings"; settings: SettingsState }
  | { screen: "gameplay" };

export type GameScreen = NavigationState["screen"];
