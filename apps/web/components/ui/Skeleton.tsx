import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Loading placeholder - a soft pulse, never a spinner, for content that has a known shape (a table row, a card) while its data streams in. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-border", className)} aria-hidden {...props} />;
}
