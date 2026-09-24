"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save } from "lucide-react";
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
import { validateIndicatorValue } from "@/lib/validation/threat-intel";
import { INDICATOR_TYPES, type IndicatorType } from "@/types/security";
import type { IndicatorListItem } from "@/types/threat-intel";

/**
 * Securis - Indicator create/edit dialog
 *
 * Client component. The same form is used to add a new indicator and to edit an
 * existing one; the caller supplies the trigger element. Value format is
 * validated in the browser for fast feedback and again on the server (the API
 * is the authority).
 *
 * Connection: POST/PATCH /api/threat-intelligence.
 */

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

export function IndicatorFormDialog({
  canWrite,
  indicator,
  trigger,
}: {
  canWrite: boolean;
  /** When supplied the dialog edits this indicator; otherwise it creates one. */
  indicator?: IndicatorListItem;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(indicator);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<IndicatorType>(indicator?.type ?? "IP");
  const [value, setValue] = useState(indicator?.value ?? "");
  const [threatType, setThreatType] = useState(indicator?.threatType ?? "");
  const [confidence, setConfidence] = useState(String(indicator?.confidence ?? 50));
  const [source, setSource] = useState(indicator?.source ?? "manual");
  const [description, setDescription] = useState(indicator?.description ?? "");
  const [active, setActive] = useState(indicator?.active ?? true);

  if (!canWrite) return null;

  function reset() {
    setType(indicator?.type ?? "IP");
    setValue(indicator?.value ?? "");
    setThreatType(indicator?.threatType ?? "");
    setConfidence(String(indicator?.confidence ?? 50));
    setSource(indicator?.source ?? "manual");
    setDescription(indicator?.description ?? "");
    setActive(indicator?.active ?? true);
  }

  async function submit() {
    const valueError = validateIndicatorValue(type, value);
    if (valueError) {
      toast.error(valueError);
      return;
    }
    if (!source.trim()) {
      toast.error("Source is required.");
      return;
    }
    const confidenceNumber = Number(confidence);
    if (!Number.isInteger(confidenceNumber) || confidenceNumber < 0 || confidenceNumber > 100) {
      toast.error("Confidence must be a whole number between 0 and 100.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type,
        value: value.trim(),
        threatType: threatType.trim() || null,
        confidence: confidenceNumber,
        source: source.trim(),
        description: description.trim() || null,
        active,
      };

      const response = await fetch(
        isEdit ? `/api/threat-intelligence/${indicator!.id}` : "/api/threat-intelligence",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !data?.ok) {
        toast.error(data?.error ?? "Could not save the indicator.");
        return;
      }

      toast.success(isEdit ? "Indicator updated." : "Indicator added.");
      setOpen(false);
      if (!isEdit) reset();
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && !isEdit) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit indicator" : "Add indicator"}</DialogTitle>
          <DialogDescription>
            Indicators feed the risk engine: when an event&apos;s source IP matches
            an active indicator, its risk score is raised.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Type">
              <select
                className={selectClass}
                value={type}
                onChange={(event) => setType(event.target.value as IndicatorType)}
                disabled={submitting}
              >
                {INDICATOR_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Confidence (0-100)">
              <Input
                type="number"
                min={0}
                max={100}
                value={confidence}
                onChange={(event) => setConfidence(event.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>

          <Field label="Value">
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={
                type === "IP"
                  ? "203.0.113.10"
                  : type === "DOMAIN"
                    ? "malicious.example.com"
                    : type === "HASH"
                      ? "44d88612fea8a8f36de82e1278abb02f"
                      : "http://malicious.example.com/payload.bin"
              }
              disabled={submitting}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Threat type">
              <Input
                value={threatType}
                onChange={(event) => setThreatType(event.target.value)}
                placeholder="e.g. Botnet C2"
                disabled={submitting}
              />
            </Field>
            <Field label="Source">
              <Input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="e.g. manual"
                disabled={submitting}
              />
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Why is this indicator suspicious?"
              rows={3}
              maxLength={1000}
              disabled={submitting}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              disabled={submitting}
              className="size-4 accent-[var(--primary)]"
            />
            Active (considered by the risk engine)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : isEdit ? (
              <Save className="size-3.5" aria-hidden="true" />
            ) : (
              <Plus className="size-3.5" aria-hidden="true" />
            )}
            {isEdit ? "Save changes" : "Add indicator"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
