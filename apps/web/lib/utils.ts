import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui's standard class-merging helper - every restyled component in components/ui/ uses this for its className prop. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
