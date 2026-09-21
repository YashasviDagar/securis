"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Brand } from "@/components/layout/sidebar";
import { SidebarNav } from "@/components/layout/nav-list";
import type { Role } from "@/types/security";

/**
 * Securis - MobileNav
 *
 * Off-canvas navigation for small viewports. It renders the same `SidebarNav`
 * model as the desktop sidebar inside a shadcn/ui Sheet, and closes itself when
 * a link is clicked.
 *
 * Connection: rendered by components/layout/header.tsx.
 */
export function MobileNav({ role }: { role?: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar p-0">
        <SheetHeader className="border-b border-sidebar-border px-3 py-3">
          <SheetTitle className="sr-only">Securis navigation</SheetTitle>
          <Brand onNavigate={() => setOpen(false)} />
        </SheetHeader>
        <div className="overflow-y-auto px-2 py-4">
          <SidebarNav role={role} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
