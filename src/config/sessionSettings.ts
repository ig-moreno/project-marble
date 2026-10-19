// Opciones propias de cada partida. Las futuras reglas económicas irán aquí
// cuando exista su modelo; no forman parte de las preferencias del jugador.
export interface SessionSettings {
  readonly worldTilesX: number;
  readonly worldTilesY: number;
}

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  worldTilesX: 60,
  worldTilesY: 20,
};
