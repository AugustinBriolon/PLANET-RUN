// At zoom 0 MapLibre renders the globe with a diameter of roughly 512px / π · 2 ≈ 163px,
// and each zoom level doubles it. Solving for the zoom that fills `fill` of the smallest side:
const GLOBE_DIAMETER_AT_ZOOM_ZERO_PX = 163;

export function getGlobeZoomToFit(containerWidth: number, containerHeight: number, fill = 0.72): number {
  const targetDiameter = Math.min(containerWidth, containerHeight) * fill;
  return Math.log2(targetDiameter / GLOBE_DIAMETER_AT_ZOOM_ZERO_PX);
}
