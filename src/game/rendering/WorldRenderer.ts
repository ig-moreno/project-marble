import { Color3, MeshBuilder, StandardMaterial, Vector3, type Scene } from "babylonjs";
import type { GridManager } from "../simulation/GridManager";
import { TILE_SIZE } from "../../config/world";

export class WorldRenderer {
  private scene: Scene
  private gridManager: GridManager
  constructor(scene: Scene, gridManager: GridManager) {
    this.scene = scene;
    this.gridManager = gridManager;

    this.createGround();
    this.createGridLines();
  }


  private createGround(): void {
    const width = this.gridManager.width * TILE_SIZE;
    const height = this.gridManager.height * TILE_SIZE;


    const ground = MeshBuilder.CreateGround(
      "ground",
      { width, height },
      this.scene,
    );
    ground.isPickable = true;

    const material = new StandardMaterial("groundMat", this.scene);
    material.diffuseColor = new Color3(0.3, 0.3, 0.3);

    ground.material = material;
  }

  private createGridLines(): void {
    const halfWidth = (this.gridManager.width * TILE_SIZE) / 2;
    const halfHeight = (this.gridManager.height * TILE_SIZE) / 2;

    const lines: Vector3[][] = [];
    const y = 0.05; // Ligeramente por encima del suelo

    for (let x = 0; x <= this.gridManager.width; x++) {
      const worldX = -halfWidth + x * TILE_SIZE;

      lines.push([
        new Vector3(worldX, y, -halfHeight),
        new Vector3(worldX, y, halfHeight),
      ]);
    }

    for (let z = 0; z <= this.gridManager.height; z++) {
      const worldZ = -halfHeight + z * TILE_SIZE;

      lines.push([
        new Vector3(-halfWidth, y, worldZ),
        new Vector3(halfWidth, y, worldZ),
      ]);
    }

   
    const gridLines = MeshBuilder.CreateLineSystem(
      "gridLines",
      { lines },
      this.scene,
    );

    gridLines.color = new Color3(0.15, 0.15, 0.15);
    gridLines.isPickable = false;
    
  }


}
