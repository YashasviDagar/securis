"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { SEVERITIES, type Severity } from "@/types/security";
import type { AssignableUser } from "@/components/alerts/alert-actions";

/**
 * Securis - Create incident dialog
 *
 * Client component that bundles one or more alerts into a new incident. Used
 * both from the incident board (pick from recent alerts) and from the alert
 * detail page (the alert is preselected).
 *
 * The API enforces `incidents:write`; `canWrite` only controls rendering.
 *
 * Connection: POST /api/incidents -> server/services/incident-service.ts.
 */

export interface CandidateAlert {
  id: string;
  title: string;
  severity: Severity;
}

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function CreateIncidentDialog({
  candidateAlerts,
  presetAlertIds = [],
  users,
  canWrite,
  triggerLabel = "New incident",
}: {
  candidateAlerts: CandidateAlert[];
  presetAlertIds?: string[];
  users: AssignableUser[];
  canWrite: boolean;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"" | Severity>("");
  const [assignedToId, setAssignedToId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(presetAlertIds));

  // Highest severity among the currently selected alerts (shown as a hint).
  const suggestedSeverity = useMemo<Severity | null>(() => {
    const rank: Record<Severity, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    const chosen = candidateAlerts.filter((alert) => selected.has(alert.id));
    if (chosen.length === 0) return null;
    return chosen.reduce<Severity>(
      (highest, alert) => (rank[alert.severity] > rank[highest] ? alert.severity : highest),
      "INFO",
    );
  }, [candidateAlerts, selected]);

  if (!canWrite) return null;

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (title.trim().length < 3) {
      toast.error("Give the incident a title (at least 3 characters).");
      return;
    }
    if (description.trim().length === 0) {
      toast.error("Add a description.");
      return;
    }
    if (selected.size === 0) {
      toast.error("Select at least one alert.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          severity: severity || undefined,
          assignedToId: assignedToId || null,
          alertIds: [...selected],
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; data?: { id: string; reference: string } }
        | null;

      if (!response.ok || !data?.ok || !data.data) {
        toast.error(data?.error ?? "Could not create the incident.");
        return;
      }

      toast.success(`Incident ${data.data.reference} created.`);
      setOpen(false);
      router.push(`/incidents/${data.data.id}`);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-3.5" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create incident</DialogTitle>
          <DialogDescription>
            Bundle related alerts into a single investigation. The incident
            inherits the highest severity of the selected alerts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
              Title
            </span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Coordinated credential attack"
              maxLength={200}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1">
            <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
              Description
            </span>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What happened and what is the working theory?"
              rows={3}
              maxLength={4000}
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
                Severity
              </span>
              <select
                className={selectClass}
                value={severity}
                onChange={(event) => setSeverity(event.target.value as "" | Severity)}
                disabled={submitting}
              >
                <option value="">
                  Auto{suggestedSeverity ? ` (${suggestedSeverity})` : ""}
                </option>
                {SEVERITIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
                Assign to
              </span>
              <select
                className={selectClass}
                value={assignedToId}
                onChange={(event) => setAssignedToId(event.target.value)}
                disabled={submitting}
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

          <div className="space-y-1">
            <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
              Alerts ({selected.size} selected)
            </span>
            {candidateAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No alerts available.</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border/50 p-2">
                {candidateAlerts.map((alert) => (
                  <li key={alert.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={selected.has(alert.id)}
                        onChange={() => toggle(alert.id)}
                        disabled={submitting}
                        className="size-4 accent-[var(--primary)]"
                      />
                      <SeverityBadge severity={alert.severity} />
                      <span className="truncate text-sm text-foreground">{alert.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-3.5" aria-hidden="true" />
            )}
            Create incident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
