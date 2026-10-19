// El reloj de la ciudad no cambia los segundos físicos usados por el tráfico.
export const SIMULATION_CONFIG = {
  fixedDeltaSeconds: 1 / 60,
  maxFrameDeltaSeconds: 0.1,
  dayDurationSeconds: 30 * 60,
  initialClockMinutes: 6 * 60,
  clockStepMinutes: 10,
} as const;

export const VEHICLE_CONFIG = {
  legacySpeedTilesPerSecond: 1.5,
  cruiseSpeedMetersPerSecond: 5,
  minimumGapMeters: 2,
  queueReactionTimeSeconds: 0.5,
  accelerationMetersPerSecondSquared: 2,
  brakingMetersPerSecondSquared: 3,
  stoppedSpeedMetersPerSecond: 0.05,
  restartClearanceMeters: 0.1,
  followingReactionTimeSeconds: 0.5,
} as const;

// Dimensiones físicas en metros; independientes de la representación visual.
export const VEHICLE_DIMENSIONS = {
  wheelbase: 2.6, frontOverhang: 0.7, rearOverhang: 0.7, width: 1.8, height: 1.3,
} as const;

// Precisión numérica al situar el eje trasero sobre el trazado.
export const AXLE_SOLVER_CONFIG = {
  maxSearchStepMeters: 0.25,
  stepsPerWheelbase: 8,
  bisectionIterations: 40,
} as const;

// Reservas provisionales por movimiento; todavía no definen prioridades de señales.
export const INTERSECTION_CONFIG = {
  lookaheadMeters: 20,
  requestDistanceMeters: 10,
  stopMarginMeters: 0.3,
  clearanceMeters: 0.2,
  conflictSampleStepMeters: 0.25,
  exitSpaceMarginMeters: 0.2,
  approachTimeBufferSeconds: 0.6,
  unknownClearanceApproachSeconds: 3,
} as const;
