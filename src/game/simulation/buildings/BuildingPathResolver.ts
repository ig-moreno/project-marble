
import type { GridManager } from "../GridManager";
import { findRoadPath } from "../vehicles/RoadPathFinder";

import {
  BuildingAccessResolver,
  type GridPosition,
} from "./BuildingAccessResolver";

export class BuildingPathResolver {
  private readonly accessResolver: BuildingAccessResolver;

  constructor(
    private readonly grid: GridManager,
  ) {
    this.accessResolver =
      new BuildingAccessResolver(grid);
  }

  public findPath(
    origin: GridPosition,
    destination: GridPosition,
  ): GridPosition[] | null {
    const originAccesses =
      this.accessResolver.getRoadAccesses(origin);

    const destinationAccesses =
      this.accessResolver.getRoadAccesses(destination);

    if (
      originAccesses.length === 0 ||
      destinationAccesses.length === 0
    ) {
      return null;
    }

    let bestPath: GridPosition[] | null = null;

    for (const start of originAccesses) {
      for (const end of destinationAccesses) {
        const path = findRoadPath(
          this.grid,
          start,
          end,
        );

        if (
          path &&
          (!bestPath || path.length < bestPath.length)
        ) {
          bestPath = path;
        }
      }
    }

    return bestPath;
  }
}
