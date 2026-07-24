"use client";

import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const controlClass = cn(
  "w-full rounded-md border border-border bg-surface px-3 text-sm text-ink",
  "placeholder:text-ink-faint",
  "transition-smooth-fast",
  "hover:border-border-strong",
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15",
);

interface FieldWrapperProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}

/** Label + control + hint/error, in the one arrangement every form field in this product uses. */
export function Field({ label, hint, error, required, children, htmlFor }: FieldWrapperProps) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span>}
      {error && (
        <span className="mt-1.5 flex items-center gap-1 text-xs text-danger" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(controlClass, "h-10", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(controlClass, "py-2", className)} {...props} />,
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(controlClass, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";
