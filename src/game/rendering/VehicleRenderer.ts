
import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  type Scene,
  type Mesh,
} from "babylonjs";

import { TILE_SIZE } from "../../config/world";
import { gridToWorld } from "../utils/coordinates";
import type { Vehicle } from "../simulation/vehicles/Vehicle";

export class VehicleRenderer {
  private readonly meshes = new Map<string, Mesh>();

  private readonly material: StandardMaterial;

  constructor(
    private readonly scene: Scene,
    private readonly gridWidth: number,
    private readonly gridHeight: number,
  ) {
    this.material = new StandardMaterial(
      "vehicle-material",
      scene,
    );

    this.material.diffuseColor = new Color3(
      0.9,
      0.25,
      0.15,
    );
  }

  update(vehicles: readonly Vehicle[]): void {
    const activeIds = new Set<string>();

    for (const vehicle of vehicles) {
      activeIds.add(vehicle.id);

      let mesh = this.meshes.get(vehicle.id);

      if (!mesh) {
        mesh = MeshBuilder.CreateBox(
          vehicle.id,
          {
            width: TILE_SIZE * 0.22,
            height: TILE_SIZE * 0.16,
            depth: TILE_SIZE * 0.38,
          },
          this.scene,
        );

        mesh.material = this.material;
        mesh.isPickable = false;

        this.meshes.set(vehicle.id, mesh);
      }

      const position = gridToWorld(
        vehicle.x,
        vehicle.y,
        this.gridWidth,
        this.gridHeight,
      );

      mesh.position.set(
        position.x,
        TILE_SIZE * 0.12,
        position.z,
      );

      const target = vehicle.path[vehicle.targetIndex];

      if (target) {
        const directionX = target.x - vehicle.x;
        const directionY = target.y - vehicle.y;

        if (
          Math.abs(directionX) > 0.0001 ||
          Math.abs(directionY) > 0.0001
        ) {
          mesh.rotation.y = Math.atan2(
            directionX,
            directionY,
          );
        }
      }
    }

    // Eliminar mallas de vehículos que terminaron.
    for (const [id, mesh] of this.meshes) {
      if (!activeIds.has(id)) {
        mesh.dispose();
        this.meshes.delete(id);
      }
    }
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.dispose();
    }

    this.meshes.clear();
    this.material.dispose();
  }
}
