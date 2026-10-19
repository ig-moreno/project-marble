// Preferencias del jugador, compartidas entre partidas.
// Estos valores todavía no se aplican ni se guardan; la UI sigue siendo una vista previa.
export interface Resolution {
  width: number;
  height: number;
}

export interface UserSettings {
  resolution: Resolution;
}

export const DEFAULT_USER_SETTINGS: Readonly<UserSettings> = {
  resolution: { width: 1920, height: 1080 },
};
