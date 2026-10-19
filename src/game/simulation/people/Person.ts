export interface Person {
  id: string;
  homeId: string;
  workplaceId: string;

  // ID del edificio donde se encuentra actualmente.
  // null significa que está desplazándose.
  currentBuildingId: string | null;
}
