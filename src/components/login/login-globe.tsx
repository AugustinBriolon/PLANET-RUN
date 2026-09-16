"use client";

import { motion } from "motion/react";

import { FitGlobeToContainer } from "@/components/globe/fit-globe-to-container";
import { GlobeAutoRotate } from "@/components/globe/globe-auto-rotate";
import { OrbitArcs } from "@/components/globe/orbit-arcs";
import { RunGlobe } from "@/components/globe/run-globe";
import { showcaseArcs } from "@/components/globe/showcase-arcs";

export function LoginGlobe() {
  return (
    <motion.div
      className="size-full"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    >
      <RunGlobe interactive={false} initialCenter={[10, 28]}>
        <FitGlobeToContainer />
        <OrbitArcs arcs={showcaseArcs} />
        <GlobeAutoRotate degreesPerSecond={3} stopOnInteraction={false} />
      </RunGlobe>
    </motion.div>
  );
}
