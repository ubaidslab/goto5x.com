/**
 * D-Studio v1 - the real, executing GSAP implementation behind the 14
 * animation presets an element in section-catalog.ts can be assigned.
 * Unlike Coded Mode's stored-but-inert customCode, this runs on both the
 * D-Studio live preview AND the real storefront - a seller's animation
 * choice is a genuine, shipped feature the moment they save it.
 *
 * Timing/eases pulled from lib/motion.ts (the same tokens Reveal/Magnetic
 * already use) so a D-Studio-animated section doesn't feel like a
 * different motion language from the rest of the product.
 *
 * "Lottie Playback" - no Lottie-file upload control exists anywhere in
 * D-Studio v1 (no per-section asset slot was built for it), so there is
 * no real .json to actually play. Rather than silently substitute
 * something and call it done, this preset is implemented as a clearly-
 * commented placeholder (a scale+fade entrance, reusing scale-in's tween)
 * until a real Lottie asset field is designed - flagged here and in the
 * founder-facing completion report, not hidden.
 *
 * STORAGE DISCIPLINE (D-Studio close-out research, no upload field built
 * yet) - when that Lottie/media upload field is designed, it MUST follow
 * MediaAssetsService.uploadDirect()'s pattern (apps/api/src/media/
 * media-assets.service.ts): sum sizeBytes for the store from `media_asset`
 * and reject the upload if it would exceed `catalog.storage_quota_bytes`
 * (resolved through the seller's plan context), then persist the file as a
 * real MediaAsset row (not a bespoke D-Studio-only table) so it's counted
 * exactly like every other store asset. Do NOT model it on the existing
 * review-media upload path - two real, verified gaps there:
 *   1. Its actual per-file cap is 20MB (MAX_REVIEW_MEDIA_BYTES,
 *      review-submission.controller.ts), not 12MB.
 *   2. `ReviewMedia` has no `sizeBytes` column at all and is never summed
 *      against any quota - buyer-submitted review media is completely
 *      unmetered today. This is a pre-existing gap in a different feature
 *      (Phase 4 reviews), out of D-Studio's scope to fix here, but it
 *      means review media is NOT a working precedent for "quota-enforced
 *      upload" - only MediaAssetsService.uploadDirect() is.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { duration, easeString, prefersReducedMotion } from "./motion";
import { AnimationId } from "./theme-presets";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export type AnimationKind = "entrance" | "hover" | "continuous" | "sticky";

export const ANIMATION_KIND: Record<AnimationId, AnimationKind> = {
  none: "entrance",
  "fade-up": "entrance",
  "fade-in": "entrance",
  "slide-in": "entrance",
  "scale-in": "entrance",
  "stagger-reveal": "entrance",
  "hover-lift": "hover",
  "ken-burns": "entrance",
  "text-split": "entrance",
  parallax: "continuous",
  magnetic: "hover",
  "glass-reveal": "entrance",
  "gradient-shift": "continuous",
  "sticky-pin": "sticky",
  lottie: "entrance",
};

export interface ApplyAnimationOptions {
  /** For "stagger-reveal": animate el's direct children instead of el itself. */
  staggerChildren?: boolean;
  /** For "slide-in": which side it enters from. Defaults to "left". */
  direction?: "left" | "right";
}

/**
 * Applies one preset's real GSAP behavior to `el`. Returns a cleanup
 * function (kill the tween/ScrollTrigger/listeners) - callers run this in
 * a useGSAP/gsap.context cleanup, same discipline as Reveal.tsx.
 */
