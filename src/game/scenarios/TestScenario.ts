import { TEST_SCENARIO_CONFIG } from "../../config/game/testScenario";
import { CIRCULAR_TEST_ROUTES } from "../../config/game/testScenario";
import { findCircularLaneRoute } from "../simulation/road/LanePathFinder";
import type { LaneGraph } from "../simulation/road/LaneGraph";
import type { GridManager } from "../simulation/GridManager";
import { createTile } from "../simulation/Tile";
import { connectRoads } from "../simulation/road/RoadUtils";

export { TEST_ROUTES as testRoutes } from "../../config/game/testScenario";

export function circularTestRoutes(graph: LaneGraph) {
  return CIRCULAR_TEST_ROUTES.map((preset) => ({ ...preset, route: findCircularLaneRoute(graph, preset.waypoints) }));
}

export interface RouteTestState {
  title: string;
  description: string;
  options: { id: string; label: string; disabled?: boolean }[];
  activeId: string | null;
  status: string;
}

/** Explicit development fixture: roads only, vehicles are created by the diagnostic action. */
export function populateTestScenario(grid: GridManager): void {
  function segment(ax: number, ay: number, bx: number, by: number): void {
    const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
    const length = Math.abs(bx - ax) + Math.abs(by - ay);
    for (let i = 0; i <= length; i++) {
      const x = ax + dx * i, y = ay + dy * i;
      const tile = grid.getTile(x, y);
      if (!tile) throw new Error(`TestScenario requires at least a ${TEST_SCENARIO_CONFIG.minimumGridSize} by ${TEST_SCENARIO_CONFIG.minimumGridSize} grid`);
      if (tile.type !== "road") grid.setTile(x, y, createTile(x, y, "road"));
      if (i) connectRoads(grid, x - dx, y - dy, x, y);
    }
  }
  for (const [ax, ay, bx, by] of TEST_SCENARIO_CONFIG.roads) segment(ax, ay, bx, by);
}
