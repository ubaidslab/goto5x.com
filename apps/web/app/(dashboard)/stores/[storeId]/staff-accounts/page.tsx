"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Switch } from "@/components/ui/Switch";
import { UpgradeLockedCard } from "@/components/ui/UpgradeLockedCard";
import { ApiError, api } from "@/lib/dashboard-api";
import { planTierSubtitle } from "@/lib/plan-tier-copy";

// SRS §5.52/FR-52.7 (Module 97) - grew from 5 to 9 scopes.
type StaffScope = "orders" | "catalog" | "discounts" | "customers" | "design" | "analytics" | "marketing" | "reviews" | "suppliers";
type StaffPermission = "read" | "write";
// FR-52.14 (Module 101, founder batch B14) - suspended/blocked are
// admin-initiated states the owner can see but not cause or reverse.
type StaffAccountStatus = "active" | "revoked" | "suspended" | "blocked";

interface ScopePermission {
  scope: StaffScope;
  permission: StaffPermission;
}

interface StaffAccount {
  id: string;
  email: string;
  name: string | null;
  status: StaffAccountStatus;
  createdAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
  deviceRestrictionEnabled: boolean;
  scopePermissions: ScopePermission[];
  // FR-52.14 - admin-set, read-only from the owner's side.
  suspendedUntil: string | null;
}

const STATUS_TONE: Record<StaffAccountStatus, "success" | "warning" | "danger"> = {
  active: "success",
  suspended: "warning",
  blocked: "danger",
  revoked: "danger",
};

interface RoleTemplate {
  key: string;
  label: string;
  description: string;
  scopePermissions: ScopePermission[];
}

interface StaffDevice {
  id: string;
  deviceId: string;
  approved: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  approvedAt: string | null;
  revokedAt: string | null;
}

interface ActivityEntry {
  staffAccountId: string;
  summary: string;
}

const SCOPE_LABELS: Record<StaffScope, string> = {
  orders: "Orders",
  catalog: "Catalog",
  discounts: "Discounts",
  customers: "Customers",
  design: "Store design (customizer)",
  analytics: "Analytics",
  marketing: "Marketing",
  reviews: "Reviews",
  suppliers: "Suppliers",
};

const ALL_SCOPES = Object.keys(SCOPE_LABELS) as StaffScope[];
const DEVICE_RESTRICTION_MIN_TIER = 2; // RISE

function permissionMapFrom(scopePermissions: ScopePermission[]): Partial<Record<StaffScope, StaffPermission>> {
  return Object.fromEntries(scopePermissions.map((sp) => [sp.scope, sp.permission]));
}

function toScopePermissions(map: Partial<Record<StaffScope, StaffPermission>>): ScopePermission[] {
  return ALL_SCOPES.filter((scope) => map[scope]).map((scope) => ({ scope, permission: map[scope]! }));
}

