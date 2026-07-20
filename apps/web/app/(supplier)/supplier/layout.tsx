export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell-surface min-h-full">
      <header className="border-b border-border px-6 py-4">
        <p className="text-sm font-semibold text-ink">goto5x.com - Supplier Portal</p>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
