
import {
  Mesh,
  MeshBuilder,
  Scene,
  VertexData,
} from "babylonjs";

import type { RoadShape } from "../simulation/road/types";

export const TILE_SIZE = 10;
export const ROAD_WIDTH = 6;
export const SIDEWALK_WIDTH = 2;

const HALF = TILE_SIZE / 2;
const ROAD_HALF = ROAD_WIDTH / 2;
const ROAD_HEIGHT = 0.12;

type Point = { x: number; z: number };

function createSurface(
  scene: Scene,
  name: string,
  points: Point[],
  indices: number[],
): Mesh {
  const mesh = new Mesh(name, scene);

  const positions = points.flatMap(p => [
    p.x,
    ROAD_HEIGHT,
    p.z,
  ]);

  const normals: number[] = [];

  VertexData.ComputeNormals(positions, indices, normals);

  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.applyToMesh(mesh);

  mesh.isPickable = false;

  return mesh;
}

function createRectangle(
  scene: Scene,
  name: string,
  width: number,
  depth: number,
  x = 0,
  z = 0,
): Mesh {
  const mesh = MeshBuilder.CreateBox(
    name,
    { width, depth, height: ROAD_HEIGHT },
    scene,
  );

  mesh.position.set(x, ROAD_HEIGHT / 2, z);
  mesh.isPickable = false;

  return mesh;
}

/**
 * Curva base: NORTE → ESTE.
 *
 * El eje central sigue un cuarto de círculo
 * desde (0, -5) hasta (5, 0).
 *
 * Centro del círculo: (5, -5)
 * Radio central: 5
 * Radio interior: 2
 * Radio exterior: 8
 */
function createCorner(
  scene: Scene,
  segments = 8,
): Mesh {
  const points: Point[] = [];
  const indices: number[] = [];

  const centerX = HALF;
  const centerZ = -HALF;

  const innerRadius = HALF - ROAD_HALF;
  const outerRadius = HALF + ROAD_HALF;

  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI - (i / segments) * Math.PI / 2;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    points.push({
      x: centerX + cos * innerRadius,
      z: centerZ + sin * innerRadius,
    });

    points.push({
      x: centerX + cos * outerRadius,
      z: centerZ + sin * outerRadius,
    });

    if (i < segments) {
      const a = i * 2;

      indices.push(a, a + 2, a + 1);
      indices.push(a + 1, a + 2, a + 3);
    }
  }

  return createSurface(
    scene,
    "road-corner",
    points,
    indices,
  );
}

export function createRoadGeometry(
  scene: Scene,
  shape: RoadShape,
): Mesh[] {
  switch (shape) {
    case "isolated":
      return [
        createRectangle(scene, "road-isolated", 6, 6),
      ];

    case "end":
      return [
        createRectangle(
          scene,
          "road-end",
          ROAD_WIDTH,
          8,
          0,
          -1,
        ),
      ];

    case "straight":
      return [
        createRectangle(
          scene,
          "road-straight",
          ROAD_WIDTH,
          TILE_SIZE,
        ),
      ];

    case "corner":
      return [createCorner(scene)];

    case "t-junction":
      return [
        createRectangle(
          scene,
          "road-t-horizontal",
          TILE_SIZE,
          ROAD_WIDTH,
        ),
        createRectangle(
          scene,
          "road-t-north",
          ROAD_WIDTH,
          SIDEWALK_WIDTH,
          0,
          -4,
        ),
      ];

    case "cross":
      return [
        createRectangle(
          scene,
          "road-cross-vertical",
          ROAD_WIDTH,
          TILE_SIZE,
        ),
        createRectangle(
          scene,
          "road-cross-horizontal",
          TILE_SIZE,
          ROAD_WIDTH,
        ),
      ];
  }
}
