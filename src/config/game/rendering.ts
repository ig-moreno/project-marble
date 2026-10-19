// Parámetros técnicos del renderizador, independientes de las preferencias del usuario.
export const RENDERING_CONFIG = {
  antialias: true,
  preserveDrawingBuffer: true,
  stencil: true,
  hemisphericLightIntensity: 0.7,
} as const;

export const MIN_RESOLUTION = { width: 1280, height: 720 } as const;
