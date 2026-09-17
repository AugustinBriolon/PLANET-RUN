const MIN_DURATION_MS = 600;
const MAX_DURATION_MS = 2500;
/** Degrees of great-circle-ish separation that map to max duration. */
const DISTANCE_FOR_MAX_MS = 8;

export type FlyDurationOptions = {
  reducedMotion?: boolean;
  minMs?: number;
  maxMs?: number;
};

/**
 * Animation length for a camera hop: farther destinations take longer,
 * clamped so short hops stay snappy and long hops don't drag.
 */
export function flyDurationMs(distanceDegrees: number, options: FlyDurationOptions = {}): number {
  if (options.reducedMotion) return 0;
  const minMs = options.minMs ?? MIN_DURATION_MS;
  const maxMs = options.maxMs ?? MAX_DURATION_MS;
  const clampedDistance = Math.max(0, distanceDegrees);
  const t = Math.min(1, clampedDistance / DISTANCE_FOR_MAX_MS);
  return Math.round(minMs + t * (maxMs - minMs));
}

/** Approximate angular distance in degrees between two lng/lat points. */
export function angularDistanceDegrees(from: { lng: number; lat: number }, to: { lng: number; lat: number }): number {
  return Math.hypot(from.lng - to.lng, from.lat - to.lat);
}

export function boundsCenter(bounds: [[number, number], [number, number]]): { lng: number; lat: number } {
  return {
    lng: (bounds[0][0] + bounds[1][0]) / 2,
    lat: (bounds[0][1] + bounds[1][1]) / 2,
  };
}
