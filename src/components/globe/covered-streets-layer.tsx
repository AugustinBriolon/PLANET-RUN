"use client";

import type { GeoJSONSource } from "maplibre-gl";
import { useEffect, useId } from "react";

import { useMap } from "@/components/ui/map";
import type { CoveredStreets } from "@/lib/coverage/street-coverage";

import { globePalette } from "./globe-palette";

export type CoveredStreetsLayerProps = {
  streets: CoveredStreets;
};

// A whole city is a few pixels below this zoom: streets would just be visual noise.
const STREETS_VISIBLE_ZOOM = 12;

/** Highlights the streets a runner has covered; only legible once zoomed into a city. */
export function CoveredStreetsLayer({ streets }: CoveredStreetsLayerProps) {
  const { map, isLoaded } = useMap();
  const id = useId();
  const sourceId = `covered-streets-${id}`;
  const layerId = `covered-streets-layer-${id}`;

  useEffect(() => {
    if (!map || !isLoaded) return;

    map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      minzoom: STREETS_VISIBLE_ZOOM,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": globePalette.coveredStreet,
        "line-width": ["interpolate", ["linear"], ["zoom"], STREETS_VISIBLE_ZOOM, 1.5, 18, 5],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], STREETS_VISIBLE_ZOOM, 0, STREETS_VISIBLE_ZOOM + 1, 0.9],
      },
    });

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
    // Layer is created once per map load; data is pushed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    map.getSource<GeoJSONSource>(sourceId)?.setData(streets);
  }, [map, isLoaded, sourceId, streets]);

  return null;
}
