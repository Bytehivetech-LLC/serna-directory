"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createUserAction, type CreateUserResult } from "@/lib/admin/users-actions";

type Method = "invite" | "password";

export function AddUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "moderator" | "admin">("user");
  const [verified, setVerified] = useState(false);
  const [method, setMethod] = useState<Method>("invite");
  const [tempPassword, setTempPassword] = useState("");

  const [mfaCode, setMfaCode] = useState("");
  const [needMfa, setNeedMfa] = useState(false);
  const [created, setCreated] = useState<{ password?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setFullName(""); setEmail(""); setRole("user"); setVerified(false);
    setMethod("invite"); setTempPassword(""); setMfaCode(""); setNeedMfa(false);
    setCreated(null); setCopied(false);
  }

  function payload() {
    return { fullName, email, role, verified, method, tempPassword: tempPassword || undefined };
  }

  function handleResult(res: CreateUserResult) {
    if (res.ok) {
      if (res.tempPassword) {
        setCreated({ password: res.tempPassword });
        toast.success(res.message);
      } else {
        toast.success(res.message);
        setOpen(false);
        reset();
      }
      router.refresh();
      return;
    }
    if (res.mfaRequired) {
      setNeedMfa(true);
      return;
    }
    if (res.existingUserId) {
      toast.error(
        <span>
          A user with that email already exists.{" "}
          <Link href={`/admin/users/${res.existingUserId}`} className="underline">
            Open it
          </Link>
        </span>,
      );
      return;
    }
    toast.error(res.error);
  }

  function submit() {
    startTransition(async () => {
      const res = await createUserAction(payload());
      handleResult(res);
    });
  }

  function verifyMfaThenSubmit() {
    startTransition(async () => {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.find((f) => f.status === "verified");
      if (!factor) {
        toast.error("No authenticator app is set up. Add one in your profile first.");
        return;
      }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: mfaCode });
      if (error) {
        toast.error("That code did not work. Try again.");
        return;
      }
      setNeedMfa(false);
      setMfaCode("");
      const res = await createUserAction(payload());
      handleResult(res);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" /> Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">User created</DialogTitle>
              <DialogDescription>
                Share this temporary password with them now — it won&rsquo;t be shown again. They&rsquo;ll
                be asked to change it on first sign-in.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2">
              <code className="flex-1 font-mono text-sm text-ink">{created.password}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(created.password ?? "");
                  setCopied(true);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => { setOpen(false); reset(); }}>Done</Button>
            </DialogFooter>
          </>
        ) : needMfa ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Confirm it&rsquo;s you</DialogTitle>
              <DialogDescription>
                Creating a {role} is sensitive. Enter the 6-digit code from your authenticator app.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="add-user-mfa">Authentication code</Label>
              <Input
                id="add-user-mfa"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNeedMfa(false)}>Back</Button>
              <Button onClick={verifyMfaThenSubmit} disabled={pending || mfaCode.length !== 6}>
                Verify &amp; create
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Add a user</DialogTitle>
              <DialogDescription>Create an account and choose how they get in.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="au-name">Full name</Label>
                <Input id="au-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="au-email">Email</Label>
                <Input id="au-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="au-role">Role</Label>
                  <select
                    id="au-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as typeof role)}
                    className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                  >
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Switch id="au-verified" checked={verified} onCheckedChange={setVerified} />
                  <Label htmlFor="au-verified">Verified</Label>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-ink">How do they get in?</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="au-method" checked={method === "invite"} onChange={() => setMethod("invite")} />
                  Send an invitation email (magic link)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="au-method" checked={method === "password"} onChange={() => setMethod("password")} />
                  Set a temporary password
                </label>
                {method === "password" ? (
                  <Input
                    type="text"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="At least 10 characters"
                    autoComplete="off"
                  />
                ) : null}
              </fieldset>
              {role !== "user" ? (
                <p className="rounded-lg border border-warm-border bg-warm px-3 py-2 text-xs text-warn-ink">
                  Creating a {role} will ask for your 2FA code.
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={pending || !fullName || !email}>Create user</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
