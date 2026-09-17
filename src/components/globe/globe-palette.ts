// WebGL layers cannot read CSS custom properties, so map colors live here as hex.
// Keep them aligned with the `--ember` token in globals.css.
export const globePalette = {
  trace: "#ff8a4c",
  traceGlow: "#ff5f1f",
  startPoint: "#ffc39e",
  arc: "#ff8a4c",
  coveredStreet: "#4ade80",
  // Thermal scale for density-colored traces (cool infrequent → hot frequented).
  heatmapCool: "#4cc9f0",
  heatmapMild: "#80ed99",
  heatmapWarm: "#fee440",
  heatmapHot: "#ff7b00",
  heatmapCore: "#ff0054",
} as const;
