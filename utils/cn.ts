import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Securis - className utility
 *
 * `cn` merges conditional class names (via `clsx`) and resolves conflicting
 * Tailwind utilities so the last one wins (via `tailwind-merge`).
 *
 * Example:
 *   cn("p-2", isActive && "p-4") // -> "p-4" when isActive is true
 *
 * This is the single canonical implementation for the application. shadcn/ui
 * components import `cn` from "@/lib/utils", which simply re-exports this
 * function, so both import paths are safe to use.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
