/** Independent global map layers — several can be on at once. */
export type CityMapLayerFlags = {
  /** GPS run density (overview traces, or city-scoped when a city is focused). */
  heatmap: boolean;
  /** Streets not yet covered in the focused city (or all cities). */
  remaining: boolean;
  /**
   * Streets already conquered — the street-level view of what you've done.
   * In city focus this replaces the compiled GPS traces as the "done" layer.
   */
  covered: boolean;
};

export type CityMapLayerKey = keyof CityMapLayerFlags;

/** Global defaults: covered streets on, heatmap and remaining off. */
export const DEFAULT_CITY_MAP_LAYERS: CityMapLayerFlags = {
  heatmap: false,
  remaining: false,
  covered: true,
};

/** Applied when opening a city: done + left streets, no GPS density. */
export const CITY_FOCUS_MAP_LAYERS: CityMapLayerFlags = {
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
