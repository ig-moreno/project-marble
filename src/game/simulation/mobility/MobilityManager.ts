
import type { GridManager } from "../GridManager";
import type { Person } from "../people/Person";
import type { ScenarioBuilding } from "../../scenarios/TestScenario";
import type { VehicleManager } from "../vehicles/VehicleManager";

import { BuildingPathResolver } from "../buildings/BuildingPathResolver";

import type { Trip } from "./Trip";

export class MobilityManager {
  private readonly people = new Map<string, Person>();

  private readonly buildings = new Map<
    string,
    ScenarioBuilding
  >();

  private readonly trips = new Map<string, Trip>();
  private readonly unsubscribeVehicleArrived: () => void;

  private readonly pathResolver: BuildingPathResolver;

  private nextTripId = 1;

  constructor(
    grid: GridManager,
    private readonly vehicleManager: VehicleManager,
  ) {
    this.pathResolver = new BuildingPathResolver(grid);
    this.unsubscribeVehicleArrived =
      this.vehicleManager.onVehicleArrived(
        ({ vehicleId }) => {
          this.handleVehicleArrived(vehicleId);
        },
      );
  }

  public registerBuilding(
    building: ScenarioBuilding,
  ): void {
    this.buildings.set(building.id, building);
  }

  public registerPerson(person: Person): void {
    this.people.set(person.id, person);
  }

  
  public requestTrip(
    personId: string,
    destinationId: string,
  ): Trip | null {
    const person = this.people.get(personId);

    if (!person) return null;

    // No puede iniciar otro viaje mientras se desplaza.
    if (person.currentBuildingId === null) {
      return null;
    }

    // El destino debe existir y ser diferente del origen.
    const originId = person.currentBuildingId;

    if (originId === destinationId) {
      return null;
    }

    const origin = this.buildings.get(originId);
    const destination = this.buildings.get(destinationId);

    if (!origin || !destination) {
      return null;
    }

    const trip: Trip = {
      id: `trip-${this.nextTripId++}`,
      personId,
      originId,
      destinationId,
      status: "pending",
      vehicleId: null,
    };

    this.trips.set(trip.id, trip);

    // Calcular la ruta sobre la red actual.
    const path = this.pathResolver.findPath(
      { x: origin.x, y: origin.y },
      { x: destination.x, y: destination.y },
    );

    if (!path || path.length < 2) {
      trip.status = "unreachable";
      return trip;
    }

    const vehicle = this.vehicleManager.createVehicle(
      path[0],
      path[path.length - 1],
    );

    if (!vehicle) {
      trip.status = "unreachable";
      return trip;
    }

    trip.vehicleId = vehicle.id;
    trip.status = "in_progress";

    // La persona deja de estar en el edificio.
    person.currentBuildingId = null;

    return trip;
  }

  public requestWorkTrip(
    personId: string,
  ): Trip | null {
    const person = this.people.get(personId);

    if (!person) return null;

    return this.requestTrip(
      personId,
      person.workplaceId,
    );
  }

  public requestHomeTrip(
    personId: string,
  ): Trip | null {
    const person = this.people.get(personId);

    if (!person) return null;

    return this.requestTrip(
      personId,
      person.homeId,
    );
  }

  
  private handleVehicleArrived(
    vehicleId: string,
  ): void {
    const trip = [...this.trips.values()].find(
      (item) =>
        item.vehicleId === vehicleId &&
        item.status === "in_progress",
    );

    if (!trip) return;

    trip.status = "completed";

    const person = this.people.get(trip.personId);

    if (person) {
      person.currentBuildingId = trip.destinationId;
    }

    console.log(
      `Viaje ${trip.id}: completed`,
      `Destino: ${trip.destinationId}`,
    );
  }

  public getTrip(id: string): Trip | undefined {
    return this.trips.get(id);
  }

  public getTrips(): Trip[] {
    return [...this.trips.values()];
  }

  public dispose(): void {
    this.unsubscribeVehicleArrived();
    this.people.clear();
    this.buildings.clear();
    this.trips.clear();
  }
}
