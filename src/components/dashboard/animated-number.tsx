"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

const DEFAULT_DURATION = 1.4;

export type AnimatedNumberProps = {
  value: number;
  format: (value: number) => string;
  /** Seconds to reach `value`. Shorter where the number rides in with a panel rather than a page. */
  duration?: number;
};

/** Counts up from the previously displayed value whenever `value` changes. */
export function AnimatedNumber({ value, format, duration = DEFAULT_DURATION }: AnimatedNumberProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const displayedValue = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const controls = animate(displayedValue.current, value, {
      duration: prefersReducedMotion ? 0 : duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        displayedValue.current = latest;
        element.textContent = format(latest);
      },
    });
    return () => controls.stop();
  }, [value, format, duration, prefersReducedMotion]);

  return (
    <span ref={elementRef} className="tabular-nums">
      {format(0)}
    </span>
  );
}
