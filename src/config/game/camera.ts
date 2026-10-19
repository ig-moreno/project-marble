// Parámetros internos de cámara; no son preferencias editables del jugador.
export const INITIAL_CAMERA_ALPHA = -Math.PI / 2;
export const INITIAL_CAMERA_BETA = 0.01;
export const INITIAL_CAMERA_RADIUS = 250;

export const CAMERA_CONFIG = {
  lowerBetaLimit: 0.01,
  upperBetaLimit: Math.PI / 2.4,
  lowerRadiusLimit: 20,
  upperRadiusLimit: 600,
  wheelPrecision: 20,
  zoomToMouseLocation: true,
} as const;
