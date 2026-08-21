"use client";

import type { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { DashCard } from "./DashCard";

/**
 * The dashboard's headline-KPI semicircle gauge (Part A item 5 of the
 * founder's mandate) - built on recharts (the repo's one charting
 * library, already used by the Analytics page) rather than a hand-rolled
 * SVG arc, per the founder's explicit approval of "gauge via recharts
 * reuse" in the Phase 1 plan.
 *
 * `percent` is deliberately generic (0-100, clamped) - what it MEANS
 * varies by caller: a true rate (e.g. repeat-customer %) passes its real
 * percentage; an absolute metric (Sales/Revenue/AOV) passes a real
 * period-over-period comparison ratio computed from already-fetched data
 * (current window vs. the prior window of the same length) rather than an
 * invented "% of goal" - that comparison choice is made by whichever
 * screen wires real numbers in (Dashboard Home, Phase 2), not by this
 * component, which only ever renders what it's given.
 */
function clampPercent(percent: number): number {
  if (Number.isNaN(percent)) return 0;
  return Math.max(0, Math.min(100, percent));
}

export function Gauge({ percent, size = 140 }: { percent: number; size?: number }) {
  const value = clampPercent(percent);
  const data = [{ value, fill: "var(--color-accent)" }];
  return (
    <div style={{ width: "100%", height: size * 0.62 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="100%"
          innerRadius="150%"
          outerRadius="230%"
          barSize={12}
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: "var(--color-border)" }}
            dataKey="value"
            cornerRadius={6}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The "no data yet" gauge fill state (Part C item 5 - day-1 empty states): a
 *  dashed, muted outline instead of a misleading full/empty solid arc. */
function EmptyGauge({ size = 140 }: { size?: number }) {
  const height = size * 0.62;
  const cx = size / 2;
  const cy = height;
  const r = size * 0.42;
  const start = { x: cx - r, y: cy };
  const end = { x: cx + r, y: cy };
  return (
    <div style={{ width: "100%", height }} className="flex items-center justify-center">
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} aria-hidden>
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray="2 10"
        />
      </svg>
    </div>
  );
}

export interface GaugeCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  percent: number;
  hint?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;
}

/** A full headline-KPI tile: icon, label, gauge, big value, optional trend hint. */
export function GaugeCard({ icon: Icon, label, value, percent, hint, isEmpty, emptyMessage, emptyAction }: GaugeCardProps) {
  return (
    <DashCard>
      <div className="flex items-center gap-2 text-ink-muted">
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      {isEmpty ? (
        <>
          <EmptyGauge />
          <p className="text-center text-sm text-ink-muted">{emptyMessage ?? "No data yet"}</p>
          {emptyAction && <div className="mt-3 flex justify-center">{emptyAction}</div>}
        </>
      ) : (
        <>
          <Gauge percent={percent} />
          <p className="text-center font-display text-h3 text-ink">{value}</p>
          {hint && <p className="text-center text-xs text-ink-muted">{hint}</p>}
        </>
      )}
    </DashCard>
  );
}
