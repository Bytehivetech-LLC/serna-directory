"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import {
  enrollTotpAction,
  unenrollTotpAction,
  verifyTotpAction,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type Setup = { factorId: string; qr: string; secret: string };

export function MfaSection({
  initialEnrolled,
  initialFactorId,
}: {
  initialEnrolled: boolean;
  initialFactorId?: string;
}) {
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [factorId, setFactorId] = useState<string | undefined>(initialFactorId);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function begin() {
    setError(null);
    startTransition(async () => {
      const res = await enrollTotpAction();
      if (!res.ok || !res.factorId || !res.qr) {
        setError(res.error ?? "Couldn't start setup. Please try again.");
        return;
      }
      setSetup({ factorId: res.factorId, qr: res.qr, secret: res.secret ?? "" });
    });
  }

  function verify() {
    if (!setup) return;
    setError(null);
    startTransition(async () => {
      const res = await verifyTotpAction(setup.factorId, code);
      if (!res.ok) {
        setError(res.error ?? "That code didn't match.");
        return;
      }
      setEnrolled(true);
      setFactorId(setup.factorId);
      setSetup(null);
      setCode("");
    });
  }

  function cancel() {
    setSetup(null);
    setCode("");
    setError(null);
  }

  function disable() {
    if (!factorId) return;
    setError(null);
    startTransition(async () => {
      const res = await unenrollTotpAction(factorId);
      if (!res.ok) {
        setError(res.error ?? "Couldn't turn off two-factor. Please try again.");
        return;
      }
      setEnrolled(false);
      setFactorId(undefined);
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {enrolled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-ink">
            <ShieldCheck className="h-5 w-5 text-good" aria-hidden />
            <span className="font-medium">Two-factor authentication is on.</span>
            <Badge className="bg-good text-white hover:bg-good">Active</Badge>
          </div>
          <Button variant="outline" onClick={disable} disabled={pending}>
            <ShieldOff className="h-4 w-4" />
            Turn off
          </Button>
        </div>
      ) : setup ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with an authenticator app (Google Authenticator,
            1Password, Authy), then enter the 6-digit code to confirm.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Supabase returns an SVG data URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setup.qr}
              alt="Two-factor QR code"
              className="h-40 w-40 rounded-lg border border-border bg-white p-2"
            />
            {setup.secret ? (
              <div className="text-sm">
                <p className="text-muted-foreground">Or enter this key manually:</p>
                <code className="mt-1 block break-all rounded-md bg-secondary px-2 py-1 font-mono text-xs text-secondary-foreground">
                  {setup.secret}
                </code>
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mfa-code">6-digit code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="max-w-[160px] tracking-[0.3em]"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={verify} disabled={pending || code.length !== 6}>
              Verify &amp; enable
            </Button>
            <Button variant="ghost" onClick={cancel} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-sm text-muted-foreground">
            Add an authenticator app for a second layer of security when you sign
            in.
          </p>
          <Button onClick={begin} disabled={pending}>
            <ShieldCheck className="h-4 w-4" />
            Enable 2FA
          </Button>
        </div>
      )}
    </div>
  );
}
