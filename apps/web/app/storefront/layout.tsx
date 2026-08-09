import { headers } from "next/headers";
import { fetchStorefrontStore } from "../../lib/storefront-api";
import { parseHeadTags } from "../../lib/parse-head-tags";

// Overrides the root layout's narrow (480px) auth-form width - the
// storefront needs the full viewport, not a centered form column. Still
// "bare functional, no design pass yet" per every other page in this repo
// (docs/build-plan.md) - this is a layout reset, not a visual pass.
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  // Module 58 (SRS §5.65, FR-65.4) - rendered as literal <meta>/<link>/
  // <script> elements (not dangerouslySetInnerHTML) so React 19's built-in
  // metadata hoisting moves them into <head>; this non-root layout cannot
  // render a literal <head> tag itself. See parseHeadTags()'s own comment
  // for why parsing an already-server-sanitized string here is safe.
  const headTags = store?.customHeadTags ? parseHeadTags(store.customHeadTags) : [];

  return (
    <div style={{ maxWidth: "none", margin: 0, padding: 0 }}>
      {headTags.map((tag, i) => {
        if (tag.kind === "meta") return <meta key={i} {...tag.attrs} />;
        if (tag.kind === "link") return <link key={i} {...tag.attrs} />;
        // eslint-disable-next-line react/no-danger
        return <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: tag.json }} />;
      })}
      {children}
    </div>
  );
}
