"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ChevronDown,
  Inbox,
  MoreHorizontal,
  Package,
  Settings,
  ShoppingBag,
  Trash2,
  User,
} from "lucide-react";
import { useState } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { Magnetic } from "@/components/motion/Magnetic";
import { Alert } from "@/components/ui/Alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Disclosure } from "@/components/ui/Disclosure";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Label } from "@/components/ui/Label";
import { PageHeader } from "@/components/ui/PageHeader";
import { Progress } from "@/components/ui/Progress";
import { Separator } from "@/components/ui/Separator";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageSpinner, Spinner } from "@/components/ui/Spinner";
import { Switch } from "@/components/ui/Switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { toast } from "@/lib/use-toast";

const NAV_SECTIONS = [
  ["identity", "Identity"],
  ["color", "Color"],
  ["type", "Typography"],
  ["spacing", "Spacing & radii"],
  ["shadows", "Depth"],
  ["motion", "Motion"],
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["feedback", "Feedback"],
  ["overlays", "Overlays"],
  ["nav", "Navigation"],
  ["data", "Data"],
  ["layout", "Layout"],
] as const;

function SectionLabel({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="text-eyebrow uppercase text-accent">{eyebrow}</p>
      <h2 className="mt-2 font-display text-h1 text-ink">{title}</h2>
      {description && <p className="mt-3 text-body text-ink-muted">{description}</p>}
    </div>
  );
}

