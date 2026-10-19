import { SIMULATION_CONFIG, VEHICLE_CONFIG } from "../../../config/game/simulation";

/** Conservative lower bound on travel while applying the configured maximum braking.
 * The integration allowance accounts for the discrete simulation step. */
export function brakingTravel(speed: number): number {
  return Math.max(0, speed * speed / (2 * VEHICLE_CONFIG.brakingMetersPerSecondSquared)
    - speed * SIMULATION_CONFIG.maxFrameDeltaSeconds);
}

/** Speed that leaves room to react and stop if the leading vehicle brakes now. */
export function safeFollowingSpeed(clearance: number, leaderSpeed: number): number {
  if (!Number.isFinite(clearance)) return Infinity;
  const braking = VEHICLE_CONFIG.brakingMetersPerSecondSquared;
  const reaction = VEHICLE_CONFIG.followingReactionTimeSeconds;
  return Math.max(0, Math.sqrt((braking * reaction) ** 2 + 2 * braking * (Math.max(0, clearance) + brakingTravel(leaderSpeed)))
    - braking * reaction);
}
