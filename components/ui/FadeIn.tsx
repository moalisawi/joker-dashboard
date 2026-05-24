"use client";

import { motion } from "framer-motion";

interface Props {
  children:  React.ReactNode;
  delay?:    number;
  className?: string;
  style?:    React.CSSProperties;
  y?:        number;
}

/**
 * Wraps children with a scroll-triggered fade-up animation.
 * Triggers once when the element enters the viewport.
 *
 * Usage:
 *   <FadeIn><SomeSection /></FadeIn>
 *   <FadeIn delay={0.1}><AnotherSection /></FadeIn>
 */
export default function FadeIn({ children, delay = 0, className, style, y = 20 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.45,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
        delay,
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
