
import { createTile, type Tile, type TileType } from "./Tile";

export class GridManager {
  private grid: Tile[][];

  public readonly width: number;
  public readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.grid = this.createEmptyGrid(width, height);
  }

  // --------------------------------------------------
  // Coordenadas
  // --------------------------------------------------

  private get minX(): number {
    return -Math.floor(this.width / 2);
  }

  private get minY(): number {
    return -Math.floor(this.height / 2);
  }

  isInside(x: number, y: number): boolean {
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= this.minX &&
      x < this.minX + this.width &&
      y >= this.minY &&
      y < this.minY + this.height
    );
  }

  // --------------------------------------------------
  // Inicialización
  // --------------------------------------------------

  private createEmptyGrid(
    width: number,
    height: number
  ): Tile[][] {
    const grid: Tile[][] = [];

    for (let row = 0; row < height; row++) {
      const tiles: Tile[] = [];

      for (let col = 0; col < width; col++) {
        const x = col + this.minX;
        const y = row + this.minY;

        tiles.push(createTile(x, y, "empty"));
      }

      grid.push(tiles);
    }

    return grid;
  }

  // --------------------------------------------------
  // Acceso y modificación
  // --------------------------------------------------

  getTile(x: number, y: number): Tile | null {
    if (!this.isInside(x, y)) {
      return null;
    }

    const row = y - this.minY;
    const col = x - this.minX;

    return this.grid[row][col];
  }

  setTile(
    x: number,
    y: number,
    tile: Tile
  ): boolean {
    if (!this.isInside(x, y)) {
      return false;
    }

    // La tile debe pertenecer a estas coordenadas.
    if (tile.x !== x || tile.y !== y) {
      return false;
    }

    const row = y - this.minY;
    const col = x - this.minX;

    this.grid[row][col] = tile;

    return true;
  }

  // --------------------------------------------------
  // Consultas
  // --------------------------------------------------

  getNeighbors(x: number, y: number): Tile[] {
    const neighbors: Tile[] = [];

    const directions = [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ];

    for (const dir of directions) {
      const tile = this.getTile(
        x + dir.x,
        y + dir.y
      );

      if (tile) {
        neighbors.push(tile);
      }
    }

    return neighbors;
  }

  getTilesByType(type: TileType): Tile[] {
    return [...this.tiles()].filter(
      tile => tile.type === type
    );
  }

  isAreaFree(
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return false;
    }

    if (
      !this.isInside(x, y) ||
      !this.isInside(
        x + width - 1,
        y + height - 1
      )
    ) {
      return false;
    }

    for (let row = y; row < y + height; row++) {
      for (let col = x; col < x + width; col++) {
        const tile = this.getTile(col, row);

        if (
          !tile ||
          tile.type !== "empty" ||
          tile.occupantId !== null
        ) {
          return false;
        }
      }
    }

    return true;
  }

  // --------------------------------------------------
  // Iteración
  // --------------------------------------------------

  *tiles(): IterableIterator<Tile> {
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        yield this.grid[row][col];
      }
    }
  }

  // --------------------------------------------------
  // Clonado
  // --------------------------------------------------

  clone(): GridManager {
    const cloned = new GridManager(
      this.width,
      this.height
    );

    for (const tile of this.tiles()) {
      cloned.setTile(
        tile.x,
        tile.y,
        structuredClone(tile)
      );
    }

    return cloned;
  }
}
