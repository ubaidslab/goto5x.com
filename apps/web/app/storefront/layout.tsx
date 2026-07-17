// Overrides the root layout's narrow (480px) auth-form width - the
// storefront needs the full viewport, not a centered form column. Still
// "bare functional, no design pass yet" per every other page in this repo
// (docs/build-plan.md) - this is a layout reset, not a visual pass.
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: "none", margin: 0, padding: 0 }}>{children}</div>;
}
