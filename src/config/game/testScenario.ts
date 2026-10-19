export const TEST_ROUTES = [
  { id: "across", label: "Oeste → este", start: "-6,0:terminal", end: "6,0:west" },
  { id: "turn", label: "Oeste → ramal inferior", start: "-6,0:terminal", end: "0,-4:south" },
  { id: "loop", label: "Recorrido con curvas", start: "-4,-1:south", end: "4,-1:north" },
  { id: "unreachable", label: "Destino desconectado", start: "-6,0:terminal", end: "-6,4:east" },
  { id: "upper-loop", label: "Bucle superior", start: "2,5:south", end: "8,5:north" },
  { id: "long", label: "Ramal inferior → barrio superior", start: "0,-7:terminal", end: "8,6:west" },
  { id: "following", label: "Distancia de seguridad (sin cruces)", start: "-8,7:terminal", end: "8,8:west" },
] as const;

// Each route explicitly includes its movement at the shared intersection (0,0).
export const CIRCULAR_TEST_ROUTES = [
  { id: "circle-horizontal", label: "Circular: recto horizontal", color: "#39d9ff", waypoints: ["0,0:west->east", "4,0:west->north", "4,-3:south", "-4,-3:east", "-4,0:north->east"] },
  { id: "circle-vertical", label: "Circular: recto vertical", color: "#ffb347", waypoints: ["0,0:north->south", "0,3:north->west", "-4,3:east", "-4,-3:south", "0,-3:west->south"] },
  { id: "circle-right", label: "Circular: giro a la derecha", color: "#80ed99", waypoints: ["0,0:west->north", "0,-3:south->west", "-4,-3:east", "-4,0:north->east"] },
  { id: "circle-left", label: "Circular: giro a la izquierda", color: "#e879f9", waypoints: ["0,0:south->east", "4,0:west->south", "4,3:north->west", "0,3:east->north"] },
] as const;

export const TEST_SCENARIO_CONFIG = {
  minimumGridSize: 20,
  cameraRadius: 190,
  convoyStartDistancesMeters: [45, 25, 5],
  leaderWheelbaseMeters: 4.5,
  circularSpawnFractions: [0.25, 0.45, 0.65, 0.8],
  circularVehicleCount: 14,
  circularStartOverrides: [{ number: 13, tileX: 2, tileY: 0, progress: 0.5 }],
  circularSpawnSearchStepMeters: 2,
  roads: [
    [-6, 0, 6, 0],
    [0, -4, 0, 4],
    [-4, 0, -4, -3],
    [-4, -3, 4, -3],
    [4, -3, 4, 0],
    [-6, 4, -3, 4],
    [6, 0, 9, 0],
    [0, -4, 0, -7],
    [2, 0, 2, 6],
    [2, 6, 8, 6],
    [8, 6, 8, 0],
    [2, 3, 8, 3],
    [5, 3, 5, 6],
    [-8, 7, -6, 7],
    [-6, 7, -6, 8],
    [-6, 8, 8, 8],
    [-4, 0, -4, 3],
    [-4, 3, 4, 3],
    [4, 0, 4, 3],
  ],
} as const;
