"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCheck, Loader2, MessageSquarePlus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ALERT_STATUSES, type AlertStatus } from "@/types/security";
import { cn } from "@/lib/utils";

/**
 * Securis - Alert actions
 *
 * Client component implementing the analyst workflow: change status, assign an
 * analyst, mark false positive / resolved, and add notes. All mutations go
 * through the alert API, which enforces `alerts:write` server-side - the
 * `canWrite` prop only controls whether the controls are rendered.
 *
 * Connection: app/api/alerts/[id] (PATCH) and app/api/alerts/[id]/notes (POST).
 */

export interface AssignableUser {
  id: string;
  name: string;
  email: string;
}

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function AlertActions({
  alertId,
  status,
  assignedToId,
  users,
  canWrite,
}: {
  alertId: string;
  status: AlertStatus;
  assignedToId: string | null;
  users: AssignableUser[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (!canWrite) {
    return (
      <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        Your role has read-only access to alerts.
      </p>
    );
  }

  /** Send a PATCH and refresh the server components on success. */
  async function patch(payload: Record<string, unknown>, label: string) {
    setBusy(label);
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        toast.error(data?.error ?? "Update failed.");
        return;
      }
      toast.success("Alert updated.");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function submitNote() {
    const body = note.trim();
    if (!body) {
      toast.error("Note cannot be empty.");
      return;
    }
    setBusy("note");
    try {
      const response = await fetch(`/api/alerts/${alertId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        toast.error(data?.error ?? "Could not add the note.");
        return;
      }
      setNote("");
      toast.success("Note added.");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null || pending;

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-4">
      <h2 className="text-sm font-medium text-foreground">Analyst actions</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
            Status
          </span>
          <select
            className={selectClass}
            defaultValue={status}
            disabled={disabled}
            onChange={(event) =>
              void patch({ status: event.target.value as AlertStatus }, "status")
            }
            aria-label="Change status"
          >
            {ALERT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
            Assigned analyst
          </span>
          <select
            className={selectClass}
            defaultValue={assignedToId ?? ""}
            disabled={disabled}
            onChange={(event) =>
              void patch({ assignedToId: event.target.value || null }, "assign")
            }
            aria-label="Assign analyst"
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => void patch({ status: "FALSE_POSITIVE" }, "fp")}
        >
          <Ban className="size-3.5" aria-hidden="true" />
          Mark false positive
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => void patch({ status: "RESOLVED" }, "resolve")}
        >
          <CheckCheck className="size-3.5" aria-hidden="true" />
          Resolve
        </Button>
        {busy ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Saving…
          </span>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-border/50 pt-3">
        <span className="flex items-center gap-1 text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
          <MessageSquarePlus className="size-3" aria-hidden="true" />
          Add note
        </span>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Document your investigation…"
          rows={3}
          maxLength={4000}
          disabled={disabled}
          className={cn("resize-y")}
        />
        <div className="flex items-center justify-between">
          <span className="text-[0.68rem] text-muted-foreground">
            {note.length}/4000
          </span>
          <Button size="sm" disabled={disabled || note.trim().length === 0} onClick={() => void submitNote()}>
            {busy === "note" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <UserRound className="size-3.5" aria-hidden="true" />
            )}
            Add note
          </Button>
        </div>
      </div>
    </div>
  );
}
