export type LatLon = { lat: number; lon: number };

/** ~1.1 km at mid-latitudes — enough to collapse runs that start in the same neighbourhood. */
export const CITY_CLUSTER_GRID_DEGREES = 0.01;

export function gridCellKey(point: LatLon, gridDegrees: number = CITY_CLUSTER_GRID_DEGREES): string {
  return `${Math.round(point.lat / gridDegrees)},${Math.round(point.lon / gridDegrees)}`;
}

/**
 * Keeps one representative point per grid cell so reverse-geocoding is done per area,
 * not once per run.
 */
export function clusterPointsByGrid(points: LatLon[], gridDegrees: number = CITY_CLUSTER_GRID_DEGREES): LatLon[] {
  const representatives = new Map<string, LatLon>();
  for (const point of points) {
    const key = gridCellKey(point, gridDegrees);
    if (!representatives.has(key)) representatives.set(key, point);
  }
  return [...representatives.values()];
}
