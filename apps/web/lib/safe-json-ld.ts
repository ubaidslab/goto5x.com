/**
 * P1.4 input-validation sweep (docs/security-audit-report.md) - JSON.stringify()
 * does not escape "<", so a seller-controlled string reaching a JSON-LD block
 * (e.g. a product title of `</script><script>alert(1)</script>`) can close
 * the surrounding <script> tag early and inject a real, executable one - a
 * stored-XSS vector every buyer who views that page would hit. Escaping "<"
 * as its unicode form neutralizes </script>, <!--, and any other HTML-
 * sensitive sequence while staying valid, semantically identical JSON (a
 * JSON string may contain a raw or a \u-escaped "<" interchangeably).
 */
export function safeJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
