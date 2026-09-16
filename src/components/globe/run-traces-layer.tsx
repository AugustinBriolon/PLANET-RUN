"use client";

import type { GeoJSONSource } from "maplibre-gl";
import { useEffect, useId } from "react";

import { useMap } from "@/components/ui/map";
import type { RunStartPoints, RunTraces } from "@/lib/runs/run-geojson";

import { globePalette } from "./globe-palette";

export type RunTracesLayerProps = {
  traces: RunTraces;
  startPoints: RunStartPoints;
};

// Below this zoom a whole city is a few pixels: start dots read better than lines.
const DETAIL_ZOOM = 7;

function useLayerIds() {
  const id = useId();
  return {
    tracesSource: `runs-traces-${id}`,
    startsSource: `runs-starts-${id}`,
    glow: `runs-glow-${id}`,
    line: `runs-line-${id}`,
    starts: `runs-starts-layer-${id}`,
  };
}

/** Glowing run traces, with start dots that fade out as the lines become legible. */
export function RunTracesLayer({ traces, startPoints }: RunTracesLayerProps) {
  const { map, isLoaded } = useMap();
  const ids = useLayerIds();

  useEffect(() => {
    if (!map || !isLoaded) return;

    map.addSource(ids.tracesSource, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addSource(ids.startsSource, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: ids.glow,
      type: "line",
      source: ids.tracesSource,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": globePalette.traceGlow,
        "line-blur": 6,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 2, 14, 10],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.15, DETAIL_ZOOM, 0.45],
      },
    });
    map.addLayer({
      id: ids.line,
      type: "line",
      source: ids.tracesSource,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": globePalette.trace,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 14, 2.5],
        "line-opacity": 0.9,
      },
    });
    map.addLayer({
      id: ids.starts,
      type: "circle",
      source: ids.startsSource,
      paint: {
        "circle-color": globePalette.startPoint,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.5, DETAIL_ZOOM, 4],
        "circle-blur": 0.4,
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], DETAIL_ZOOM - 1, 0.85, DETAIL_ZOOM + 1, 0],
      },
    });

    return () => {
      for (const layerId of [ids.starts, ids.line, ids.glow]) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      }
      for (const sourceId of [ids.tracesSource, ids.startsSource]) {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
    };
    // Layers are created once per map load; data is pushed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    map.getSource<GeoJSONSource>(ids.tracesSource)?.setData(traces);
    map.getSource<GeoJSONSource>(ids.startsSource)?.setData(startPoints);
  }, [map, isLoaded, ids.tracesSource, ids.startsSource, traces, startPoints]);

  return null;
}
