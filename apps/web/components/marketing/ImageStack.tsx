"use client";

import { gsap } from "gsap";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

interface StackImage {
  src: string;
  alt: string;
}

const ROTATIONS = [-6, 4, -3, 7, -8];
const OFFSETS = [0, 48, 96, 32, 72];

/**
 * tasteskill-style scrollable image stack for the hero: a tilted,
 * overlapping row of product-visual cards with a slow scroll-linked
 * parallax drift (gsap-animations pattern 5). A no-op under
 * prefers-reduced-motion - the tilted static layout alone still reads as
 * a gallery.
 */
export function ImageStack({ images }: { images: StackImage[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || prefersReducedMotion()) return;

    const cards = gsap.utils.toArray<HTMLElement>(el.querySelectorAll("[data-stack-card]"));
    const ctx = gsap.context(() => {
      cards.forEach((card, i) => {
        gsap.to(card, {
          yPercent: i % 2 === 0 ? -8 : 8,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      });
    }, el);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="relative flex gap-4 overflow-x-auto px-1 py-8 [scrollbar-width:none] sm:overflow-visible">
      {images.map((img, i) => (
        <div
          key={img.src}
          data-stack-card
          className="w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-surface shadow-md sm:absolute sm:w-48"
          style={{
            transform: `rotate(${ROTATIONS[i % ROTATIONS.length]}deg)`,
            left: `${OFFSETS[i % OFFSETS.length]}%`,
            top: i % 2 === 0 ? "0%" : "18%",
            zIndex: images.length - i,
          }}
        >
          <Image src={img.src} alt={img.alt} width={480} height={340} className="h-auto w-full" />
        </div>
      ))}
    </div>
  );
}