/** SRS §5.52/FR-52.8 - a real, enforced permission per scope: None / View only / Can edit ("analytics" never offers "Can edit"). */
function ScopePermissionGrid({
  value,
  onChange,
}: {
  value: Partial<Record<StaffScope, StaffPermission>>;
  onChange: (next: Partial<Record<StaffScope, StaffPermission>>) => void;
}) {
  function setScope(scope: StaffScope, permission: StaffPermission | null) {
    const next = { ...value };
    if (permission) next[scope] = permission;
    else delete next[scope];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {ALL_SCOPES.map((scope) => {
        const current = value[scope] ?? null;
        return (
          <div key={scope} className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
            <span className="text-sm text-ink">{SCOPE_LABELS[scope]}</span>
            <div className="flex shrink-0 gap-1">
              {(
                [
                  { key: null, label: "None" },
                  { key: "read" as const, label: "View" },
                  ...(scope === "analytics" ? [] : [{ key: "write" as const, label: "Edit" }]),
                ] as { key: StaffPermission | null; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setScope(scope, opt.key)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    current === opt.key
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-canvas text-ink-muted hover:text-ink"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * SRS §5.52/FR-52.1-52.13 - owner-only management of staff sub-accounts.
 * Seller-scoped, not store-scoped - a hire's access spans every store the
 * owner has, same as the underlying StaffAccount model.
 */
export default function StaffAccountsPage() {
  const [staff, setStaff] = useState<StaffAccount[] | null>(null);
  const [templates, setTemplates] = useState<RoleTemplate[] | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [tierOrder, setTierOrder] = useState<number | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<Partial<Record<StaffScope, StaffPermission>>>({});
  const [draftExpiresAt, setDraftExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [devicesByStaffId, setDevicesByStaffId] = useState<Record<string, StaffDevice[]>>({});

  function load() {
    api
      .get<StaffAccount[]>(`/sellers/me/staff-accounts`)
      .then(setStaff)
      .catch(() => setStaff([]));
  }
  function loadActivity() {
    api
      .get<ActivityEntry[]>(`/sellers/me/staff-accounts/activity`)
      .then(setActivity)
      .catch(() => setActivity([]));
  }

  useEffect(load, []);
  useEffect(loadActivity, []);
  useEffect(() => {
    api
      .get<RoleTemplate[]>(`/sellers/me/staff-accounts/role-templates`)
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);
  useEffect(() => {
    api
      .get<{ plan: { tierOrder: number } }>("/sellers/me/subscription")
      .then((sub) => setTierOrder(sub.plan.tierOrder))
      .catch(() => setTierOrder(0));
  }, []);

  if (!staff || !templates || tierOrder === null) return <PageSpinner />;

  const deviceRestrictionUnlocked = tierOrder >= DEVICE_RESTRICTION_MIN_TIER;

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const scopePermissions = toScopePermissions(draftPermissions);
    if (scopePermissions.length === 0) {
      setError("Select at least one scope for this staff account.");
      return;
    }
    setCreating(true);
    const form = new FormData(e.currentTarget);
    try {
      await api.post(`/sellers/me/staff-accounts`, {
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name") || undefined,
        scopePermissions,
        expiresAt: draftExpiresAt ? new Date(draftExpiresAt).toISOString() : undefined,
      });
      (e.target as HTMLFormElement).reset();
      setDraftPermissions({});
      setDraftExpiresAt("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create that staff account.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setError(null);
    try {
      await api.delete(`/sellers/me/staff-accounts/${id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke that staff account.");
    }
  }

  async function saveAccount(
    id: string,
    updates: { scopePermissions?: ScopePermission[]; expiresAt?: string | null; deviceRestrictionEnabled?: boolean },
  ) {
    setError(null);
    try {
      await api.patch(`/sellers/me/staff-accounts/${id}`, updates);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that staff account.");
    }
  }

  function loadDevices(staffId: string) {
    api
      .get<StaffDevice[]>(`/sellers/me/staff-accounts/${staffId}/devices`)
      .then((devices) => setDevicesByStaffId((prev) => ({ ...prev, [staffId]: devices })))
      .catch(() => {});
  }

  async function approveDevice(staffId: string, deviceId: string) {
    await api.patch(`/sellers/me/staff-accounts/${staffId}/devices/${encodeURIComponent(deviceId)}/approve`);
    loadDevices(staffId);
  }
  async function revokeDevice(staffId: string, deviceId: string) {
    await api.patch(`/sellers/me/staff-accounts/${staffId}/devices/${encodeURIComponent(deviceId)}/revoke`);
    loadDevices(staffId);
  }
  async function revokeAllDevices() {
    setError(null);
    try {
      await api.post(`/sellers/me/staff-accounts/devices/revoke-all`);
      for (const id of Object.keys(devicesByStaffId)) loadDevices(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke devices.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Staff Accounts"
        description="Give team members scoped, login-only access to specific parts of your stores - never billing or plan settings."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Add a staff account" />
          <CardBody>
            <Alert tone="info" className="mb-4">
              For example, give a designer only the &quot;Store design&quot; scope so they can use the customizer
              without ever seeing your orders, wallet, or plan.
            </Alert>

            {templates.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">Start from a role</p>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      title={t.description}
                      onClick={() => setDraftPermissions(permissionMapFrom(t.scopePermissions))}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Email">
                <Input name="email" type="email" required placeholder="hire@example.com" />
              </Field>
              <Field label="Name (optional)">
                <Input name="name" placeholder="e.g. Ali" />
              </Field>
              <Field label="Password">
                <Input name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
              </Field>
              <Field label="Access" hint="Pick a role above, or set each scope individually. A template is just a starting point - edit freely.">
                <ScopePermissionGrid value={draftPermissions} onChange={setDraftPermissions} />
              </Field>
              <Field label="Access expires (optional)" hint="Leave blank for no expiry. Auto-revokes once passed - never deletes the account.">
                <Input type="date" value={draftExpiresAt} onChange={(e) => setDraftExpiresAt(e.target.value)} />
              </Field>
              <Button type="submit" loading={creating}>
                Create staff account
              </Button>
            </form>
          </CardBody>
        </Card>

        {staff.length === 0 ? (
          <Card>
            <EmptyState title="No staff accounts yet" description="Add one above to give a team member scoped access." />
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {staff.map((account) => {
              const devices = devicesByStaffId[account.id];
              return (
                <div key={account.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{account.name || account.email}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">{account.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {account.scopePermissions.map((sp) => (
                          <Badge key={sp.scope} tone="neutral">
                            {SCOPE_LABELS[sp.scope]} ({sp.permission === "write" ? "edit" : "view"})
                          </Badge>
                        ))}
                      </div>
                      {account.expiresAt && (
                        <p className="mt-1.5 text-xs text-ink-muted">Access expires {new Date(account.expiresAt).toLocaleDateString()}</p>
                      )}
                      {account.status === "suspended" && account.suspendedUntil && (
                        <p className="mt-1.5 text-xs text-ink-muted">
                          Suspended by platform admin until {new Date(account.suspendedUntil).toLocaleDateString()}
                        </p>
                      )}
                      {account.status === "blocked" && (
                        <p className="mt-1.5 text-xs text-ink-muted">Blocked by platform admin - contact support for details.</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone={STATUS_TONE[account.status]}>{account.status}</Badge>
                      {account.status === "active" && (
                        <Button variant="secondary" size="sm" onClick={() => handleRevoke(account.id)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>

                  {account.status === "active" && (
                    <div className="mt-3">
                      <Disclosure label="Manage access">
                        <StaffAccountManagePanel
                          account={account}
                          deviceRestrictionUnlocked={deviceRestrictionUnlocked}
                          devices={devices}
                          onSave={(updates) => saveAccount(account.id, updates)}
                          onToggleDeviceRestriction={(enabled) => saveAccount(account.id, { deviceRestrictionEnabled: enabled })}
                          onLoadDevices={() => loadDevices(account.id)}
                          onApproveDevice={(deviceId) => approveDevice(account.id, deviceId)}
                          onRevokeDevice={(deviceId) => revokeDevice(account.id, deviceId)}
                        />
                      </Disclosure>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}

        {deviceRestrictionUnlocked && (
          <Card>
            <CardHeader
              title="Device security"
              description="If you suspect a staff device has been compromised, revoke every approved device across every staff account at once."
            />
            <CardBody>
              <Button variant="danger" onClick={revokeAllDevices}>
                Revoke all staff devices
              </Button>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="Staff activity" description="What your team has been doing, in plain language." />
          <CardBody>
            {!activity || activity.length === 0 ? (
              <EmptyState title="No activity yet" description="Once a staff account makes changes, you'll see a summary here." />
            ) : (
              <ul className="space-y-2">
                {activity.map((entry, i) => (
                  <li key={i} className="text-sm text-ink">
                    {entry.summary}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function StaffAccountManagePanel({
  account,
  deviceRestrictionUnlocked,
  devices,
  onSave,
  onToggleDeviceRestriction,
  onLoadDevices,
  onApproveDevice,
  onRevokeDevice,
}: {
  account: StaffAccount;
  deviceRestrictionUnlocked: boolean;
  devices: StaffDevice[] | undefined;
  onSave: (updates: { scopePermissions?: ScopePermission[]; expiresAt?: string | null }) => void;
  onToggleDeviceRestriction: (enabled: boolean) => void;
  onLoadDevices: () => void;
  onApproveDevice: (deviceId: string) => void;
  onRevokeDevice: (deviceId: string) => void;
}) {
  const [permissions, setPermissions] = useState<Partial<Record<StaffScope, StaffPermission>>>(
    permissionMapFrom(account.scopePermissions),
  );
  const [expiresAt, setExpiresAt] = useState(account.expiresAt ? account.expiresAt.slice(0, 10) : "");

  useEffect(() => {
    if (account.deviceRestrictionEnabled) onLoadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.deviceRestrictionEnabled]);

  function save() {
    const scopePermissions = toScopePermissions(permissions);
    onSave({ scopePermissions, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null });
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-canvas p-4">
      <ScopePermissionGrid value={permissions} onChange={setPermissions} />
      <Field label="Access expires" hint="Leave blank for no expiry.">
        <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      </Field>
      <Button size="sm" onClick={save}>
        Save changes
      </Button>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-sm font-medium text-ink">Device-based access restriction</p>
        {!deviceRestrictionUnlocked ? (
          <UpgradeLockedCard
            requiredTier={planTierSubtitle("RISE") ? `RISE (${planTierSubtitle("RISE")})` : "RISE"}
            title="Restrict this account to approved devices"
            description="Only let this staff member sign in from devices you've explicitly approved - a first login from anywhere else waits for your approval."
          />
        ) : (
          <StaffDeviceSection
            enabled={account.deviceRestrictionEnabled}
            devices={devices}
            onToggle={onToggleDeviceRestriction}
            onApprove={onApproveDevice}
            onRevoke={onRevokeDevice}
          />
        )}
      </div>
    </div>
  );
}

function StaffDeviceSection({
  enabled,
  devices,
  onToggle,
  onApprove,
  onRevoke,
}: {
  enabled: boolean;
  devices: StaffDevice[] | undefined;
  onToggle: (enabled: boolean) => void;
  onApprove: (deviceId: string) => void;
  onRevoke: (deviceId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-muted">Require approved devices to sign in</span>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </label>
      {enabled && (
        <div className="space-y-2">
          {!devices || devices.length === 0 ? (
            <p className="text-xs text-ink-muted">No sign-in attempts from any device yet.</p>
          ) : (
            devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs text-ink">{d.deviceId}</p>
                  <p className="text-xs text-ink-faint">First seen {new Date(d.firstSeenAt).toLocaleDateString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={d.approved ? "success" : "warning"}>{d.approved ? "approved" : "pending"}</Badge>
                  {d.approved ? (
                    <Button variant="ghost" size="sm" onClick={() => onRevoke(d.deviceId)}>
                      Revoke
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => onApprove(d.deviceId)}>
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
