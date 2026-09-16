"use client";

import { useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { useMap } from "@/components/ui/map";

export type GlobeAutoRotateProps = {
  /** Degrees of longitude per second. */
  degreesPerSecond?: number;
  /** Stops for good as soon as the user grabs, scrolls or pinches the globe. */
  stopOnInteraction?: boolean;
};

const INTERACTION_EVENTS = ["mousedown", "touchstart", "wheel", "dragstart"] as const;

export function GlobeAutoRotate({ degreesPerSecond = 4, stopOnInteraction = true }: GlobeAutoRotateProps) {
  const { map, isLoaded } = useMap();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!map || !isLoaded || prefersReducedMotion) return;

    let frameId = 0;
    let previousTimestamp: number | undefined;

    const spin = (timestamp: number) => {
      const elapsedSeconds = previousTimestamp === undefined ? 0 : (timestamp - previousTimestamp) / 1000;
      previousTimestamp = timestamp;
      if (!map.isMoving()) {
        const center = map.getCenter();
        map.setCenter([center.lng + degreesPerSecond * elapsedSeconds, center.lat]);
      }
      frameId = requestAnimationFrame(spin);
    };
    const stop = () => cancelAnimationFrame(frameId);

    frameId = requestAnimationFrame(spin);
    if (stopOnInteraction) INTERACTION_EVENTS.forEach((event) => map.on(event, stop));

    return () => {
      stop();
      if (stopOnInteraction) INTERACTION_EVENTS.forEach((event) => map.off(event, stop));
    };
  }, [map, isLoaded, prefersReducedMotion, degreesPerSecond, stopOnInteraction]);

  return null;
}
