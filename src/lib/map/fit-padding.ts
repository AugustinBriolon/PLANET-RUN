export type BoxPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type OverlayRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

/**
 * MapLibre fitBounds padding so the target sits in the free rectangle beside/above
 * an overlay (stats panel), not under it — especially on narrow screens.
 */
export function paddingForOverlay(
  mapSize: { width: number; height: number },
  overlay: OverlayRect,
  options: { edge?: number; header?: number } = {},
): BoxPadding {
  const edge = options.edge ?? 24;
  const header = options.header ?? 72;
  const bottom = Math.max(edge, Math.round(mapSize.height - overlay.top) + edge);
  const coversMostWidth = overlay.right - overlay.left > mapSize.width * 0.55;

  if (coversMostWidth) {
    return { top: header, right: edge, bottom, left: edge };
  }

  return {
    top: header,
    right: edge,
    bottom,
    left: Math.max(edge, Math.round(overlay.right) + edge),
  };
}

/** Map overlay rect into the map container's local coordinates. */
export function overlayRelativeToMap(mapRect: DOMRect, overlayRect: DOMRect): OverlayRect {
  return {
    top: overlayRect.top - mapRect.top,
    left: overlayRect.left - mapRect.left,
    right: overlayRect.right - mapRect.left,
    bottom: overlayRect.bottom - mapRect.top,
  };
}
