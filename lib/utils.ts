/**
 * Securis - shadcn/ui utility barrel
 *
 * shadcn/ui generates components that import `cn` from "@/lib/utils". Rather
 * than maintaining two implementations, this file re-exports the canonical
 * helper from the `utils/` layer.
 *
 * Connection: components/ui/*.tsx -> @/lib/utils -> @/utils/cn
 */
export { cn } from "@/utils/cn";
