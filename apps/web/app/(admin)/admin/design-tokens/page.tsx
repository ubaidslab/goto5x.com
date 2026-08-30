"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { AdminApiError, adminApi } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";

interface DesignToken {
  key: string;
  cssVar: string;
  label: string;
  description: string;
  defaultValue: string;
  effectiveValue: string;
  hasOverride: boolean;
  locked: boolean;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Module 92 (SRS §5.68/FR-68.5). Writes/lock-toggles reuse the generic
 * Settings Registry endpoints unchanged (PUT admin/settings/values and
 * .../values/lock) - this screen is a curated view, not a parallel write
 * path. Reads come from the one design-tokens aggregate endpoint so this
 * page doesn't need 13 separate /admin/settings/resolve calls.
 */
export default function AdminDesignTokensPage() {
  const confirm = useConfirm();
  const [tokens, setTokens] = useState<DesignToken[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [locking, setLocking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  function load() {
    adminApi
      .get<DesignToken[]>("/admin/design-tokens")
      .then((rows) => {
        setTokens(rows);
        // Only seed a draft the first time a token is seen - reloading
        // after a save must not clobber an in-progress edit on some OTHER
        // still-unsaved token's field.
        setDrafts((prev) => {
          const next = { ...prev };
          for (const row of rows) {
            if (next[row.key] === undefined) next[row.key] = row.effectiveValue;
          }
          return next;
        });
      })
      .catch(() => setTokens([]));
  }

  useEffect(load, []);

  if (tokens === null) return <PageSpinner />;

  function draftFor(key: string, fallback: string): string {
    const draft = drafts[key];
    return draft && HEX_RE.test(draft) ? draft : fallback;
  }

  async function save(token: DesignToken) {
    setError(null);
    setSavedKey(null);
    const draft = drafts[token.key] ?? "";
    if (!HEX_RE.test(draft)) {
      setError(`"${token.label}" needs a 6-digit hex color like #0d530e.`);
      return;
    }

    const ok = await confirm({
      title: `Change "${token.label}"?`,
      description:
        "This is a platform-wide brand color (FR-8.16 high-impact key) - it takes effect on every marketing, storefront, dashboard, and admin page immediately, with no deploy.",
      changes: [{ label: token.label, from: token.effectiveValue, to: draft }],
      confirmLabel: "Apply change",
      tone: "danger",
    });
    if (!ok) return;

    setSaving(token.key);
    try {
      await adminApi.put("/admin/settings/values", {
        key: token.key,
        scopeType: "global",
        value: draft,
      });
      setSavedKey(token.key);
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't save this color.");
    } finally {
      setSaving(null);
    }
  }

  async function toggleLock(token: DesignToken) {
    setError(null);
    setSavedKey(null);

    if (token.locked) {
      const ok = await confirm({
        title: `Unlock "${token.label}"?`,
        description: "Unlocking removes the safeguard that stops this color from being changed again - the value stays as-is until someone edits and saves it.",
        changes: [{ label: token.label, from: "Locked", to: "Unlocked" }],
        confirmLabel: "Unlock",
        tone: "danger",
      });
      if (!ok) return;
    }

    setLocking(token.key);
    try {
      await adminApi.put("/admin/settings/values/lock", {
        key: token.key,
        scopeType: "global",
        locked: !token.locked,
      });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't change the lock state.");
    } finally {
      setLocking(null);
    }
  }

  // Every draft value, composed into one CSS custom-property override map -
  // the preview panel below sets these on its own wrapper, and its inner
  // markup reuses the real bg-canvas/text-ink/bg-accent/etc utility classes
  // unchanged, so the cascade does the rendering: this is what the real
  // site would look like with these exact values, not an approximation.
  const previewVars = Object.fromEntries(
    tokens.map((t) => [t.cssVar, draftFor(t.key, t.effectiveValue)]),
  ) as Record<string, string>;

  return (
    <div>
      <PageHeader
        title="Design tokens"
        description="The platform's 13 core brand colors. Edit a value to preview it below before saving - nothing changes site-wide until you save. Lock a token once it's right to stop it being changed again."
      />

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <DashCard className="mb-6">
        <DashCardHeader title="Live preview" description="Reflects every unsaved edit below, together - exactly how the real site would render these values." />
        <div className="p-4">
          <div className="overflow-hidden rounded-lg border" style={{ ...previewVars, borderColor: "var(--color-border-strong)" } as React.CSSProperties}>
            <div className="bg-canvas p-6">
              <div className="rounded-lg bg-surface p-5" style={{ border: "1px solid var(--color-border)" }}>
                <h3 className="font-display text-lg font-bold text-ink">Sample heading</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Body text like this is what a seller or buyer reads everywhere - it must always stay a neutral, never the accent color.
                </p>
                <p className="mt-1 text-xs text-ink-faint">Faint helper text, for de-emphasized captions.</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button type="button" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent">
                    Primary button
                  </button>
                  <button type="button" className="rounded-md px-4 py-2 text-sm font-medium text-ink" style={{ border: "1px solid var(--color-border-strong)" }}>
                    Secondary button
                  </button>
                  <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-medium text-ink">Accent-subtle chip</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashCard>

      <Reveal className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.04}>
        {tokens.map((token) => {
          const draft = drafts[token.key] ?? token.effectiveValue;
          const swatch = draftFor(token.key, token.effectiveValue);
          return (
            <DashCard key={token.key}>
              <DashCardHeader
                title={token.label}
                description={token.cssVar}
                action={
                  token.locked ? (
                    <Badge tone="warning">locked</Badge>
                  ) : token.hasOverride ? (
                    <Badge tone="info">overridden</Badge>
                  ) : undefined
                }
              />
              <div className="space-y-3 p-4">
                <p className="text-xs text-ink-muted">{token.description}</p>

                <div className="flex items-center gap-2">
                  <span
                    className="h-9 w-9 shrink-0 rounded-md"
                    style={{ backgroundColor: swatch, border: "1px solid var(--color-border-strong)" }}
                    aria-hidden
                  />
                  <div className="flex-1">
                    <Field label="Hex value">
                      <Input
                        value={draft}
                        disabled={token.locked}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [token.key]: e.target.value }))}
                        placeholder={token.defaultValue}
                        aria-invalid={draft.length > 0 && !HEX_RE.test(draft)}
                      />
                    </Field>
                  </div>
                </div>

                {savedKey === token.key && (
                  <Alert tone="success" className="text-xs">
                    Saved - live everywhere now.
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button size="sm" loading={saving === token.key} disabled={token.locked} onClick={() => save(token)}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant={token.locked ? "secondary" : "outline"}
                    loading={locking === token.key}
                    onClick={() => toggleLock(token)}
                  >
                    {token.locked ? "Unlock" : "Lock"}
                  </Button>
                </div>
              </div>
            </DashCard>
          );
        })}
      </Reveal>
    </div>
  );
}
