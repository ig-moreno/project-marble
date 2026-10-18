
import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Tools,
  TransformNode,
} from "babylonjs";

import type { GridManager } from "../simulation/GridManager";
import { gridToWorld } from "../utils/coordinates";
import { getRoadGeometry } from "../simulation/road/RoadUtils";
import { createRoadGeometry } from "./RoadGeometryBuilder";
import type { Tile } from "../simulation/Tile";

export class TileRenderer {
  private meshes = new Map<string, TransformNode>();

  constructor(
    private scene: Scene,
    private gridManager: GridManager,

  ) { }

  public updateTile(tile: Tile): void {
    const key = `${tile.x},${tile.y}`;

    // Eliminar la representación anterior
    this.meshes.get(key)?.dispose();
    this.meshes.delete(key);

    if (tile.type === "empty") return;

    const root = new TransformNode(`tile-${key}`, this.scene);

    const position = gridToWorld(
      tile.x,
      tile.y,
      this.gridManager.width,
      this.gridManager.height,
    );

    root.position.copyFrom(position);

    switch (tile.type) {
      case "road":
        this.createRoad(root, tile.x, tile.y);
        break;

      case "house":
        this.createHouse(root);
        break;

      case "factory":
        this.createFactory(root);
        break;

      case "forest":
        this.createForest(root);
        break;

      case "mineral":
        this.createMineral(root);
        break;
    }

    this.meshes.set(key, root);
  }

  private createMaterial(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = color;
    return material;
  }

  
  
  private createRoad(
    root: TransformNode,
    x: number,
    y: number,
  ): void {
    const geometry = getRoadGeometry(
      this.gridManager,
      x,
      y,
    );

    const asphalt = this.createMaterial(
      "asphalt",
      new Color3(0.25, 0.28, 0.3),
    );

    const meshes = createRoadGeometry(
      this.scene,
      geometry.shape,
    );

    for (const mesh of meshes) {
      mesh.material = asphalt;
      this.attach(mesh, root);
    }

    root.rotation.y = Tools.ToRadians(geometry.rotation);
  }



  private createHouse(root: TransformNode): void {
    const mesh = MeshBuilder.CreateBox(
      "house",
      { width: 5, depth: 5, height: 4 },
      this.scene,
    );

    mesh.position.y = 2;
    mesh.material = this.createMaterial(
      "house-material",
      new Color3(0.85, 0.45, 0.3),
    );

    this.attach(mesh, root);
  }

  private createFactory(root: TransformNode): void {
    const mesh = MeshBuilder.CreateBox(
      "factory",
      { width: 7, depth: 7, height: 5 },
      this.scene,
    );

    mesh.position.y = 2.5;
    mesh.material = this.createMaterial(
      "factory-material",
      new Color3(0.45, 0.5, 0.6),
    );

    this.attach(mesh, root);
  }

  private createForest(root: TransformNode): void {
    const trunk = MeshBuilder.CreateCylinder(
      "trunk",
      { height: 2, diameter: 0.8 },
      this.scene,
    );

    trunk.position.y = 1;
    trunk.material = this.createMaterial(
      "trunk-material",
      new Color3(0.45, 0.3, 0.15),
    );

    this.attach(trunk, root);

    const leaves = MeshBuilder.CreateCylinder(
      "leaves",
      { height: 4, diameterBottom: 3.5, diameterTop: 0, tessellation: 5 },
      this.scene,
    );

    leaves.position.y = 4;
    leaves.material = this.createMaterial(
      "leaves-material",
      new Color3(0.2, 0.55, 0.25),
    );

    this.attach(leaves, root);
  }

  private createMineral(root: TransformNode): void {
    const mesh = MeshBuilder.CreatePolyhedron(
      "mineral",
      { type: 1, size: 2.5 },
      this.scene,
    );

    mesh.position.y = 1.5;
    mesh.material = this.createMaterial(
      "mineral-material",
      new Color3(0.5, 0.55, 0.65),
    );

    this.attach(mesh, root);
  }

  private attach(mesh: Mesh, root: TransformNode): void {
    mesh.parent = root;
    mesh.isPickable = false;
  }

  public dispose(): void {
    for (const root of this.meshes.values()) {
      root.dispose(false, true);
    }

    this.meshes.clear();
  }
}
