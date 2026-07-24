"use client";

/** Minimal toast queue store (shadcn's classic pattern) - a single module-level list plus a subscriber set, so any component can call toast() without a context provider wrapping it. */
import { useEffect, useState } from "react";

type ToastTone = "default" | "success" | "danger";

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  tone?: ToastTone;
  action?: React.ReactNode;
}

let toasts: ToastItem[] = [];
const listeners = new Set<(toasts: ToastItem[]) => void>();

function emit() {
  listeners.forEach((listener) => listener(toasts));
}

export function toast(item: Omit<ToastItem, "id">) {
  const id = crypto.randomUUID();
  toasts = [...toasts, { id, ...item }];
  emit();
  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>(toasts);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  return { toasts: items, toast, dismiss: dismissToast };
}
