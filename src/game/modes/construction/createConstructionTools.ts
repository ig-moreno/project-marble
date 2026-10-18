
import type { GridManager } from "../../simulation/GridManager";

import { ToolManager } from "./tools/ToolManager";
import { RoadBuilderTool } from "./tools/RoadBuilderTool";
import { TilePaintTool } from "./tools/TilePaintTool";

export function createConstructionTools(
  grid: GridManager,
): ToolManager {
  const manager = new ToolManager();

  manager.register(new RoadBuilderTool(grid));

  manager.register(
    new TilePaintTool("house", "house", grid),
  );

  manager.register(
    new TilePaintTool("forest", "forest", grid),
  );

  manager.register(
    new TilePaintTool("mineral", "mineral", grid),
  );

  manager.register(
    new TilePaintTool("erase", "empty", grid),
  );

  manager.selectTool("road");

  return manager;
}
