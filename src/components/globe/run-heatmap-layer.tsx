"use client";

import type { ExpressionSpecification, GeoJSONSource } from "maplibre-gl";
import { useEffect, useId } from "react";

import { useMap } from "@/components/ui/map";
import type { RunDensityTraces } from "@/lib/runs/run-geojson";

import { globePalette } from "./globe-palette";

export type RunHeatmapLayerProps = {
  traces: RunDensityTraces;
};

const COLOR_BY_DENSITY: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "density"],
  1,
  globePalette.heatmapCool,
  3,
  globePalette.heatmapMild,
  6,
  globePalette.heatmapWarm,
  12,
  globePalette.heatmapHot,
  24,
  globePalette.heatmapCore,
];

/** GPX-style traces tinted by how many distinct runs share each stretch (cool → hot). */
export function RunHeatmapLayer({ traces }: RunHeatmapLayerProps) {
  const { map, isLoaded } = useMap();
  const id = useId();
  const sourceId = `runs-density-${id}`;
  const glowId = `runs-density-glow-${id}`;
  const lineId = `runs-density-line-${id}`;

  useEffect(() => {
    if (!map || !isLoaded) return;

    map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });

    map.addLayer({
      id: glowId,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": COLOR_BY_DENSITY,
        "line-blur": 4,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          ["interpolate", ["linear"], ["get", "density"], 1, 2, 24, 5],
          14,
          ["interpolate", ["linear"], ["get", "density"], 1, 6, 24, 14],
        ],
        "line-opacity": 0.45,
      },
    });
    map.addLayer({
      id: lineId,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": COLOR_BY_DENSITY,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          ["interpolate", ["linear"], ["get", "density"], 1, 0.8, 24, 2.2],
          14,
          ["interpolate", ["linear"], ["get", "density"], 1, 2, 24, 5],
        ],
        "line-opacity": 0.95,
      },
    });

    return () => {
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getLayer(glowId)) map.removeLayer(glowId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
    // Layer is created once per map load; data is pushed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    map.getSource<GeoJSONSource>(sourceId)?.setData(traces);
  }, [map, isLoaded, sourceId, traces]);

  return null;
}
