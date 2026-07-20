"use client";

import { useEffect, useState } from "react";
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
  const [dashboardTheme, setDashboardTheme] = useState("default");
  const [hasSuppliers, setHasSuppliers] = useState(false);

  useEffect(() => {
    api
      .get<Store>(`/stores/${params.storeId}`)
      .then(setStore)
      .catch(() => {});
  }, [params.storeId]);

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

  return (
    <div className="flex h-full flex-col" data-dashboard-theme={dashboardTheme}>
      <SupportModeBanner />
      {store?.status === "orders_paused" && (
        <div className="px-6 pt-3">
          <Alert tone="warning">
            This store isn&apos;t accepting new orders right now - your wallet balance is too low.{" "}
            <a href={`/stores/${params.storeId}/wallet`} className="font-semibold underline">
              Top up your wallet
            </a>{" "}
            to resume instantly.
          </Alert>
        </div>
      )}
      <div className="app-shell-surface flex flex-1">
        <Sidebar storeId={params.storeId} storeName={store?.name} showSuppliers={hasSuppliers} />
        <main className="flex-1 overflow-y-auto px-10 py-8">
          <div className="mx-auto max-w-5xl">
            <PlatformMessages />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
