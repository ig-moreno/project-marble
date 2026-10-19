
export class SimulationManager {
  private readonly fixedDelta = 1 / 60;
  private readonly maxFrameDelta = 0.1;

  private accumulator = 0;
  private paused = false;
  private elapsedTicks = 0;
  private readonly clockListeners = new Set<(minutes: number) => void>();
  // Un día de juego dura 30 minutos reales; el HUD avanza cada 10 minutos.
  private readonly ticksPerClockStep = (30 * 60 / (24 * 6)) / this.fixedDelta;

  getClockMinutes(): number {
    return (6 * 60 + Math.floor(this.elapsedTicks / this.ticksPerClockStep) * 10) % (24 * 60);
  }

  onClockChange(listener: (minutes: number) => void): () => void {
    this.clockListeners.add(listener);
    listener(this.getClockMinutes());
    return () => { this.clockListeners.delete(listener); };
  }

  resetClock(): void {
    this.elapsedTicks = 0;
    this.accumulator = 0;
    this.notifyClockChange();
  }

  private notifyClockChange(): void {
    const minutes = this.getClockMinutes();
    for (const listener of this.clockListeners) listener(minutes);
  }

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
      const previousMinutes = this.getClockMinutes();
      this.elapsedTicks += 1;
      if (this.getClockMinutes() !== previousMinutes) this.notifyClockChange();

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
    this.clockListeners.clear();
  }
}
