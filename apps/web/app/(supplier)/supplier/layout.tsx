import { PlatformMessages } from "@/components/dashboard/PlatformMessages";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell-surface min-h-full">
      <header className="border-b border-border px-6 py-4">
        <p className="text-sm font-semibold text-ink">uzeyn.com - Supplier Portal</p>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Phase 3 item 17 (SRS FR-8.22) - suppliers previously had no messaging delivery path at all. */}
        <PlatformMessages basePath="/supplier/messages" />
        {children}
      </main>
    </div>
  );
}
