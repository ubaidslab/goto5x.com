import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

/**
 * Derives display initials from a real customer name when one exists
 * (Order.customer.name, Module 15 CRM), falling back to the buyer's email
 * only when no linked Customer record exists (per the founder's Phase 1
 * decision) - never a placeholder/generic icon. Reuses the existing
 * Radix-based Avatar/AvatarFallback primitives rather than a new
 * component; this file only adds the initials-from-real-data logic.
 */
export function initialsFor(name: string | null | undefined, email: string): string {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? "";
  return (local.slice(0, 2) || "?").toUpperCase();
}

export function AvatarInitials({
  name,
  email,
  className,
}: {
  name?: string | null;
  email: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("h-9 w-9", className)}>
      <AvatarFallback>{initialsFor(name, email)}</AvatarFallback>
    </Avatar>
  );
}
