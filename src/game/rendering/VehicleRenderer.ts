
import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  DynamicTexture,
  Mesh,
  type Scene,
} from "babylonjs";

import { TILE_SIZE } from "../../config/game/world";
import { gridToWorld } from "../utils/coordinates";
import type { Vehicle } from "../simulation/vehicles/Vehicle";

export class VehicleRenderer {
  private readonly meshes = new Map<string, Mesh>();

  private readonly material: StandardMaterial;
  private readonly axleMaterial: StandardMaterial;
  private readonly coloredMaterials = new Map<string, StandardMaterial>();
  private readonly labels = new Map<string, { texture: DynamicTexture; material: StandardMaterial }>();
  private nextLabelNumber = 1;

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
    this.axleMaterial = new StandardMaterial("vehicle-axle-material", scene);
    this.axleMaterial.diffuseColor = new Color3(0.08, 0.09, 0.1);
  }

  update(vehicles: readonly Vehicle[]): void {
    if (!vehicles.length) this.nextLabelNumber = 1;
    const activeIds = new Set<string>();

    for (const vehicle of vehicles) {
      activeIds.add(vehicle.id);

      let mesh = this.meshes.get(vehicle.id);

      if (!mesh) {
        mesh = MeshBuilder.CreateBox(
          vehicle.id,
          vehicle.kind === "lane" ? {
            width: vehicle.dimensions.width,
            height: vehicle.dimensions.height,
            depth: vehicle.dimensions.wheelbase + vehicle.dimensions.frontOverhang + vehicle.dimensions.rearOverhang,
          } : {
            width: TILE_SIZE * 0.22,
            height: TILE_SIZE * 0.16,
            depth: TILE_SIZE * 0.38,
          },
          this.scene,
        );

        mesh.material = this.material;
        if (vehicle.kind === "lane" && vehicle.color) {
          let material = this.coloredMaterials.get(vehicle.color);
          if (!material) {
            material = this.material.clone(`vehicle-${vehicle.color}`);
            material.diffuseColor = Color3.FromHexString(vehicle.color);
            this.coloredMaterials.set(vehicle.color, material);
          }
          mesh.material = material;
        }
        mesh.isPickable = false;

        if (vehicle.kind === "lane") {
          const d = vehicle.dimensions;
          const offset = (d.frontOverhang - d.rearOverhang) / 2;
          for (const z of [d.wheelbase / 2 - offset, -d.wheelbase / 2 - offset]) {
            const axle = MeshBuilder.CreateBox("vehicle-axle", { width: d.width + 0.15, height: 0.12, depth: 0.12 }, this.scene);
            axle.parent = mesh;
            axle.position.set(0, -d.height / 2 + 0.05, z);
            axle.material = this.axleMaterial;
            axle.isPickable = false;
            for (const side of [-1, 1]) {
              const wheel = MeshBuilder.CreateCylinder("vehicle-wheel", { height: 0.22, diameter: 0.55, tessellation: 12 }, this.scene);
              wheel.parent = axle;
              wheel.position.x = side * d.width / 2;
              wheel.rotation.z = Math.PI / 2;
              wheel.material = this.axleMaterial;
              wheel.isPickable = false;
            }
          }
        }

        this.meshes.set(vehicle.id, mesh);
        this.addNumber(vehicle, mesh);
      }

      const position = vehicle.kind === "lane" ? gridToWorld(
        vehicle.position.x / TILE_SIZE,
        vehicle.position.y / TILE_SIZE,
        this.gridWidth,
        this.gridHeight,
      ) : gridToWorld(
        vehicle.x,
        vehicle.y,
        this.gridWidth,
        this.gridHeight,
      );

      mesh.position.set(
        position.x,
        vehicle.kind === "lane" ? 0.12 + 0.28 + vehicle.dimensions.height / 2 : TILE_SIZE * 0.12,
        position.z,
      );

      if (vehicle.kind === "lane") {
        mesh.rotation.y = Math.atan2(vehicle.tangent.x, vehicle.tangent.y);
        continue;
      }

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
        this.disposeLabel(id);
        this.meshes.delete(id);
      }
    }
  }

  private addNumber(vehicle: Vehicle, parent: Mesh): void {
    const texture = new DynamicTexture(`vehicle-number-${vehicle.id}`, { width: 256, height: 128 }, this.scene, false);
    texture.hasAlpha = true;
    texture.drawText(String(this.nextLabelNumber++), null, 96, "bold 96px sans-serif", "white", "#17212bee", true);
    const material = new StandardMaterial(`vehicle-number-material-${vehicle.id}`, this.scene);
    material.diffuseTexture = texture;
    material.opacityTexture = texture;
    material.emissiveColor = Color3.White();
    material.disableLighting = true;
    material.backFaceCulling = false;
    const label = MeshBuilder.CreatePlane(`vehicle-number-${vehicle.id}`, { width: 2, height: 1 }, this.scene);
    label.parent = parent;
    label.position.y = (vehicle.kind === "lane" ? vehicle.dimensions.height : TILE_SIZE * 0.16) / 2 + 0.9;
    label.billboardMode = Mesh.BILLBOARDMODE_ALL;
    label.material = material;
    label.isPickable = false;
    this.labels.set(vehicle.id, { texture, material });
  }

  private disposeLabel(id: string): void {
    const label = this.labels.get(id);
    label?.material.dispose();
    label?.texture.dispose();
    this.labels.delete(id);
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.dispose();
    }

    this.meshes.clear();
    for (const id of this.labels.keys()) this.disposeLabel(id);
    this.material.dispose();
    this.axleMaterial.dispose();
    for (const material of this.coloredMaterials.values()) material.dispose();
    this.coloredMaterials.clear();
  }
}
