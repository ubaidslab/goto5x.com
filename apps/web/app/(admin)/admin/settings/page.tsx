"use client";

import { useEffect, useState } from "react";

interface SettingsDefinition {
  key: string;
  valueType: string;
  allowedScopes: string[];
  defaultValue: unknown;
  description?: string;
}

export default function AdminSettingsPage() {
  const [definitions, setDefinitions] = useState<SettingsDefinition[]>([]);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    const token = localStorage.getItem("adminAccessToken");
    fetch(`${apiBase}/admin/settings/definitions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setDefinitions)
      .catch(() => {});
  }, [apiBase]);

  return (
    <main>
      <h1>Settings Registry (bare view - no design pass yet)</h1>
      <p>Read-only list of every platform setting: its type, allowed scopes, and default value.</p>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Key</th>
            <th>Type</th>
            <th>Allowed scopes</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {definitions.map((d) => (
            <tr key={d.key}>
              <td>{d.key}</td>
              <td>{d.valueType}</td>
              <td>{d.allowedScopes.join(", ")}</td>
              <td>{JSON.stringify(d.defaultValue)}</td>
              <td>{d.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
