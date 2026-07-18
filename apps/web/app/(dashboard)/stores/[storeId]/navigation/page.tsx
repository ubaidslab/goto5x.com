"use client";

import { useEffect, useState } from "react";
import { NavigationItem } from "@/lib/storefront-api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError, api } from "@/lib/dashboard-api";

type Location = "header" | "footer";

const EMPTY_ITEM: NavigationItem = { type: "link", label: "", targetType: "external", url: "" };

/**
 * SRS FR-16.3. One flat list per location, saved with a single PUT - the
 * API replaces the whole `items` array on each save (no per-item CRUD
 * endpoints), matching how store_navigation_menus is one row per
 * (store, location), not a table of individual rows.
 */
export default function NavigationEditorPage({ params }: { params: { storeId: string } }) {
  const [location, setLocation] = useState<Location>("header");
  const [items, setItems] = useState<NavigationItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<{ items?: NavigationItem[] }>(`/stores/${params.storeId}/navigation/${location}`)
      .then((menu) => setItems(menu.items ?? []))
      .catch(() => setItems([]));
  }, [params.storeId, location]);

  function updateItem(index: number, patch: Partial<NavigationItem>) {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    setItems(next);
  }

  function addItem() {
    setItems([...items, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api.put(`/stores/${params.storeId}/navigation/${location}`, { items });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the navigation menu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Navigation" description="The header and footer menus shown on your storefront." />

      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Saved.</Alert>}

      <div className="max-w-2xl space-y-6">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" checked={location === "header"} onChange={() => setLocation("header")} />
            Header
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" checked={location === "footer"} onChange={() => setLocation("footer")} />
            Footer
          </label>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <Card key={index}>
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type">
                    <Select value={item.type} onChange={(e) => updateItem(index, { type: e.target.value as NavigationItem["type"] })}>
                      <option value="link">Link</option>
                      <option value="text_block">Text block</option>
                      <option value="social_links">Social links</option>
                    </Select>
                  </Field>

                  {item.type === "link" && (
                    <Field label="Label">
                      <Input value={item.label ?? ""} onChange={(e) => updateItem(index, { label: e.target.value })} />
                    </Field>
                  )}
                </div>

                {item.type === "link" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Links to">
                      <Select
                        value={item.targetType ?? "external"}
                        onChange={(e) => updateItem(index, { targetType: e.target.value as NavigationItem["targetType"] })}
                      >
                        <option value="external">External URL</option>
                        <option value="collection">Collection</option>
                        <option value="content_page">Content page</option>
                      </Select>
                    </Field>
                    {item.targetType === "external" ? (
                      <Field label="URL">
                        <Input placeholder="https://…" value={item.url ?? ""} onChange={(e) => updateItem(index, { url: e.target.value })} />
                      </Field>
                    ) : (
                      <Field label="Target ID">
                        <Input value={item.targetId ?? ""} onChange={(e) => updateItem(index, { targetId: e.target.value })} />
                      </Field>
                    )}
                  </div>
                )}

                {item.type === "text_block" && (
                  <Field label="Free text">
                    <Input
                      value={typeof item.body === "string" ? item.body : ""}
                      onChange={(e) => updateItem(index, { body: e.target.value })}
                    />
                  </Field>
                )}

                {item.type === "social_links" && (
                  <div className="grid grid-cols-2 gap-3">
                    {(["facebook", "instagram", "tiktok", "twitter"] as const).map((platform) => {
                      const body = (typeof item.body === "object" ? item.body : {}) as Record<string, string>;
                      return (
                        <Field key={platform} label={platform}>
                          <Input value={body[platform] ?? ""} onChange={(e) => updateItem(index, { body: { ...body, [platform]: e.target.value } })} />
                        </Field>
                      );
                    })}
                  </div>
                )}

                <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                  Remove
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={addItem}>
            Add item
          </Button>
          <Button loading={saving} onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
