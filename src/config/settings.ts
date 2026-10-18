export interface Resolution {
  width: number
  height: number
}

export const MIN_RESOLUTION: Resolution = {
  width: 1280,
  height: 720
}

export const APP_SETTINGS = {
  minResolution: MIN_RESOLUTION,
  defaultResolution: { width: 1920, height: 1080 } as Resolution
} as const

export type AppSettings = typeof APP_SETTINGS