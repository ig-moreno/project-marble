
import type { GridManager } from "../GridManager";

import type { Vehicle } from "./Vehicle";
import {
  findRoadPath,
  type RoadPosition,
} from "./RoadPathFinder";

export class VehicleManager {
  private readonly vehicles = new Map<string, Vehicle>();
  private nextId = 1;

  constructor(private readonly grid: GridManager) {}

  createVehicle(
    start: RoadPosition,
    destination: RoadPosition,
  ): Vehicle | null {
    const path = findRoadPath(
      this.grid,
      start,
      destination,
    );

    if (!path || path.length < 2) {
      return null;
    }

    const vehicle: Vehicle = {
      id: `vehicle-${this.nextId++}`,
      x: start.x,
      y: start.y,
      speed: 1.5,
      path,
      targetIndex: 1,
    };

    this.vehicles.set(vehicle.id, vehicle);

    return vehicle;
  }

  update(deltaTime: number): void {
    for (const vehicle of this.vehicles.values()) {
      this.updateVehicle(vehicle, deltaTime);
    }
  }

  private updateVehicle(
    vehicle: Vehicle,
    deltaTime: number,
  ): void {
    let remainingDistance = vehicle.speed * deltaTime;

    while (
      remainingDistance > 0 &&
      vehicle.targetIndex < vehicle.path.length
    ) {
      const target = vehicle.path[vehicle.targetIndex];

      const dx = target.x - vehicle.x;
      const dy = target.y - vehicle.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= remainingDistance) {
        vehicle.x = target.x;
        vehicle.y = target.y;

        remainingDistance -= distance;
        vehicle.targetIndex++;
      } else {
        const ratio = remainingDistance / distance;

        vehicle.x += dx * ratio;
        vehicle.y += dy * ratio;

        remainingDistance = 0;
      }
    }

    if (vehicle.targetIndex >= vehicle.path.length) {
      this.vehicles.delete(vehicle.id);
    }
  }

  getVehicles(): readonly Vehicle[] {
    return [...this.vehicles.values()];
  }

  clear(): void {
    this.vehicles.clear();
  }
}
