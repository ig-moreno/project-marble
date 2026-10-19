export type SettingsTabId = "general" | "graphics" | "audio" | "controls";

export interface SettingsTab {
  id: SettingsTabId;
  label: string;
  sections: {
    title: string;
    description: string;
    fields: { label: string; preview: string }[];
  }[];
}

export interface SettingsState {
  title: string;
  notice: string;
  backLabel: string;
  resetLabel: string;
  activeTab: SettingsTabId;
  tabs: SettingsTab[];
}
