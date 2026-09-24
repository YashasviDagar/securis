"use client";

import { useMemo, useState } from "react";
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
import { GROUP_BY_FIELDS, type GroupByField } from "@/types/detection";
import { RULE_TYPES, SEVERITIES, SOURCE_TYPES, type RuleType, type Severity } from "@/types/security";
import type { RuleListItem } from "@/types/rules";

/**
 * Securis - Detection rule form dialog
 *
 * Client component used to create and edit rules. The condition document is
 * type-specific, so the form renders different fields per rule type and builds
 * the JSON on submit. The server validates the condition against the same
 * schema the detection engine uses.
 *
 * Connection: POST/PATCH /api/detection-rules -> server/services/rule-service.ts.
 */

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
      {hint ? <p className="text-[0.65rem] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Convert a comma-separated input into a string, array or undefined. */
function csvToValue(input: string): string | string[] | undefined {
  const parts = input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return parts;
}

/** Render a condition value (string or array) back into a comma-separated input. */
function valueToCsv(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") return value;
  return "";
}

/** Form state covering every field any rule type can use. */
interface FormState {
  code: string;
  name: string;
  description: string;
  ruleType: RuleType;
  severity: Severity;
  enabled: boolean;
  threshold: string;
  timeWindowSeconds: string;
  // shared match filters
  eventType: string;
  sourceType: string;
  status: string;
  resource: string;
  resourceMatch: "exact" | "contains";
  username: string;
  messageContains: string;
  // aggregate
  groupBy: GroupByField;
  count: string;
  windowSeconds: string;
  // correlation
  failedEventType: string;
  successEventType: string;
  requireNewIp: boolean;
  // user-based
  newIp: boolean;
  newDevice: boolean;
  offHours: boolean;
  failedBeforeSuccess: boolean;
  minSignals: string;
  offHoursStart: string;
  offHoursEnd: string;
}

function emptyState(): FormState {
  return {
    code: "",
    name: "",
    description: "",
    ruleType: "THRESHOLD",
    severity: "MEDIUM",
    enabled: true,
    threshold: "5",
    timeWindowSeconds: "300",
    eventType: "LOGIN_FAILED",
    sourceType: "",
    status: "",
    resource: "",
    resourceMatch: "exact",
    username: "",
    messageContains: "",
    groupBy: "sourceIp",
    count: "5",
    windowSeconds: "",
    failedEventType: "LOGIN_FAILED",
    successEventType: "LOGIN_SUCCESS",
    requireNewIp: true,
    newIp: true,
    newDevice: true,
    offHours: false,
    failedBeforeSuccess: true,
    minSignals: "3",
    offHoursStart: "22",
    offHoursEnd: "6",
  };
}

/** Populate the form from an existing rule. */
function stateFromRule(rule: RuleListItem, condition: Record<string, unknown>): FormState {
  const base = emptyState();
  return {
    ...base,
    code: rule.code,
    name: rule.name,
    description: rule.description,
    ruleType: rule.ruleType,
    severity: rule.severity,
    enabled: rule.enabled,
    threshold: rule.threshold === null ? "" : String(rule.threshold),
    timeWindowSeconds: rule.timeWindowSeconds === null ? "" : String(rule.timeWindowSeconds),
    eventType: valueToCsv(condition.eventType),
    sourceType: valueToCsv(condition.sourceType),
    status: valueToCsv(condition.status),
    resource: valueToCsv(condition.resource),
    resourceMatch: condition.resourceMatch === "contains" ? "contains" : "exact",
    username: typeof condition.username === "string" ? condition.username : "",
    messageContains: typeof condition.messageContains === "string" ? condition.messageContains : "",
    groupBy: (condition.groupBy as GroupByField) ?? base.groupBy,
    count: condition.count !== undefined ? String(condition.count) : base.count,
    windowSeconds:
      condition.windowSeconds !== undefined ? String(condition.windowSeconds) : "",
    failedEventType:
      typeof condition.failedEventType === "string" ? condition.failedEventType : base.failedEventType,
    successEventType:
      typeof condition.successEventType === "string" ? condition.successEventType : base.successEventType,
    requireNewIp: Boolean(condition.requireNewIp),
    newIp: Boolean(condition.newIp),
    newDevice: Boolean(condition.newDevice),
    offHours: Boolean(condition.offHours),
    failedBeforeSuccess: Boolean(condition.failedBeforeSuccess),
    minSignals: condition.minSignals !== undefined ? String(condition.minSignals) : base.minSignals,
    offHoursStart:
      condition.offHoursStart !== undefined ? String(condition.offHoursStart) : base.offHoursStart,
    offHoursEnd: condition.offHoursEnd !== undefined ? String(condition.offHoursEnd) : base.offHoursEnd,
  };
}

/** Build the type-specific condition document from the form state. */
function buildCondition(state: FormState): Record<string, unknown> {
  const shared = {
    ...(csvToValue(state.eventType) ? { eventType: csvToValue(state.eventType) } : {}),
    ...(csvToValue(state.sourceType) ? { sourceType: csvToValue(state.sourceType) } : {}),
    ...(csvToValue(state.status) ? { status: csvToValue(state.status) } : {}),
    ...(csvToValue(state.resource) ? { resource: csvToValue(state.resource) } : {}),
    ...(state.username.trim() ? { username: state.username.trim() } : {}),
  };

  switch (state.ruleType) {
    case "EVENT_MATCH":
      return {
        ...shared,
        ...(state.resource.trim() && state.resourceMatch === "contains"
          ? { resourceMatch: "contains" }
          : {}),
        ...(state.messageContains.trim() ? { messageContains: state.messageContains.trim() } : {}),
      };

    case "THRESHOLD":
    case "TIME_WINDOW":
    case "IP_BASED":
      return {
        ...shared,
        groupBy: state.groupBy,
        count: Number(state.count) || 1,
        ...(state.windowSeconds ? { windowSeconds: Number(state.windowSeconds) } : {}),
      };

    case "CORRELATION":
      return {
        failedEventType: state.failedEventType.trim() || "LOGIN_FAILED",
        successEventType: state.successEventType.trim() || "LOGIN_SUCCESS",
        groupBy: state.groupBy === "sourceIp" ? "sourceIp" : "username",
        ...(state.count ? { count: Number(state.count) } : {}),
        ...(state.windowSeconds ? { windowSeconds: Number(state.windowSeconds) } : {}),
        ...(state.requireNewIp ? { requireNewIp: true } : {}),
      };

    case "USER_BASED":
      return {
        ...(csvToValue(state.eventType) ? { eventType: csvToValue(state.eventType) } : {}),
        ...(state.newIp ? { newIp: true } : {}),
        ...(state.newDevice ? { newDevice: true } : {}),
        ...(state.offHours ? { offHours: true } : {}),
        ...(state.failedBeforeSuccess ? { failedBeforeSuccess: true } : {}),
        ...(state.minSignals ? { minSignals: Number(state.minSignals) } : {}),
        ...(state.count ? { count: Number(state.count) } : {}),
        ...(state.windowSeconds ? { windowSeconds: Number(state.windowSeconds) } : {}),
        ...(state.offHours ? { offHoursStart: Number(state.offHoursStart) || 22 } : {}),
        ...(state.offHours ? { offHoursEnd: Number(state.offHoursEnd) || 6 } : {}),
      };
  }
}

export function RuleFormDialog({
  canWrite,
  rule,
  condition,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  canWrite: boolean;
  /** When supplied the dialog edits this rule; otherwise it creates one. */
  rule?: RuleListItem;
  condition?: Record<string, unknown>;
  /** Trigger element. Omit when driving the dialog with `open`. */
  trigger?: React.ReactNode;
  /** Controlled open state (used by the row actions after fetching details). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(rule);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<FormState>(() =>
    rule ? stateFromRule(rule, condition ?? {}) : emptyState(),
  );

  const isAggregate = useMemo(
    () => ["THRESHOLD", "TIME_WINDOW", "IP_BASED"].includes(state.ruleType),
    [state.ruleType],
  );

  if (!canWrite) return null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((previous) => ({ ...previous, [key]: value }));
  }

  async function submit() {
    if (state.code.trim().length < 3) {
      toast.error("Code must be at least 3 characters.");
      return;
    }
    if (state.name.trim().length < 3) {
      toast.error("Name must be at least 3 characters.");
      return;
    }
    if (!state.description.trim()) {
      toast.error("Description is required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: state.code.trim().toUpperCase(),
        name: state.name.trim(),
        description: state.description.trim(),
        ruleType: state.ruleType,
        severity: state.severity,
        condition: buildCondition(state),
        threshold: state.threshold ? Number(state.threshold) : null,
        timeWindowSeconds: state.timeWindowSeconds ? Number(state.timeWindowSeconds) : null,
        enabled: state.enabled,
      };

      const response = await fetch(
        isEdit ? `/api/detection-rules/${rule!.id}` : "/api/detection-rules",
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
        toast.error(data?.error ?? "Could not save the rule.");
        return;
      }

      toast.success(isEdit ? "Rule updated." : "Rule created.");
      setOpen(false);
      if (!isEdit) setState(emptyState());
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
        if (!next) setState(rule ? stateFromRule(rule, condition ?? {}) : emptyState());
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit detection rule" : "New detection rule"}</DialogTitle>
          <DialogDescription>
            Rules are stored in the database and evaluated by the detection engine on
            the next run — no deployment required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Rule code" hint="UPPER_SNAKE_CASE, e.g. BRUTE_FORCE_002">
              <Input
                value={state.code}
                onChange={(event) => update("code", event.target.value.toUpperCase())}
                placeholder="BRUTE_FORCE_002"
                disabled={submitting}
              />
            </Field>
            <Field label="Name">
              <Input
                value={state.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Brute Force Detection"
                disabled={submitting}
              />
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              value={state.description}
              onChange={(event) => update("description", event.target.value)}
              rows={2}
              maxLength={2000}
              disabled={submitting}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Rule type">
              <select
                className={selectClass}
                value={state.ruleType}
                onChange={(event) => update("ruleType", event.target.value as RuleType)}
                disabled={submitting}
              >
                {RULE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Severity">
              <select
                className={selectClass}
                value={state.severity}
                onChange={(event) => update("severity", event.target.value as Severity)}
                disabled={submitting}
              >
                {SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Threshold" hint="Aggregate/correlation rules">
              <Input
                type="number"
                min={1}
                value={state.threshold}
                onChange={(event) => update("threshold", event.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Time window (seconds)">
              <Input
                type="number"
                min={1}
                value={state.timeWindowSeconds}
                onChange={(event) => update("timeWindowSeconds", event.target.value)}
                disabled={submitting}
              />
            </Field>
            <label className="mt-5 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={state.enabled}
                onChange={(event) => update("enabled", event.target.checked)}
                disabled={submitting}
                className="size-4 accent-[var(--primary)]"
              />
              Enabled
            </label>
          </div>

          <div className="rounded-lg border border-border/50 p-3">
            <p className="mb-3 text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
              Condition · {state.ruleType}
            </p>

            {/* Correlation-specific fields */}
            {state.ruleType === "CORRELATION" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Failed event type">
                  <Input
                    value={state.failedEventType}
                    onChange={(event) => update("failedEventType", event.target.value)}
                    disabled={submitting}
                  />
                </Field>
                <Field label="Success event type">
                  <Input
                    value={state.successEventType}
                    onChange={(event) => update("successEventType", event.target.value)}
                    disabled={submitting}
                  />
                </Field>
                <Field label="Group by">
                  <select
                    className={selectClass}
                    value={state.groupBy}
                    onChange={(event) => update("groupBy", event.target.value as GroupByField)}
                    disabled={submitting}
                  >
                    <option value="username">username</option>
                    <option value="sourceIp">sourceIp</option>
                  </select>
                </Field>
                <Field label="Failures before success">
                  <Input
                    type="number"
                    min={1}
                    value={state.count}
                    onChange={(event) => update("count", event.target.value)}
                    disabled={submitting}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={state.requireNewIp}
                    onChange={(event) => update("requireNewIp", event.target.checked)}
                    disabled={submitting}
                    className="size-4 accent-[var(--primary)]"
                  />
                  Require a new source IP
                </label>
              </div>
            ) : state.ruleType === "USER_BASED" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Trigger event type">
                    <Input
                      value={state.eventType}
                      onChange={(event) => update("eventType", event.target.value)}
                      placeholder="LOGIN_SUCCESS"
                      disabled={submitting}
                    />
                  </Field>
                  <Field label="Minimum signals" hint="Defaults to all enabled signals">
                    <Input
                      type="number"
                      min={1}
                      value={state.minSignals}
                      onChange={(event) => update("minSignals", event.target.value)}
                      disabled={submitting}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ["newIp", "New IP"],
                    ["newDevice", "New device"],
                    ["offHours", "Off hours"],
                    ["failedBeforeSuccess", "Failures first"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={state[key]}
                        onChange={(event) => update(key, event.target.checked)}
                        disabled={submitting}
                        className="size-4 accent-[var(--primary)]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {state.offHours ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Off-hours start (UTC hour)">
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={state.offHoursStart}
                        onChange={(event) => update("offHoursStart", event.target.value)}
                        disabled={submitting}
                      />
                    </Field>
                    <Field label="Off-hours end (UTC hour)">
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={state.offHoursEnd}
                        onChange={(event) => update("offHoursEnd", event.target.value)}
                        disabled={submitting}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Event type" hint="Comma-separated for multiple">
                    <Input
                      value={state.eventType}
                      onChange={(event) => update("eventType", event.target.value)}
                      placeholder="LOGIN_FAILED"
                      disabled={submitting}
                    />
                  </Field>
                  <Field label="Source type" hint={`One of: ${SOURCE_TYPES.join(", ")}`}>
                    <Input
                      value={state.sourceType}
                      onChange={(event) => update("sourceType", event.target.value)}
                      placeholder="AUTH"
                      disabled={submitting}
                    />
                  </Field>
                  <Field label="Status" hint="Comma-separated, e.g. 401,403">
                    <Input
                      value={state.status}
                      onChange={(event) => update("status", event.target.value)}
                      disabled={submitting}
                    />
                  </Field>
                  <Field label="Resource" hint="Comma-separated, e.g. /admin,/config">
                    <Input
                      value={state.resource}
                      onChange={(event) => update("resource", event.target.value)}
                      disabled={submitting}
                    />
                  </Field>
                </div>

                {state.ruleType === "EVENT_MATCH" ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Resource match">
                      <select
                        className={selectClass}
                        value={state.resourceMatch}
                        onChange={(event) =>
                          update("resourceMatch", event.target.value as "exact" | "contains")
                        }
                        disabled={submitting}
                      >
                        <option value="exact">Exact</option>
                        <option value="contains">Contains</option>
                      </select>
                    </Field>
                    <Field label="Username">
                      <Input
                        value={state.username}
                        onChange={(event) => update("username", event.target.value)}
                        disabled={submitting}
                      />
                    </Field>
                    <Field label="Message contains">
                      <Input
                        value={state.messageContains}
                        onChange={(event) => update("messageContains", event.target.value)}
                        disabled={submitting}
                      />
                    </Field>
                  </div>
                ) : null}

                {isAggregate ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Group by">
                      <select
                        className={selectClass}
                        value={state.groupBy}
                        onChange={(event) => update("groupBy", event.target.value as GroupByField)}
                        disabled={submitting}
                      >
                        {GROUP_BY_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Count (threshold)">
                      <Input
                        type="number"
                        min={1}
                        value={state.count}
                        onChange={(event) => update("count", event.target.value)}
                        disabled={submitting}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
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
            ) : isEdit ? (
              <Save className="size-3.5" aria-hidden="true" />
            ) : (
              <Plus className="size-3.5" aria-hidden="true" />
            )}
            {isEdit ? "Save changes" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
