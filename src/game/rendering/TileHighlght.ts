
import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  type Scene,
  type Mesh,
} from "babylonjs";

import { TILE_SIZE } from "../../config/game/world";
import { gridToWorld } from "../utils/coordinates";

export class TileHighlight {
  private mesh: Mesh;

  constructor(
    scene: Scene,
    private gridWidth: number,
    private gridHeight: number,
    elevation = 0.1,
  ) {
    // Crear una única malla para el highlight
    this.mesh = MeshBuilder.CreateGround(
      "tile-highlight",
      {
        width: TILE_SIZE,
        height: TILE_SIZE,
      },
      scene,
    );

    // Material semitransparente
    const material = new StandardMaterial(
      "tile-highlight-material",
      scene,
    );

    material.diffuseColor = new Color3(0.2, 0.8, 0.5);
    material.alpha = 0.35;
    material.disableLighting = true;

    this.mesh.material = material;

    // Evitar interferencias con el picking
    this.mesh.isPickable = false;

    // Ligeramente por encima del terreno
    this.mesh.position.y = elevation;

    // Oculto inicialmente
    this.mesh.setEnabled(false);
  }

  public show(x: number, y: number): void {
    const position = gridToWorld(
      x,
      y,
      this.gridWidth,
      this.gridHeight,
    );

    this.mesh.position.x = position.x;
    this.mesh.position.z = position.z;

    this.mesh.setEnabled(true);
  }

  public hide(): void {
    this.mesh.setEnabled(false);
  }

  public dispose(): void {
    this.mesh.material?.dispose();
    this.mesh.dispose();
  }
}
