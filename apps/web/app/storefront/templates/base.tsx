import { AboutSection, FaqSection, FeaturedProductsSection, HeroSection, NewsletterSection } from "../sections";
import { TemplateSectionSet } from "./types";

/**
 * "Start from blank"'s section set - deliberately the plainest rendering
 * (the original bare-functional components), since blank-start is about an
 * empty section LIST the seller composes from scratch, never a competing
 * visual identity of its own. Also the fallback for any theme name this
 * registry doesn't otherwise recognize.
 */
export const baseSections: Pick<TemplateSectionSet, "Hero" | "FeaturedProducts" | "About" | "Newsletter" | "Faq"> = {
  Hero: HeroSection,
  FeaturedProducts: FeaturedProductsSection,
  About: AboutSection,
  Newsletter: NewsletterSection,
  Faq: FaqSection,
};
