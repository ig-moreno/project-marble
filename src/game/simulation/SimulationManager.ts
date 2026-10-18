
export class SimulationManager {
  private readonly fixedDelta = 1 / 60;
  private readonly maxFrameDelta = 0.1;

  private accumulator = 0;
  private paused = false;

  private readonly systems = new Set<
    (deltaTime: number) => void
  >();

  register(
    update: (deltaTime: number) => void,
  ): () => void {
    this.systems.add(update);

    return () => {
      this.systems.delete(update);
    };
  }

  update(deltaTime: number): void {
    if (this.paused) return;

    this.accumulator += Math.min(
      deltaTime,
      this.maxFrameDelta,
    );

    while (this.accumulator >= this.fixedDelta) {
      for (const system of this.systems) {
        system(this.fixedDelta);
      }

      this.accumulator -= this.fixedDelta;
    }
  }

  pause(): void {
    this.paused = true;
    this.accumulator = 0;
  }

  resume(): void {
    this.paused = false;
    this.accumulator = 0;
  }

  isPaused(): boolean {
    return this.paused;
  }

  dispose(): void {
    this.systems.clear();
  }
}
