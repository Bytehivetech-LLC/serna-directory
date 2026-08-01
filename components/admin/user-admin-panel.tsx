"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Ban, KeyRound, Mail, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  verifyUsersAction,
  suspendUsersAction,
  changeUserRoleAction,
  sendPasswordResetAction,
  emailUserAction,
  softDeleteUserAction,
} from "@/lib/admin/users-actions";
import type { AdminActionResult } from "@/lib/admin/users-actions";

export function UserAdminPanel({
  userId,
  email,
  role,
  isVerified,
  isSuspended,
  isSelf,
}: {
  userId: string;
  email: string;
  role: string;
  isVerified: boolean;
  isSuspended: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  function run(fn: () => Promise<AdminActionResult>, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done.");
        after?.();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Verify */}
      <Button
        variant="outline"
        className="w-full justify-start"
        disabled={pending}
        onClick={() => run(() => verifyUsersAction([userId], !isVerified))}
      >
        <BadgeCheck className="h-4 w-4" />
        {isVerified ? "Remove verification" : "Verify user"}
      </Button>

      {/* Suspend / Unsuspend */}
      {isSuspended ? (
        <Button
          variant="outline"
          className="w-full justify-start"
          disabled={pending}
          onClick={() => run(() => suspendUsersAction([userId], false))}
        >
          <Ban className="h-4 w-4" /> Lift suspension
        </Button>
      ) : (
        <Button
          variant="outline"
          className="w-full justify-start"
          disabled={pending || isSelf}
          title={isSelf ? "You can't suspend your own account." : undefined}
          onClick={() => {
            setReason("");
            setSuspendOpen(true);
          }}
        >
          <Ban className="h-4 w-4" /> Suspend user
        </Button>
      )}

      {/* Role */}
      <div className="rounded-lg border border-border px-3 py-2.5">
        <Label htmlFor="role-select" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserCog className="h-3.5 w-3.5" /> Role
        </Label>
        <select
          id="role-select"
          value={role}
          disabled={pending || isSelf}
          onChange={(e) =>
            run(() => changeUserRoleAction(userId, e.target.value))
          }
          className="mt-1.5 h-9 w-full rounded-lg border border-border bg-card px-2.5 text-sm text-ink disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
        >
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
        {isSelf ? (
          <p className="mt-1 text-xs text-faint">You can&apos;t change your own role.</p>
        ) : null}
      </div>

      {/* Password reset */}
      <Button
        variant="outline"
        className="w-full justify-start"
        disabled={pending}
        onClick={() => run(() => sendPasswordResetAction(userId))}
      >
        <KeyRound className="h-4 w-4" /> Send password reset
      </Button>

      {/* Email user */}
      <Button
        variant="outline"
        className="w-full justify-start"
        disabled={pending}
        onClick={() => {
          setSubject("");
          setBody("");
          setEmailOpen(true);
        }}
      >
        <Mail className="h-4 w-4" /> Email this user
      </Button>

      {/* Delete */}
      <Button
        variant="outline"
        className="w-full justify-start border-danger/40 text-danger hover:bg-danger-soft hover:text-danger"
        disabled={pending || isSelf}
        title={isSelf ? "You can't delete your own account." : undefined}
        onClick={() => {
          setConfirm("");
          setDeleteOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4" /> Delete account
      </Button>

      {/* Suspend dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Suspend {email}?</DialogTitle>
            <DialogDescription>
              A suspended account can&apos;t sign in or manage listings. Add a
              reason — it&apos;s stored on the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="suspend-reason">Reason</Label>
            <Textarea
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Repeated policy violations"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    suspendUsersAction([userId], true, reason.trim() || undefined),
                  () => setSuspendOpen(false),
                )
              }
            >
              Suspend user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Email {email}</DialogTitle>
            <DialogDescription>
              Sent from the Serna sender address. Replies come back to you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="How can we help?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="Write your message…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !subject.trim() || !body.trim()}
              onClick={() =>
                run(
                  () => emailUserAction(userId, { subject, body }),
                  () => setEmailOpen(false),
                )
              }
            >
              Send email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Delete this account?</DialogTitle>
            <DialogDescription>
              This soft-deletes <b className="text-ink">{email}</b> and suspends
              access. Their listings and payment history are kept for the record.
              Blocked if they have active paid listings. Type{" "}
              <b className="text-ink">DELETE</b> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-delete-user">Confirmation</Label>
            <Input
              id="confirm-delete-user"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirm !== "DELETE" || pending}
              onClick={() =>
                run(
                  () => softDeleteUserAction(userId, confirm),
                  () => setDeleteOpen(false),
                )
              }
            >
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
