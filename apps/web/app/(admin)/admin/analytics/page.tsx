"use client";

import { useEffect, useState } from "react";

interface Analytics {
  gmv: number;
  revenue: number;
  commissionEarned: number;
  activeStoreCount: number;
  topSellers: { sellerId: string; businessName: string | null; commissionEarned: number }[];
}

interface UnitEconomics {
  freeStoreCount: number;
  paidStoreCount: number;
  commissionFromFreeStores: number;
  commissionFromPaidStores: number;
  monthlyInfraCost: number;
  breakEven: number;
}

/**
 * SRS FR-8.10 (real-time platform analytics) + FR-23.4 (unit-economics,
 * data-only since Module 14) - one dashboard, both views, bare view (no
 * design pass yet, same precedent as every other admin screen).
 */
export default function AdminAnalyticsPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [unitEconomics, setUnitEconomics] = useState<UnitEconomics | null>(null);

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("adminAccessToken");
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    fetch(`${apiBase}/admin/analytics`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setAnalytics)
      .catch(() => {});
    fetch(`${apiBase}/admin/unit-economics`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setUnitEconomics)
      .catch(() => {});
  }, [apiBase]);

  if (!analytics || !unitEconomics) return <p>Loading...</p>;

  return (
    <main>
      <h1>Platform analytics (bare view - no design pass yet)</h1>
      <p>Real-time GMV, revenue, and unit-economics - computed live against transactional data.</p>

      <h2>Real-time analytics (FR-8.10)</h2>
      <table border={1} cellPadding={4}>
        <tbody>
          <tr>
            <td>GMV</td>
            <td>{analytics.gmv.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Revenue (commission earned)</td>
            <td>{analytics.revenue.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Active stores</td>
            <td>{analytics.activeStoreCount}</td>
          </tr>
        </tbody>
      </table>

      <h3>Top sellers by commission earned</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Seller</th>
            <th>Commission earned</th>
          </tr>
        </thead>
        <tbody>
          {analytics.topSellers.map((s) => (
            <tr key={s.sellerId}>
              <td>{s.businessName ?? s.sellerId}</td>
              <td>{s.commissionEarned.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Unit economics (FR-23.4)</h2>
      <table border={1} cellPadding={4}>
        <tbody>
          <tr>
            <td>Free-plan stores</td>
            <td>{unitEconomics.freeStoreCount}</td>
          </tr>
          <tr>
            <td>Paid-plan stores</td>
            <td>{unitEconomics.paidStoreCount}</td>
          </tr>
          <tr>
            <td>Commission from free-plan stores</td>
            <td>{unitEconomics.commissionFromFreeStores.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Commission from paid-plan stores</td>
            <td>{unitEconomics.commissionFromPaidStores.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Monthly infra cost (admin-entered)</td>
            <td>{unitEconomics.monthlyInfraCost.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Break-even (commission - infra cost)</td>
            <td>{unitEconomics.breakEven.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
