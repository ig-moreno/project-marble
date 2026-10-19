
export interface VehicleArrivedEvent {
  vehicleId: string;
}

export type VehicleArrivedListener = (
  event: VehicleArrivedEvent,
) => void;
