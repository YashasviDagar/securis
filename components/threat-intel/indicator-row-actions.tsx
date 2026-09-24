"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { IndicatorFormDialog } from "@/components/threat-intel/indicator-form-dialog";
import type { IndicatorListItem } from "@/types/threat-intel";

/**
 * Securis - Indicator row actions
 *
 * Client component providing edit, retire/reactivate and delete for a single
 * indicator. Deletion is confirmed with an alert dialog because it removes the
 * indicator from history (retiring keeps it).
 *
 * Connection: PATCH/DELETE /api/threat-intelligence/[id].
 */
export function IndicatorRowActions({
  indicator,
  canWrite,
}: {
  indicator: IndicatorListItem;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "toggle" | "delete">(null);

  if (!canWrite) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  async function toggleActive() {
    setBusy("toggle");
    try {
      const response = await fetch(`/api/threat-intelligence/${indicator.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !indicator.active }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        toast.error(data?.error ?? "Update failed.");
        return;
      }
      toast.success(indicator.active ? "Indicator retired." : "Indicator activated.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      const response = await fetch(`/api/threat-intelligence/${indicator.id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        toast.error(data?.error ?? "Delete failed.");
        return;
      }
      toast.success("Indicator deleted.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <IndicatorFormDialog
        canWrite={canWrite}
        indicator={indicator}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Edit indicator">
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
        }
      />

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={indicator.active ? "Retire indicator" : "Activate indicator"}
        disabled={busy !== null}
        onClick={() => void toggleActive()}
      >
        {busy === "toggle" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Power className="size-3.5" aria-hidden="true" />
        )}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete indicator"
            disabled={busy !== null}
          >
            <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this indicator?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{indicator.value}</span> will be permanently
              removed. To keep it for history but stop it affecting risk scores,
              retire it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
