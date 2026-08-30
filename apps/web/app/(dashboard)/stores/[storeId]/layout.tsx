"use client";

import { useEffect, useState } from "react";
import { ConfirmDialogProvider } from "@/components/dashboard/ConfirmDialogProvider";
import { PlatformMessages } from "@/components/dashboard/PlatformMessages";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SupportModeBanner } from "@/components/dashboard/SupportModeBanner";
import { Alert } from "@/components/ui/Alert";
import { api } from "@/lib/dashboard-api";

interface Store {
  id: string;
  name: string;
  status: string;
}

export default function StoreDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { storeId: string };
}) {
  const [store, setStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [dashboardTheme, setDashboardTheme] = useState("default");
  const [hasSuppliers, setHasSuppliers] = useState(false);
  const [planName, setPlanName] = useState<string | undefined>(undefined);

  useEffect(() => {
    api
      .get<Store>(`/stores/${params.storeId}`)
      .then(setStore)
      .catch(() => {});
  }, [params.storeId]);

  // SRS §5.56/FR-56.3 - the store switcher's source list. Fetched once per
  // mount (not per storeId) since it's the seller's whole store set, not
  // scoped to the currently-open one.
  useEffect(() => {
    api
      .get<Store[]>("/stores")
      .then(setStores)
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get<{ dashboardTheme: string }>("/sellers/me")
      .then((profile) => setDashboardTheme(profile.dashboardTheme))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get<unknown[]>(`/stores/${params.storeId}/supplier-links`)
      .then((links) => setHasSuppliers(links.length > 0))
      .catch(() => {});
  }, [params.storeId]);

  // UI/UX Design Phase (Part B item 7) - "plan name shown as small text
  // under Settings." Seller-scoped, not store-scoped (Module 61), same
  // endpoint the Billing page already reads.
  useEffect(() => {
    api
      .get<{ plan: { name: string } }>("/sellers/me/subscription")
      .then((sub) => setPlanName(sub.plan?.name))
      .catch(() => {});
  }, []);

  return (
    <ConfirmDialogProvider>
      <div className="flex h-full flex-col">
        <SupportModeBanner />
        {store?.status === "orders_paused" && (
          <div className="px-6 pt-3">
            <Alert tone="warning">
              This store isn&apos;t accepting new orders right now - your plan fee is overdue.{" "}
              <a href={`/stores/${params.storeId}/billing`} className="font-semibold underline">
                Pay your plan fee
              </a>{" "}
              to resume as soon as it&apos;s verified.
            </Alert>
          </div>
        )}
        <div className="app-shell-surface flex flex-1 flex-col md:flex-row" data-dashboard-theme={dashboardTheme}>
          <Sidebar storeId={params.storeId} storeName={store?.name} showSuppliers={hasSuppliers} stores={stores} planName={planName} />
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8">
            {/* Founder batch A4 - was `mx-auto max-w-5xl`, a hard 1024px cap
                that left ~160px of dead space on a 1440px viewport (measured
                live: 1184px available, only 1024px used) and grows worse on
                wider monitors - grid/table-heavy pages (Products, Orders,
                Analytics, the dashboard gauges) never got to use the room
                they had. Dropped to match the admin terminal's own content
                wrapper (components/admin/.. via (admin)/admin/layout.tsx),
                which already has no such cap. Pages that genuinely want a
                narrower reading width (e.g. Settings' form cards) already
                set their own inner max-w-2xl - unaffected either way. */}
            <div>
              <PlatformMessages />
              {children}
            </div>
          </main>
        </div>
      </div>
    </ConfirmDialogProvider>
  );
}
