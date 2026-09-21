import { ModuleScaffold } from "@/components/shared/module-scaffold";
import { requireNavItem } from "@/lib/navigation";

/**
 * Securis - NavModulePage
 *
 * Convenience wrapper that renders the placeholder scaffold for a module using
 * the metadata already declared in the navigation model. This keeps page files
 * free of duplicated titles/descriptions and guarantees the sidebar, header and
 * page always agree.
 *
 * Pages replace this wrapper with real functionality as each build phase is
 * completed.
 *
 * Connection: lib/navigation.ts -> components/shared/module-scaffold.tsx.
 */
export function NavModulePage({ href }: { href: string }) {
  const item = requireNavItem(href);

  return (
    <ModuleScaffold
      title={item.title}
      description={item.description}
      phase={item.phase}
      icon={item.icon}
    />
  );
}
