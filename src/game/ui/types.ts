
import type { TileType } from "../simulation/Tile";
import type { ToolId } from "../modes/construction/tools/types";

export type EditorTool =
  | { kind: "paint"; tileType: TileType }
  | { kind: "inspect" };

export interface TileSelection {
  x: number;
  y: number;
}

export interface UIConfig {
  components: {
    tilePicker: boolean;
    infoPanel: boolean;
    modal: boolean;
  };
  availableTools: ToolId[];

}