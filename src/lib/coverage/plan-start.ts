/** A run plan may start from the athlete's position only this close to the city boundary (0 inside). */
export const PLAN_START_MAX_DISTANCE_METERS = 1_000;

export type LngLat = { lng: number; lat: number };

export function isPlanStartAllowed(distanceToCityMeters: number): boolean {
  return Number.isFinite(distanceToCityMeters) && distanceToCityMeters <= PLAN_START_MAX_DISTANCE_METERS;
}
