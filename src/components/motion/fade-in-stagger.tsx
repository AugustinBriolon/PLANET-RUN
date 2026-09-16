"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
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
