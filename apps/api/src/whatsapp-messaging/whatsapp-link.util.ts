/**
 * SRS §5.41/FR-41.1 (Module 30) - the exact same `wa.me` construction as
 * the existing WhatsAppOtpAdapter (Module 26): digits-only phone number,
 * URL-encoded interpolated text. v1.0 never sends anything itself - the
 * seller taps this link and sends it from their own connected WhatsApp app.
 */
export function buildWhatsAppDeepLink(buyerWhatsapp: string, message: string): string {
  const digitsOnly = buyerWhatsapp.replace(/[^\d]/g, "");
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}

/** Replaces every `{{key}}` in `template` with `vars[key]`; an unrecognized placeholder is left as-is rather than silently dropped. */
export function interpolateWhatsAppTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}
