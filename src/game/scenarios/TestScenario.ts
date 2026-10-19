
import type { GridManager } from "../simulation/GridManager";
import { createTile } from "../simulation/Tile";

export interface ScenarioBuilding {
  id: string;
  type: "house" | "factory";
  x: number;
  y: number;
}

export interface TestScenarioData {
  home: ScenarioBuilding;
  workplace: ScenarioBuilding;
}

export function createTestScenario(
  grid: GridManager,
): TestScenarioData {
  const home: ScenarioBuilding = {
    id: "home-001",
    type: "house",
    x: -6,
    y: 0,
  };

  const workplace: ScenarioBuilding = {
    id: "workplace-001",
    type: "factory",
    x: 5,
    y: 0,
  };

  for (const building of [home, workplace]) {
    if (!grid.isInside(building.x, building.y)) {
      throw new Error(
        `Building ${building.id} is outside the grid`,
      );
    }

    const tile = grid.getTile(building.x, building.y);

    if (!tile || tile.type !== "empty") {
      throw new Error(
        `Cannot place building ${building.id}`,
      );
    }

    grid.setTile(
      building.x,
      building.y,
      createTile(
          building.x,
          building.y,
          building.type,
      ),
    );
  }

  return { home, workplace };
}
