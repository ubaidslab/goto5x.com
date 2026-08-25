"use client";

import { CSSProperties, ElementType, ReactNode, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { applyAnimation, ApplyAnimationOptions } from "@/lib/dstudio-animations";
import { AnimationId } from "@/lib/theme-presets";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

/**
 * D-Studio v1 - the single reusable mount point every dstudio-sections/*
 * component (and the D-Studio live preview) wraps a heading/text/button/
 * image element in, so "the seller's chosen per-element preset actually
 * runs" is one implementation, not one bespoke tween per section
 * component. See lib/dstudio-animations.ts for what each preset does.
 */
export function AnimatedElement({
  preset,
  as = "div",
  className,
  style,
  children,
  options,
}: {
  preset: AnimationId | undefined;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  options?: ApplyAnimationOptions;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const Tag = as as ElementType;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      return applyAnimation(el, preset ?? "none", options);
    },
    { scope: ref, dependencies: [preset, options?.direction, options?.staggerChildren] },
  );

  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}
