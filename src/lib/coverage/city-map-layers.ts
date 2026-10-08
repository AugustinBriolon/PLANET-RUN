/** Independent global map layers — several can be on at once. */
export type CityMapLayerFlags = {
  /** Past run traces as a density heatmap. */
  heatmap: boolean;
  /** Streets not yet covered. */
  remaining: boolean;
  /** Streets already conquered. */
  covered: boolean;
};

export type CityMapLayerKey = keyof CityMapLayerFlags;

/** Global defaults: covered streets on, heatmap and remaining off. */
export const DEFAULT_CITY_MAP_LAYERS: CityMapLayerFlags = {
  heatmap: false,
  remaining: false,
  covered: true,
};

export function toggleCityMapLayer(layers: CityMapLayerFlags, key: CityMapLayerKey): CityMapLayerFlags {
  return { ...layers, [key]: !layers[key] };
}

/** Soft km still open in a city (never negative). */
export function cityKmLeft(city: { coveredMeters: number; totalMeters: number }): number {
  return Math.max(0, Math.round(((city.totalMeters - city.coveredMeters) / 1000) * 10) / 10);
}
