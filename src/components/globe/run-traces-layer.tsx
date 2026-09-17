"use client";

import type { FilterSpecification, GeoJSONSource, MapLayerMouseEvent, MapMouseEvent } from "maplibre-gl";
import { useEffect, useId } from "react";

import { useMap } from "@/components/ui/map";
import type { RunFeatureProperties, RunStartPoints, RunTraces } from "@/lib/runs/run-geojson";

import { globePalette } from "./globe-palette";

export type RunTracesLayerProps = {
  traces: RunTraces;
  startPoints: RunStartPoints;
  /** Called with a run's properties when its trace or start dot is clicked. */
  onSelectRun?: (run: RunFeatureProperties) => void;
  /** Called on a map click that misses every trace and start dot, e.g. to clear a selection. */
  onDeselect?: () => void;
};

// Below this zoom a whole city is a few pixels: start dots read better than lines.
const DETAIL_ZOOM = 7;
// No real run has this id: a highlight layer filtered on it matches nothing, i.e. is effectively off.
const NO_HOVER: FilterSpecification = ["==", ["id"], -1];

function useLayerIds() {
  const id = useId();
  return {
    tracesSource: `runs-traces-${id}`,
    startsSource: `runs-starts-${id}`,
    glow: `runs-glow-${id}`,
    line: `runs-line-${id}`,
    starts: `runs-starts-layer-${id}`,
    glowHover: `runs-glow-hover-${id}`,
    lineHover: `runs-line-hover-${id}`,
    startsHover: `runs-starts-hover-${id}`,
  };
}

/** Glowing run traces, with start dots that fade out as the lines become legible. */
export function RunTracesLayer({ traces, startPoints, onSelectRun, onDeselect }: RunTracesLayerProps) {
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

    // Hovered trace/start dot: separate layers toggled by `filter` (not feature-state — MapLibre
    // rejects a zoom "interpolate" nested inside a per-feature "case"), drawn on top so the hovered
    // run visibly pops even where several traces overlap.
    map.addLayer({
      id: ids.glowHover,
      type: "line",
      source: ids.tracesSource,
      filter: NO_HOVER,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": globePalette.traceGlow,
        "line-blur": 8,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 5, 14, 18],
        "line-opacity": 0.9,
      },
    });
    map.addLayer({
      id: ids.lineHover,
      type: "line",
      source: ids.tracesSource,
      filter: NO_HOVER,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": globePalette.trace,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.8, 14, 4.5],
        "line-opacity": 1,
      },
    });
    map.addLayer({
      id: ids.startsHover,
      type: "circle",
      source: ids.startsSource,
      filter: NO_HOVER,
      paint: {
        "circle-color": globePalette.startPoint,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 6, DETAIL_ZOOM, 8],
        "circle-blur": 0.3,
        "circle-opacity": 0.95,
      },
    });

    return () => {
      for (const layerId of [ids.startsHover, ids.lineHover, ids.glowHover, ids.starts, ids.line, ids.glow]) {
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

  useEffect(() => {
    if (!map || !isLoaded) return;

    // A trace and its start dot live on two different sources but share a feature id, so hovering
    // either one highlights both.
    let hoveredId: string | number | undefined;

    function setHoverFilter(id: string | number | undefined) {
      const filter: FilterSpecification = id === undefined ? NO_HOVER : ["==", ["id"], id];
      map!.setFilter(ids.glowHover, filter);
      map!.setFilter(ids.lineHover, filter);
      map!.setFilter(ids.startsHover, filter);
    }

    function handleMouseMove(event: MapLayerMouseEvent) {
      const id = event.features?.[0]?.id;
      if (id === hoveredId) return;
      hoveredId = id;
      setHoverFilter(hoveredId);
      map!.getCanvas().style.cursor = "pointer";
    }
    function handleMouseLeave() {
      hoveredId = undefined;
      setHoverFilter(undefined);
      map!.getCanvas().style.cursor = "";
    }
    function handleClick(event: MapLayerMouseEvent) {
      const feature = event.features?.[0];
      if (feature) onSelectRun?.(feature.properties as RunFeatureProperties);
    }

    const interactiveLayers = [ids.glow, ids.line, ids.starts];
    for (const layerId of interactiveLayers) {
      map.on("mousemove", layerId, handleMouseMove);
      map.on("mouseleave", layerId, handleMouseLeave);
      map.on("click", layerId, handleClick);
    }
    return () => {
      for (const layerId of interactiveLayers) {
        map.off("mousemove", layerId, handleMouseMove);
        map.off("mouseleave", layerId, handleMouseLeave);
        map.off("click", layerId, handleClick);
      }
    };
  }, [map, isLoaded, ids.glow, ids.line, ids.starts, ids.glowHover, ids.lineHover, ids.startsHover, onSelectRun]);

  useEffect(() => {
    if (!map || !isLoaded || !onDeselect) return;

    // Layer-specific click handlers above don't stop this one from also firing, so only deselect
    // when the click truly missed every trace and start dot (queried directly, not inferred).
    function handleMapClick(event: MapMouseEvent) {
      const hits = map!.queryRenderedFeatures(event.point, { layers: [ids.glow, ids.line, ids.starts] });
      if (hits.length === 0) onDeselect!();
    }

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [map, isLoaded, ids.glow, ids.line, ids.starts, onDeselect]);

  return null;
}
