
import type { UIConfig } from "./types";

export class UIManager {
  constructor(private config: UIConfig) {}

  public getConfig(): UIConfig {
    return this.config;
  }
}
