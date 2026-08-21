"use client";

import { BarChart3, Package, ShoppingBag, Star, Users } from "lucide-react";
import { AvatarInitials } from "@/components/dashboard/ui/AvatarInitials";
import { DashCard, DashCardFooter, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { GaugeCard } from "@/components/dashboard/ui/Gauge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * UI/UX Design Phase - Phase 1's "contract" page (Part D item 9 of the
 * founder's mandate), same pattern as /design-system's marketing-site
 * contract page: every later phase's screens are checked against what's
 * shown here. Lives at a real storeId route so the real Sidebar (with its
 * real store/plan data) renders around it exactly as it will everywhere
 * else - no separate mock sidebar needed on the page itself.
 */
export default function DashboardDesignSystemPage() {
  return (
    <div className="space-y-16 pb-16">
      <PageHeader
        title="Dashboard design system"
        description="Tokens: white canvas, #fafafa tonal cards, no borders, indigo accent - scoped to .app-shell-surface only. Every later phase is checked against this page."
      />

      <section>
        <h2 className="mb-4 font-display text-h3 text-ink">Gauge - every fill state</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GaugeCard icon={ShoppingBag} label="Sales (30d)" value="0 orders" percent={0} hint="0% vs prior 30d" />
          <GaugeCard icon={BarChart3} label="Revenue (30d)" value="Rs 84,200" percent={46} hint="+12% vs prior 30d" />
          <GaugeCard icon={Users} label="Repeat customers" value="100%" percent={100} hint="Every buyer has ordered twice" />
          <GaugeCard
            icon={Star}
            label="Verification rate"
            value=""
            percent={0}
            isEmpty
            emptyMessage="No data yet"
            emptyAction={
              <Button size="sm" variant="secondary">
                Add your first product
              </Button>
            }
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-h3 text-ink">Card</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <DashCard>
            <DashCardHeader title="Store health" description="Recomputed nightly" />
            <div className="flex items-center gap-3">
              <AvatarInitials name="Sara Khan" email="sara.khan@example.com" />
              <div>
                <p className="text-sm font-medium text-ink">Sara Khan</p>
                <p className="text-xs text-ink-muted">sara.khan@example.com</p>
              </div>
            </div>
            <DashCardFooter>
              <Button size="sm" variant="ghost">
                View details
              </Button>
            </DashCardFooter>
          </DashCard>
          <DashCard>
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No products yet"
              description="Add your first product to see it here, and to start showing up in Sales and Top Products."
              action={
                <Button size="sm" variant="secondary">
                  Add a product
                </Button>
              }
            />
          </DashCard>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-h3 text-ink">Status pills (Badge, unchanged - already colored-bg + dark-tone text)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Draft</Badge>
          <Badge tone="success" dot>
            Confirmed
          </Badge>
          <Badge tone="warning" dot>
            Pending
          </Badge>
          <Badge tone="danger" dot>
            Cancelled
          </Badge>
          <Badge tone="info">Shipped</Badge>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-h3 text-ink">Avatar initials (real name, falls back to email)</h2>
        <div className="flex items-center gap-4">
          <AvatarInitials name="Bilal Ahmed" email="bilal.a@example.com" />
          <AvatarInitials name={null} email="fatima.n@example.com" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-h3 text-ink">Navigation</h2>
        <p className="max-w-2xl text-sm text-ink-muted">
          The real sidebar renders around this page - resize below 768px to see the mobile drawer (hamburger top bar
          replaces the static sidebar). Visit any of the four groups (Main menu / Growth / Operations / Admin) to see
          their active state; Admin is set off by a hairline divider, the one deliberate exception to the no-border
          rule (Shopify-style section break, not a card border).
        </p>
      </section>
    </div>
  );
}