function Swatch({ name, cssVar, hex, on }: { name: string; cssVar: string; hex: string; on?: "light" | "dark" }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      <div
        className="h-16 w-full"
        style={{ backgroundColor: hex, borderBottom: "1px solid var(--color-border)" }}
      />
      <div className="p-3">
        <p className={`text-sm font-medium ${on === "dark" ? "text-ink" : "text-ink"}`}>{name}</p>
        <p className="font-mono text-xs text-ink-faint">{cssVar}</p>
        <p className="font-mono text-xs text-ink-faint">{hex}</p>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  const [switchOn, setSwitchOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [progress] = useState(62);

  return (
    <div className="min-h-screen bg-canvas">
      {/* In-page contract nav */}
      <div className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-6 py-3">
          <span className="mr-3 shrink-0 font-display text-sm font-bold tracking-tight text-ink">eyosto / design system</span>
          {NAV_SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-muted transition-smooth-fast hover:bg-canvas hover:text-ink"
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-16">
        {/* ============ IDENTITY / HERO ============ */}
        <section id="identity" className="scroll-mt-20 pb-24">
          <Reveal>
            <p className="text-eyebrow uppercase text-accent">Phase 1 · Module 19</p>
            <h1 className="mt-3 font-display text-display text-ink">
              The eyosto
              <br />
              design system.
            </h1>
            <p className="mt-6 max-w-xl text-body-lg text-ink-muted">
              One token file, one component kit, one contract. Every screen across the marketing
              site, dashboard, storefronts, and admin terminal is built from what&apos;s on this
              page — nothing here is a one-off.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Magnetic>
                <Button size="lg">
                  Explore the kit <ArrowRight className="h-4 w-4" />
                </Button>
              </Magnetic>
              <Button size="lg" variant="secondary">
                View on GitHub
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardBody>
                <p className="font-display text-h2 text-ink">2</p>
                <p className="mt-1 text-sm text-ink-muted">Type families</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="font-display text-h2 text-ink">1</p>
                <p className="mt-1 text-sm text-ink-muted">Restrained accent</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="font-display text-h2 text-ink">24+</p>
                <p className="mt-1 text-sm text-ink-muted">Components, all 8 states</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="font-display text-h2 text-ink">AA</p>
                <p className="mt-1 text-sm text-ink-muted">Contrast, everywhere</p>
              </CardBody>
            </Card>
          </Reveal>
        </section>

        {/* ============ COLOR ============ */}
        <section id="color" className="scroll-mt-20 border-t border-border pb-24 pt-16">
          <Reveal>
            <SectionLabel
              eyebrow="Foundation"
              title="Color"
              description="Monochrome premium: a true grayscale from canvas to ink, and exactly one restrained accent - used only for links, the primary CTA, and active/selected state. Every status color is muted, never neon."
            />
          </Reveal>
          <Reveal stagger={0.04} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Swatch name="Canvas" cssVar="--color-canvas" hex="#f5f5f7" />
            <Swatch name="Surface" cssVar="--color-surface" hex="#ffffff" />
            <Swatch name="Border" cssVar="--color-border" hex="#e5e5ea" />
            <Swatch name="Border strong" cssVar="--color-border-strong" hex="#d2d2d7" />
            <Swatch name="Ink" cssVar="--color-ink" hex="#1d1d1f" />
            <Swatch name="Ink muted" cssVar="--color-ink-muted" hex="#6e6e73" />
            <Swatch name="Ink faint" cssVar="--color-ink-faint" hex="#8e8e93" />
            <Swatch name="Accent" cssVar="--color-accent" hex="#0071e3" />
            <Swatch name="Accent hover" cssVar="--color-accent-hover" hex="#0058b0" />
            <Swatch name="Accent subtle" cssVar="--color-accent-subtle" hex="#e8f2fd" />
          </Reveal>
          <p className="mb-3 mt-10 text-sm font-medium text-ink">Semantic status (never the accent)</p>
          <Reveal stagger={0.04} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Swatch name="Success" cssVar="--color-success" hex="#1f9254" />
            <Swatch name="Warning" cssVar="--color-warning" hex="#b5750a" />
            <Swatch name="Danger" cssVar="--color-danger" hex="#d3382f" />
            <Swatch name="Info" cssVar="--color-info" hex="#2f6fed" />
          </Reveal>
        </section>

        {/* ============ TYPE ============ */}
        <section id="type" className="scroll-mt-20 border-t border-border pb-24 pt-16">
          <Reveal>
            <SectionLabel
              eyebrow="Foundation"
              title="Typography"
              description="Plus Jakarta Sans carries display voice - headlines, hero copy, the wordmark. Inter stays the body/UI face, proven legible at 13-14px across every dense dashboard table this product ships. Two families, one job each."
            />
          </Reveal>
          <Reveal stagger={0.05} className="space-y-6">
            <div className="flex flex-col gap-1 border-b border-border pb-6">
              <p className="font-display text-display text-ink">Sell more, worry less.</p>
              <p className="font-mono text-xs text-ink-faint">text-display · Plus Jakarta Sans 700 · -0.035em</p>
            </div>
            <div className="flex flex-col gap-1 border-b border-border pb-6">
              <p className="font-display text-h1 text-ink">Everything your store needs.</p>
              <p className="font-mono text-xs text-ink-faint">text-h1 · 700 · -0.025em</p>
            </div>
            <div className="flex flex-col gap-1 border-b border-border pb-6">
              <p className="font-display text-h2 text-ink">Built for the way you sell.</p>
              <p className="font-mono text-xs text-ink-faint">text-h2 · 600 · -0.015em</p>
            </div>
            <div className="flex flex-col gap-1 border-b border-border pb-6">
              <p className="font-display text-h3 text-ink">Orders, inventory, and payouts.</p>
              <p className="font-mono text-xs text-ink-faint">text-h3 · 600</p>
            </div>
            <div className="flex flex-col gap-1 border-b border-border pb-6">
              <p className="font-display text-h4 text-ink">Section heading</p>
              <p className="font-mono text-xs text-ink-faint">text-h4 · 600</p>
            </div>
            <div className="flex flex-col gap-1 border-b border-border pb-6">
              <p className="text-body-lg text-ink">
                A confident body size for pricing copy and feature descriptions - roomy line-height for easy scanning.
              </p>
              <p className="font-mono text-xs text-ink-faint">text-body-lg · Inter 400 · 1.6</p>
            </div>
            <div className="flex flex-col gap-1 border-b border-border pb-6">
              <p className="text-body text-ink">The default paragraph size for dashboard copy, form helper text, and everyday reading.</p>
              <p className="font-mono text-xs text-ink-faint">text-body · Inter 400 · 1.6</p>
            </div>
            <div className="flex flex-col gap-1 border-b border-border pb-6">
              <p className="text-sm text-ink-muted">Dense table cells, secondary labels, and metadata use this size.</p>
              <p className="font-mono text-xs text-ink-faint">text-sm · Inter 400</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-eyebrow uppercase text-ink-faint">Eyebrow label</p>
              <p className="font-mono text-xs text-ink-faint">text-eyebrow · Inter 600 · 0.08em tracking</p>
            </div>
          </Reveal>
        </section>

        {/* ============ SPACING & RADII ============ */}
        <section id="spacing" className="scroll-mt-20 border-t border-border pb-24 pt-16">
          <Reveal>
            <SectionLabel
              eyebrow="Foundation"
              title="Spacing & radii"
              description="Tailwind's default 4px-based scale already is the systematic ramp this system needs - no reinvention. Two semantic tokens add marketing-page section rhythm. Radii step from a tight 8px control up to a generous 28px hero card."
            />
          </Reveal>
          <Reveal stagger={0.03} className="mb-10 space-y-2">
            {[1, 2, 3, 4, 6, 8, 12, 16, 24, 32].map((step) => (
              <div key={step} className="flex items-center gap-4">
                <span className="w-16 shrink-0 font-mono text-xs text-ink-faint">{step * 4}px</span>
                <div className="h-3 rounded-sm bg-accent" style={{ width: `${step * 4}px` }} />
              </div>
            ))}
          </Reveal>
          <Reveal stagger={0.05} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["sm", "0.5rem"],
              ["md", "0.75rem"],
              ["lg", "1.25rem"],
              ["xl", "1.75rem"],
            ].map(([name, val]) => (
              <div key={name} className="text-center">
                <div className={`mx-auto mb-2 h-16 w-16 rounded-${name} border border-border-strong bg-surface`} />
                <p className="text-sm font-medium text-ink">radius-{name}</p>
                <p className="font-mono text-xs text-ink-faint">{val}</p>
              </div>
            ))}
          </Reveal>
        </section>

        {/* ============ SHADOWS ============ */}
        <section id="shadows" className="scroll-mt-20 border-t border-border pb-24 pt-16">
          <Reveal>
            <SectionLabel
              eyebrow="Foundation"
              title="Depth"
              description="Soft, low-opacity, large-blur shadows - depth without a hard edge. xs/sm sit on resting cards; md/lg lift hover states and popovers; xl is reserved for the highest layer (dialogs floating above a scrim)."
            />
          </Reveal>
          <Reveal stagger={0.05} className="grid grid-cols-2 gap-8 sm:grid-cols-5">
            {["xs", "sm", "md", "lg", "xl"].map((s) => (
              <div key={s} className="text-center">
                <div className={`mx-auto mb-3 h-20 w-20 rounded-lg bg-surface shadow-${s}`} />
                <p className="text-sm font-medium text-ink">shadow-{s}</p>
              </div>
            ))}
          </Reveal>
        </section>

        {/* ============ MOTION ============ */}
        <section id="motion" className="scroll-mt-20 border-t border-border pb-24 pt-16">
          <Reveal>
            <SectionLabel
              eyebrow="Foundation"
              title="Motion"
              description="Confident, physics-leaning easing - never linear. Exits run faster than entrances. Every reveal on this page (and every hero this system builds) uses these exact curves, mirrored in lib/motion.ts so GSAP and CSS never drift apart. Scroll back up: the hero and stat cards, the color/type/spacing grids above all used the same Reveal component."
            />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardBody>
                <p className="text-sm font-semibold text-ink">ease-standard</p>
                <p className="mt-1 text-xs text-ink-muted">Confident decelerate. Default for entrances, hovers, opens.</p>
                <p className="mt-3 font-mono text-xs text-ink-faint">cubic-bezier(.16,1,.3,1)</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm font-semibold text-ink">ease-in</p>
                <p className="mt-1 text-xs text-ink-muted">Fast accelerate. Exits only - leaving reads quicker than arriving.</p>
                <p className="mt-3 font-mono text-xs text-ink-faint">cubic-bezier(.7,0,.84,0)</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm font-semibold text-ink">ease-emphasized</p>
                <p className="mt-1 text-xs text-ink-muted">A touch of overshoot. Rare, deliberate delight moments only.</p>
                <p className="mt-3 font-mono text-xs text-ink-faint">cubic-bezier(.34,1.56,.64,1)</p>
              </CardBody>
            </Card>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4">
            <span className="text-sm text-ink-muted">Magnetic CTA (hover it):</span>
            <Magnetic>
              <Button>Hover me</Button>
            </Magnetic>
          </div>
        </section>

        {/* ============ BUTTONS ============ */}
        <section id="buttons" className="scroll-mt-20 border-t border-border pb-24 pt-16">
          <Reveal>
            <SectionLabel eyebrow="Components" title="Buttons" description="The one button component every screen uses. Five variants, four sizes, and full default/hover/focus/active/disabled/loading coverage." />
          </Reveal>
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled>Disabled</Button>
              <Button loading>Loading</Button>
              <Button variant="secondary" disabled>
                Disabled secondary
              </Button>
              <span className="text-sm text-ink-faint">↑ default / disabled / loading. Focus a button with Tab to see the ring; hover any for the state change.</span>
            </div>
          </div>
        </section>

        {/* ============ FORMS ============ */}
        <section id="forms" className="scroll-mt-20 border-t border-border pb-24 pt-16">
          <Reveal>
            <SectionLabel eyebrow="Components" title="Forms" description="Every control shares one focus/hover/disabled/error treatment, so a form never looks assembled from different systems." />
          </Reveal>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              <Field label="Store name" hint="This appears on your storefront and invoices.">
                <Input placeholder="Acme Goods" />
              </Field>
              <Field label="Support email" required error="Enter a valid email address.">
                <Input defaultValue="not-an-email" aria-invalid />
              </Field>
              <Field label="Store description">
                <Textarea rows={3} placeholder="Tell buyers what makes your store worth a repeat visit." />
              </Field>
              <Field label="Default currency">
                <Select defaultValue="pkr">
                  <option value="pkr">PKR — Pakistani Rupee</option>
                  <option value="usd">USD — US Dollar</option>
                </Select>
              </Field>
              <Field label="Disabled field" hint="Locked while a sync is in progress.">
                <Input disabled placeholder="Can't edit right now" />
              </Field>
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Checkbox id="cb1" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
                <Label htmlFor="cb1">Email me when an order ships</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="cb2" disabled />
                <Label htmlFor="cb2" className="opacity-50">
                  Disabled option
                </Label>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sw1">Maintenance mode</Label>
                  <p className="text-xs text-ink-muted">Buyers see a holding page while this is on.</p>
                </div>
                <Switch id="sw1" checked={switchOn} onCheckedChange={setSwitchOn} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="sw2" className="opacity-50">
                  Disabled toggle
                </Label>
                <Switch id="sw2" disabled />
              </div>
              <Separator />
              <Disclosure label="Advanced options">
                <Field label="Webhook URL" hint="Optional - we'll POST order events here.">
                  <Input placeholder="https://" />
                </Field>
              </Disclosure>
            </div>
          </div>
        </section>

        {/* ============ FEEDBACK ============ */}
        <section id="feedback" className="scroll-mt-20 border-t border-border pb-24 pt-16">
          <Reveal>
            <SectionLabel eyebrow="Components" title="Feedback" description="Status is always encoded in form as well as color - a dot, an icon, a shape - never color alone." />
          </Reveal>
          <div className="space-y-8">
            <div className="space-y-3">
              <Alert tone="success">Your changes were saved.</Alert>
              <Alert tone="warning">Your wallet balance is low - new orders may pause soon.</Alert>
              <Alert tone="danger">That store slug is already taken.</Alert>
              <Alert tone="info">Verified Store review can take up to 48 hours.</Alert>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Draft</Badge>
              <Badge tone="success" dot>
                Active
              </Badge>
              <Badge tone="warning" dot>
                Pending
              </Badge>
              <Badge tone="danger" dot>
                Suspended
              </Badge>
              <Badge tone="info">New</Badge>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Progress</p>
                <Progress value={progress} />
                <p className="mt-1.5 text-xs text-ink-muted">{progress}% of monthly export quota used</p>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Spinner</p>
                <Spinner />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Skeleton</p>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => toast({ title: "Product published", description: "Your listing is now live on the storefront.", tone: "success" })}
              >
                Trigger success toast
              </Button>
              <Button
                variant="secondary"
                onClick={() => toast({ title: "Couldn't save changes", description: "Check your connection and try again.", tone: "danger" })}
              >
                Trigger error toast
              </Button>
            </div>
          </div>
        </section>

        {/* ============ OVERLAYS ============ */}
        <section id="overlays" className="scroll-mt-20 border-t border-border pb-24 pt-16">
          <Reveal>
            <SectionLabel eyebrow="Components" title="Overlays" description="Dialog, dropdown menu, and tooltip - each animates in with ease-standard, out with ease-in." />
          </Reveal>
          <div className="flex flex-wrap items-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button>Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Suspend this store?</DialogTitle>
                  <DialogDescription>Buyers won&apos;t be able to check out until you reactivate it. This won&apos;t affect past orders.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="secondary">Cancel</Button>
                  <Button variant="danger">Suspend store</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  Actions <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Product</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Package className="h-4 w-4" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <User className="h-4 w-4" /> Assign to team
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive>
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="More options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>More options</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </section>

        {/* ============ NAVIGATION ============ */}
        <section id="nav" className="scroll-mt-20 border-t border-border pb-24 pt-16">
          <Reveal>
            <SectionLabel eyebrow="Components" title="Navigation" description="Tabs - the active tab lifts on a surface with a soft shadow, never just an underline." />
          </Reveal>
          <Tabs defaultValue="overview" className="max-w-md">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p className="text-sm text-ink-muted">Today&apos;s signups, orders, and GMV at a glance.</p>
            </TabsContent>
            <TabsContent value="orders">
              <p className="text-sm text-ink-muted">Every order across your stores, newest first.</p>
            </TabsContent>
            <TabsContent value="settings">
              <p className="text-sm text-ink-muted">Store name, currency, and checkout preferences.</p>
            </TabsContent>
          </Tabs>
        </section>

        {/* ============ DATA ============ */}
        <section id="data" className="scroll-mt-20 border-t border-border pb-24 pt-16">
          <Reveal>
            <SectionLabel eyebrow="Components" title="Data" description="Dense, legible tables - Linear/Notion-grade, not a bare HTML table." />
          </Reveal>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">#10482</TableCell>
                <TableCell>sara.khan@example.com</TableCell>
                <TableCell>
                  <Badge tone="success" dot>
                    Paid
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">Rs 4,250</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">#10481</TableCell>
                <TableCell>bilal.a@example.com</TableCell>
                <TableCell>
                  <Badge tone="warning" dot>
                    Pending
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">Rs 1,800</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">#10480</TableCell>
                <TableCell>fatima.n@example.com</TableCell>
                <TableCell>
                  <Badge tone="danger" dot>
                    Cancelled
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">Rs 950</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        {/* ============ LAYOUT ============ */}
        <section id="layout" className="scroll-mt-20 border-t border-border pt-16">
          <Reveal>
            <SectionLabel eyebrow="Components" title="Layout" description="Cards, page headers, avatars, and empty states that teach rather than a blank list." />
          </Reveal>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <PageHeader title="Products" description="12 active, 3 drafts" action={<Button size="sm">Add product</Button>} />
              <Card>
                <CardHeader title="Store health" description="Recomputed nightly" />
                <CardBody className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src="" alt="" />
                      <AvatarFallback>AC</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-ink">Acme Goods</p>
                      <p className="text-xs text-ink-muted">acme-goods.eyosto.com</p>
                    </div>
                  </div>
                </CardBody>
                <CardFooter>
                  <Button size="sm" variant="ghost">
                    View details
                  </Button>
                </CardFooter>
              </Card>
            </div>
            <Card>
              <EmptyState
                icon={<Inbox className="h-6 w-6" />}
                title="No orders yet"
                description="Once a buyer checks out, their order will show up here with everything you need to fulfill it."
                action={
                  <Button size="sm" variant="secondary">
                    <ShoppingBag className="h-4 w-4" /> Share your storefront
                  </Button>
                }
              />
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10 text-center text-sm text-ink-faint">
        <p className="flex items-center justify-center gap-2">
          <Bell className="h-3.5 w-3.5" /> This page is the contract - every later phase is checked against it.
        </p>
      </footer>
    </div>
  );
}
