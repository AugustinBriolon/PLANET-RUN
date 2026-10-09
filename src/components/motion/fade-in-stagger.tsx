"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

import { EASE_OUT } from "@/lib/motion/easing";

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, transform: "translateY(12px)" },
  visible: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: 0.35, ease: EASE_OUT },
  },
};

type FadeInProps = {
  children: ReactNode;
  className?: string;
};

export function FadeInStagger({ children, className }: FadeInProps) {
  return (
    <motion.div className={className} variants={containerVariants} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}

export function FadeInItem({ children, className }: FadeInProps) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
