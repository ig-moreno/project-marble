
import { AxesViewer, Vector3, type Scene } from "babylonjs";

export class DebugRenderer {
  private axesViewer: AxesViewer;

  constructor(scene: Scene) {
    this.axesViewer = new AxesViewer(scene, 1);

    // Colocar los ejes en el origen del mundo
    this.axesViewer.update(
      Vector3.Zero(),
      Vector3.Right(),
      Vector3.Up(),
      Vector3.Forward()
    );
  }

  public dispose(): void {
    this.axesViewer.dispose();
  }
}
