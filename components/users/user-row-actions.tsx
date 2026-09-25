"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import type { UserListItem } from "@/types/users";

/**
 * Securis - User row actions
 *
 * Edit a user (dialog) and toggle their active state. Disabling an account also
 * revokes its sessions server-side.
 *
 * Connection: PATCH /api/users/[id].
 */
export function UserRowActions({
  user,
  canWrite,
}: {
  user: UserListItem;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!canWrite) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  async function toggleActive() {
    setBusy(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        toast.error(data?.error ?? "Update failed.");
        return;
      }
      toast.success(user.isActive ? "User disabled." : "User enabled.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <UserFormDialog
        canWrite={canWrite}
        user={user}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Edit user">
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={user.isActive ? "Disable user" : "Enable user"}
        disabled={busy}
        onClick={() => void toggleActive()}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Power className="size-3.5" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
