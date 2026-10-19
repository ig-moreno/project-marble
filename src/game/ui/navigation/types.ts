import type { MainMenuState } from "../menu/types";
import type { SettingsState } from "../settings/types";
import type { RouteTestState } from "../../scenarios/TestScenario";

export type NavigationState =
  | { screen: "main-menu"; menu: MainMenuState }
  | { screen: "settings"; settings: SettingsState }
  | { screen: "gameplay"; routeTest: RouteTestState | null };

export type GameScreen = NavigationState["screen"];
