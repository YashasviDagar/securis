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
import { ROLES, type Role } from "@/types/security";
import type { UserListItem } from "@/types/users";

/**
 * Securis - User form dialog
 *
 * Client component used to create and edit users. On create a policy-compliant
 * password is required (validated in the browser and again on the server); on
 * edit the password field is omitted because there is no password-change flow
 * here.
 *
 * Connection: POST/PATCH /api/users.
 */

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
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

export function UserFormDialog({
  canWrite,
  user,
  trigger,
}: {
  canWrite: boolean;
  user?: UserListItem;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(user);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? "VIEWER");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);

  if (!canWrite) return null;

  function reset() {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setPassword("");
    setRole(user?.role ?? "VIEWER");
    setIsActive(user?.isActive ?? true);
  }

  async function submit() {
    if (name.trim().length < 2) {
      toast.error("Name is required.");
      return;
    }
    if (!isEdit && !email.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!isEdit && password.length < 12) {
      toast.error("Password must be at least 12 characters and meet the policy.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = isEdit
        ? { name: name.trim(), role, isActive }
        : { name: name.trim(), email: email.trim(), password, role, isActive };

      const response = await fetch(isEdit ? `/api/users/${user!.id}` : "/api/users", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; issues?: { message: string }[] }
        | null;

      if (!response.ok || !data?.ok) {
        toast.error(data?.issues?.[0]?.message ?? data?.error ?? "Could not save the user.");
        return;
      }

      toast.success(isEdit ? "User updated." : "User created.");
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
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "Create user"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the account's name, role or active state."
              : "Create an analyst account. The password is hashed with Argon2id before storage."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} />
          </Field>

          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting || isEdit}
              placeholder="analyst@securis.local"
            />
          </Field>

          {!isEdit ? (
            <Field
              label="Password"
              hint="At least 12 characters with upper, lower, number and symbol."
            >
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                autoComplete="new-password"
              />
            </Field>
          ) : null}

          <Field label="Role">
            <select
              className={selectClass}
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              disabled={submitting}
            >
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={submitting}
              className="size-4 accent-[var(--primary)]"
            />
            Active
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
            {isEdit ? "Save changes" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
