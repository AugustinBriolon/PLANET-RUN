"use client";

import type { GeoJSONSource } from "maplibre-gl";
import { useEffect, useId } from "react";

import { useMap } from "@/components/ui/map";
import type { CoveredStreets } from "@/lib/coverage/street-coverage";

import { globePalette } from "./globe-palette";

export type UncoveredStreetsLayerProps = {
  streets: CoveredStreets;
};

const STREETS_VISIBLE_ZOOM = 12;

/** Still-open streets for the selected city; only legible once zoomed in. */
export function UncoveredStreetsLayer({ streets }: UncoveredStreetsLayerProps) {
  const { map, isLoaded } = useMap();
  const id = useId();
  const sourceId = `uncovered-streets-${id}`;
  const layerId = `uncovered-streets-layer-${id}`;

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
        "line-color": globePalette.remainingStreet,
        "line-width": ["interpolate", ["linear"], ["zoom"], STREETS_VISIBLE_ZOOM, 1.2, 18, 4],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], STREETS_VISIBLE_ZOOM, 0, STREETS_VISIBLE_ZOOM + 1, 0.75],
      },
    });

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    map.getSource<GeoJSONSource>(sourceId)?.setData(streets);
  }, [map, isLoaded, sourceId, streets]);

  return null;
}
