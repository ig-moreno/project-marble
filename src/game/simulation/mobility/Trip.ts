
export type TripStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "unreachable";

export interface Trip {
  id: string;
  personId: string;
  originId: string;
  destinationId: string;
  status: TripStatus;
  vehicleId: string | null;
}
