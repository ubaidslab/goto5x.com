"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResolvedThemeSettings } from "../../../lib/theme-presets";
import {
  BuyerAddressInput,
  buyerLogoutAction,
  createAddressAction,
  deleteAddressAction,
  updateAddressAction,
  updateProfileAction,
} from "./actions";

export interface BuyerProfile {
  id: string;
  email: string;
  displayName: string | null;
}

export interface BuyerAddress extends BuyerAddressInput {
  id: string;
}

const inputStyle = { padding: 8, borderRadius: 8, border: "1px solid #d1d5db", width: "100%" } as const;
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13 };
const cardStyle = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16 };

const EMPTY_ADDRESS: BuyerAddressInput = {
  label: "",
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  country: "PK",
  postalCode: "",
  phone: "",
  isDefault: false,
};

/** FR-66.1 (Module 81) - profile + saved-address management, client-side for the edit/add forms. */
export function AccountView({ theme, profile, addresses }: { theme: ResolvedThemeSettings; profile: BuyerProfile; addresses: BuyerAddress[] }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<BuyerAddressInput>(EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    await updateProfileAction(displayName.trim());
    setSavingProfile(false);
    router.refresh();
  }

  function startEdit(address?: BuyerAddress) {
    setForm(address ?? EMPTY_ADDRESS);
    setEditingId(address ? address.id : "new");
    setError(null);
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = editingId && editingId !== "new" ? await updateAddressAction(editingId, form) : await createAddressAction(form);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function removeAddress(id: string) {
    await deleteAddressAction(id);
    router.refresh();
  }

  async function logout() {
    await buyerLogoutAction();
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Your account</h1>
        <button
          type="button"
          onClick={logout}
          style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
        >
          Sign out
        </button>
      </div>

      <div style={cardStyle}>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{profile.email}</p>
        <form onSubmit={saveProfile} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Name
            <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} />
          </label>
          <button
            type="submit"
            disabled={savingProfile}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: theme.colors.primary, color: "#fff", fontWeight: 600 }}
          >
            Save
          </button>
        </form>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 16 }}>Saved addresses</h2>
        {editingId === null && (
          <button
            type="button"
            onClick={() => startEdit()}
            style={{ color: theme.colors.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            + Add address
          </button>
        )}
      </div>

      {addresses.length === 0 && editingId === null && <p style={{ fontSize: 13, color: "#6b7280" }}>No saved addresses yet.</p>}

      {addresses.map(
        (a) =>
          editingId !== a.id && (
            <div key={a.id} style={cardStyle}>
              <strong>{a.label || a.fullName}</strong>
              {a.isDefault && <span style={{ marginLeft: 8, fontSize: 12, color: theme.colors.primary }}>Default</span>}
              <p style={{ fontSize: 13, color: "#4b5563", margin: "4px 0" }}>
                {a.fullName}, {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.country}
                {a.postalCode ? ` ${a.postalCode}` : ""} - {a.phone}
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" onClick={() => startEdit(a)} style={{ background: "none", border: "none", color: theme.colors.primary, cursor: "pointer", padding: 0 }}>
                  Edit
                </button>
                <button type="button" onClick={() => removeAddress(a.id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 0 }}>
                  Remove
                </button>
              </div>
            </div>
          ),
      )}

      {editingId !== null && (
        <form onSubmit={saveAddress} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={labelStyle}>
            Label (optional, e.g. "Home")
            <input style={inputStyle} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={60} />
          </label>
          <label style={labelStyle}>
            Full name
            <input style={inputStyle} required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </label>
          <label style={labelStyle}>
            Address line 1
            <input style={inputStyle} required value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
          </label>
          <label style={labelStyle}>
            Address line 2 (optional)
            <input style={inputStyle} value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              City
              <input style={inputStyle} required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>
            <label style={{ ...labelStyle, width: 100 }}>
              Country
              <input style={inputStyle} required maxLength={2} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              Postal code (optional)
              <input style={inputStyle} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              Phone
              <input style={inputStyle} required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Set as default
          </label>

          {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: theme.colors.primary, color: "#fff", fontWeight: 600 }}
            >
              {saving ? "Saving..." : "Save address"}
            </button>
            <button type="button" onClick={() => setEditingId(null)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "none" }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <p style={{ marginTop: 20 }}>
        <a href="/account/orders" style={{ color: theme.colors.primary, fontWeight: 600 }}>
          View order history &rarr;
        </a>
      </p>
      <p style={{ marginTop: 8 }}>
        <a href="/account/wishlist" style={{ color: theme.colors.primary, fontWeight: 600 }}>
          View saved items &rarr;
        </a>
      </p>
    </div>
  );
}
