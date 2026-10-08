/** Independent map layers for a selected city — several can be on at once. */
export type CityMapLayerFlags = {
  /** Past run traces (activity heatmap / density). */
  heatmap: boolean;
  /** Streets not yet covered. */
  remaining: boolean;
  /** Streets already conquered. */
  covered: boolean;
};

export type CityMapLayerKey = keyof CityMapLayerFlags;

/** Defaults when opening a city: streets on, heatmap off. */
export const DEFAULT_CITY_MAP_LAYERS: CityMapLayerFlags = {
  heatmap: false,
  remaining: true,
  covered: true,
};

export function toggleCityMapLayer(layers: CityMapLayerFlags, key: CityMapLayerKey): CityMapLayerFlags {
  return { ...layers, [key]: !layers[key] };
}

/** Soft km still open in a city (never negative). */
export function cityKmLeft(city: { coveredMeters: number; totalMeters: number }): number {
  return Math.max(0, Math.round(((city.totalMeters - city.coveredMeters) / 1000) * 10) / 10);
}
