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
import { RuleFormDialog } from "@/components/detection-rules/rule-form-dialog";
import type { RuleListItem } from "@/types/rules";

/**
 * Securis - Detection rule row actions
 *
 * Enable/disable, edit and delete a rule. Editing fetches the rule's condition
 * first (the list projection omits it), then opens the form dialog in
 * controlled mode.
 *
 * Connection: PATCH/DELETE /api/detection-rules/[id].
 */
export function RuleRowActions({
  rule,
  canWrite,
}: {
  rule: RuleListItem;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "toggle" | "delete">(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editCondition, setEditCondition] = useState<Record<string, unknown> | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  if (!canWrite) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  async function openEdit() {
    setLoadingEdit(true);
    try {
      const response = await fetch(`/api/detection-rules/${rule.id}`);
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { condition?: unknown } }
        | null;
      if (!response.ok || !data?.ok) {
        toast.error("Could not load the rule.");
        return;
      }
      setEditCondition((data.data?.condition as Record<string, unknown>) ?? {});
      setEditOpen(true);
    } catch {
      toast.error("Network error.");
    } finally {
      setLoadingEdit(false);
    }
  }

  async function toggleEnabled() {
    setBusy("toggle");
    try {
      const response = await fetch(`/api/detection-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        toast.error(data?.error ?? "Update failed.");
        return;
      }
      toast.success(rule.enabled ? "Rule disabled." : "Rule enabled.");
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
      const response = await fetch(`/api/detection-rules/${rule.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        toast.error(data?.error ?? "Delete failed.");
        return;
      }
      toast.success("Rule deleted.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Edit rule"
        disabled={loadingEdit || busy !== null}
        onClick={() => void openEdit()}
      >
        {loadingEdit ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Pencil className="size-3.5" aria-hidden="true" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
        disabled={busy !== null}
        onClick={() => void toggleEnabled()}
      >
        {busy === "toggle" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Power className="size-3.5" aria-hidden="true" />
        )}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Delete rule" disabled={busy !== null}>
            <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule {rule.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              The rule will stop being evaluated. Alerts it already produced are kept
              (their rule reference is cleared). To pause it instead, disable it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Controlled edit dialog, opened after the condition is fetched. */}
      {editCondition ? (
        <RuleFormDialog
          canWrite={canWrite}
          rule={rule}
          condition={editCondition}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </div>
  );
}
