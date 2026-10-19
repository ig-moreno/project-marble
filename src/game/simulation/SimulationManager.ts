import { SIMULATION_CONFIG } from "../../config/game/simulation";


export class SimulationManager {
  private readonly fixedDelta = SIMULATION_CONFIG.fixedDeltaSeconds;
  private readonly maxFrameDelta = SIMULATION_CONFIG.maxFrameDeltaSeconds;

  private accumulator = 0;
  private speedMultiplier: 1 | 2 | 4 = 1;

  getSpeedMultiplier(): 1 | 2 | 4 { return this.speedMultiplier; }

  setSpeedMultiplier(speed: 1 | 2 | 4): void {
    if (speed === 1 || speed === 2 || speed === 4) this.speedMultiplier = speed;
  }
  private paused = false;
  private elapsedTicks = 0;
  private readonly clockListeners = new Set<(minutes: number) => void>();
  // Un día de juego dura 30 minutos reales; el HUD avanza cada 10 minutos.
  private readonly ticksPerClockStep = (SIMULATION_CONFIG.dayDurationSeconds / (24 * 60 / SIMULATION_CONFIG.clockStepMinutes)) / this.fixedDelta;

  getClockMinutes(): number {
    return (SIMULATION_CONFIG.initialClockMinutes + Math.floor(this.elapsedTicks / this.ticksPerClockStep) * SIMULATION_CONFIG.clockStepMinutes) % (24 * 60);
  }

  onClockChange(listener: (minutes: number) => void): () => void {
    this.clockListeners.add(listener);
    listener(this.getClockMinutes());
    return () => { this.clockListeners.delete(listener); };
  }

  resetClock(): void {
    this.speedMultiplier = 1;
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
    ) * this.speedMultiplier;

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