export function applyAnimation(el: HTMLElement, preset: AnimationId, opts: ApplyAnimationOptions = {}): () => void {
  if (preset === "none" || prefersReducedMotion()) {
    gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1, filter: "none" });
    return () => {};
  }

  const targets = opts.staggerChildren ? Array.from(el.children) : el;

  switch (preset) {
    case "fade-up": {
      const tween = gsap.from(targets, {
        opacity: 0,
        y: 20,
        duration: duration.slow,
        ease: easeString.standard,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      return () => tween.scrollTrigger?.kill();
    }
    case "fade-in": {
      const tween = gsap.from(targets, {
        opacity: 0,
        duration: duration.slower,
        ease: easeString.standard,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      return () => tween.scrollTrigger?.kill();
    }
    case "slide-in": {
      const fromX = opts.direction === "right" ? 32 : -32;
      const tween = gsap.from(targets, {
        opacity: 0,
        x: fromX,
        duration: duration.slow,
        ease: easeString.standard,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      return () => tween.scrollTrigger?.kill();
    }
    case "scale-in": {
      const tween = gsap.from(targets, {
        opacity: 0,
        scale: 0.92,
        duration: duration.slow,
        ease: "back.out(1.6)",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      return () => tween.scrollTrigger?.kill();
    }
    case "stagger-reveal": {
      const items = Array.from(el.children);
      const tween = gsap.from(items.length > 0 ? items : el, {
        opacity: 0,
        y: 16,
        duration: duration.slow,
        ease: easeString.standard,
        stagger: 0.08,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      return () => tween.scrollTrigger?.kill();
    }
    case "hover-lift": {
      const onEnter = () => gsap.to(el, { y: -4, duration: duration.base, ease: "power2.out" });
      const onLeave = () => gsap.to(el, { y: 0, duration: duration.base, ease: "power2.out" });
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
      return () => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
      };
    }
    case "ken-burns": {
      gsap.set(el, { overflow: "hidden" });
      const tween = gsap.fromTo(
        el,
        { scale: 1.08 },
        { scale: 1, duration: 6, ease: "power1.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } },
      );
      return () => tween.scrollTrigger?.kill();
    }
    case "text-split": {
      const words = el.textContent?.split(" ") ?? [];
      if (words.length > 1) {
        el.innerHTML = words.map((w) => `<span style="display:inline-block">${w}</span>`).join(" ");
      }
      const tween = gsap.from(el.children.length > 0 ? Array.from(el.children) : el, {
        opacity: 0,
        y: 12,
        duration: duration.base,
        ease: easeString.standard,
        stagger: 0.035,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      return () => tween.scrollTrigger?.kill();
    }
    case "parallax": {
      const tween = gsap.to(el, {
        yPercent: 12,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });
      return () => tween.scrollTrigger?.kill();
    }
    case "magnetic": {
      const onMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - rect.left - rect.width / 2) * 0.3,
          y: (e.clientY - rect.top - rect.height / 2) * 0.3,
          duration: duration.base,
          ease: "power2.out",
        });
      };
      const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.4, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
      return () => {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", onLeave);
      };
    }
    case "glass-reveal": {
      gsap.set(el, { backdropFilter: "blur(0px)" });
      const tween = gsap.from(targets, {
        opacity: 0,
        y: 10,
        filter: "blur(6px)",
        duration: duration.slower,
        ease: easeString.standard,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      return () => tween.scrollTrigger?.kill();
    }
    case "gradient-shift": {
      const tween = gsap.to(el, {
        backgroundPosition: "200% center",
        duration: 8,
        ease: "none",
        repeat: -1,
        yoyo: true,
      });
      return () => tween.kill();
    }
    case "sticky-pin": {
      const st = ScrollTrigger.create({ trigger: el, start: "top top", end: "+=400", pin: true, pinSpacing: false });
      return () => st.kill();
    }
    case "lottie": {
      // Placeholder pending a real per-section Lottie-asset upload field -
      // see this file's top-of-file note. Plays a scale+fade entrance so
      // the preset still reads as "something animated," never a silent
      // no-op, while remaining honest that it isn't real Lottie playback.
      const tween = gsap.from(targets, {
        opacity: 0,
        scale: 0.85,
        duration: duration.slow,
        ease: "back.out(1.7)",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      return () => tween.scrollTrigger?.kill();
    }
    default:
      return () => {};
  }
}
