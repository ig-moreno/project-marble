import { Color3, MeshBuilder, StandardMaterial, Vector3, type Mesh, type Scene } from "babylonjs";
import { sampleLane, type DirectedLane, type LanePoint } from "../simulation/road/LaneGraph";
import { gridToWorld } from "../utils/coordinates";

/** Inspection overlay drawn from the logical trajectories, without recomputing road geometry. */
export class LaneOverlayRenderer {
  private readonly meshes: Mesh[] = [];
  private readonly materials: StandardMaterial[];
  private readonly neighborMaterials: StandardMaterial[];
  private readonly contextMaterial: StandardMaterial;
  private readonly routeMaterials: StandardMaterial[] = [];
  private readonly offset: Vector3;

  constructor(private readonly scene: Scene, width: number, height: number) {
    this.offset = gridToWorld(0, 0, width, height);
    const colors = ["#39d9ff", "#ffb347", "#e879f9", "#80ed99", "#ff6b6b", "#a5b4fc",
      "#fff176", "#2dd4bf", "#f9a8d4", "#c4b5fd", "#bef264", "#fb923c"];
    this.materials = colors.map((color, i) => this.createMaterial(`lane-movement-${i}`, color, 1));
    this.neighborMaterials = colors.map((color, i) => this.createMaterial(`lane-neighbor-${i}`, color, 0.3));
    this.contextMaterial = this.createMaterial("lane-context", "#b0bec5", 0.15);
  }

  private createMaterial(name: string, color: string, alpha: number): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.emissiveColor = Color3.FromHexString(color);
    material.diffuseColor = material.emissiveColor;
    material.disableLighting = true;
    material.alpha = alpha;
    return material;
  }

  public show(lanes: readonly DirectedLane[], neighbors: readonly DirectedLane[] = []): void {
    this.clear();
    const selected = [...lanes].sort((a, b) => a.id.localeCompare(b.id));
    for (const neighbor of neighbors) {
      const colors = selected.flatMap((lane, i) =>
        lane.nextLaneIds.includes(neighbor.id) || neighbor.nextLaneIds.includes(lane.id)
          ? [this.neighborMaterials[i % this.neighborMaterials.length]] : [],
      );
      this.draw(neighbor, colors.length ? colors : [this.contextMaterial]);
    }
    selected.forEach((lane, i) => this.draw(lane, [this.materials[i % this.materials.length]]));
  }

  private draw(lane: DirectedLane, materials: readonly StandardMaterial[]): void {
      const path = lane.trajectory;
      // Shared incoming/outgoing lanes carry several alternatives: alternate their
      // colors in bands instead of drawing identical, overlapping colored tubes.
      const bands = materials.length === 1 ? 1 : Math.ceil(path.length / 0.6);
      for (let band = 0; band < bands; band++) {
        const steps = path.kind === "arc" ? Math.max(2, Math.ceil(24 / bands)) : 1;
        const points = Array.from({ length: steps + 1 }, (_, i) =>
          this.toWorld(sampleLane(path, path.length * (band + i / steps) / bands).position),
        );
        this.addTube(points, 0.055, materials[band % materials.length]);
      }

      const { position, tangent } = sampleLane(path, path.length * 0.6);
      const tip = this.toWorld(position);
      const back = tip.subtract(new Vector3(tangent.x, 0, tangent.y).scale(0.8));
      const side = new Vector3(-tangent.y, 0, tangent.x).scale(0.4);
      this.addTube([back.add(side), tip, back.subtract(side)], 0.085, materials[Math.floor(bands * 0.6) % materials.length]);
  }

  public showRoute(lanes: readonly DirectedLane[]): void {
    this.clear();
    for (const lane of lanes) this.draw(lane, [this.materials[0]]);
  }

  public showColoredRoutes(routes: readonly { lanes: readonly DirectedLane[]; color: string }[]): void {
    this.clear();
    for (const route of routes) {
      const material = this.createMaterial(`circular-route-${route.color}`, route.color, 0.6);
      this.routeMaterials.push(material);
      for (const lane of route.lanes) this.draw(lane, [material]);
    }
  }

  private toWorld(point: LanePoint): Vector3 {
    return new Vector3(point.x + this.offset.x, 0.26, point.y + this.offset.z);
  }

  private addTube(path: Vector3[], radius: number, material: StandardMaterial): void {
    const mesh = MeshBuilder.CreateTube("lane-overlay", { path, radius, tessellation: 6 }, this.scene);
    mesh.material = material;
    mesh.isPickable = false;
    this.meshes.push(mesh);
  }

  public clear(): void {
    for (const mesh of this.meshes) mesh.dispose();
    this.meshes.length = 0;
    for (const material of this.routeMaterials) material.dispose();
    this.routeMaterials.length = 0;
  }

  public dispose(): void {
    this.clear();
    for (const material of [...this.materials, ...this.neighborMaterials, this.contextMaterial]) material.dispose();
  }
}
