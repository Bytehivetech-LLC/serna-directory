"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SaveResult = { ok: boolean; message?: string; error?: string; mfaRequired?: boolean };

/**
 * Runs a server action; if it reports `mfaRequired`, prompts for a TOTP code,
 * elevates the session in the browser, and retries. Shared by every secret-write
 * form on the integrations tab.
 */
export function useSecretSave() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mfaOpen, setMfaOpen] = useState(false);
  const retry = useRef<null | (() => Promise<SaveResult>)>(null);

  function save(fn: () => Promise<SaveResult>, onOk?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if (res.message) toast.success(res.message);
        onOk?.();
        router.refresh();
      } else if (res.mfaRequired) {
        retry.current = fn;
        setMfaOpen(true);
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  const MfaDialog = (
    <MfaChallengeDialog
      open={mfaOpen}
      onOpenChange={setMfaOpen}
      onVerified={() => {
        setMfaOpen(false);
        const fn = retry.current;
        retry.current = null;
        if (fn) save(fn);
      }}
    />
  );

  return { save, pending, MfaDialog };
}

function MfaChallengeDialog({
  open,
  onOpenChange,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.find((f) => f.status === "verified");
      if (!factor) {
        toast.error("No authenticator app is set up. Add one in your profile first.");
        return;
      }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) {
        toast.error("That code did not work. Try again.");
        return;
      }
      setCode("");
      onVerified();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Confirm it is you</DialogTitle>
          <DialogDescription>
            Saving a secret needs a fresh check. Enter the 6-digit code from your authenticator app.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="mfa-code">Authentication code</Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={verify} disabled={busy || code.length !== 6}>Verify</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
