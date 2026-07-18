"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { api } from "@/lib/dashboard-api";

interface Store {
  id: string;
  name: string;
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
    <div className="app-shell-surface flex" data-dashboard-theme={dashboardTheme}>
      <Sidebar storeId={params.storeId} storeName={store?.name} showSuppliers={hasSuppliers} />
      <main className="flex-1 overflow-y-auto px-10 py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
