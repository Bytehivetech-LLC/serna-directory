"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { FormSection } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SectionInput } from "@/lib/admin/form-builder-actions";

export function SectionDialog({
  dialog,
  onClose,
  onSaved,
  save,
}: {
  dialog: { mode: "create" } | { mode: "edit"; section: FormSection };
  onClose: () => void;
  onSaved: () => void;
  save: (input: SectionInput) => Promise<{ ok: boolean; message?: string; error?: string }>;
}) {
  const s = dialog.mode === "edit" ? dialog.section : null;
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(s?.title ?? "");
  const [subtitle, setSubtitle] = useState(s?.subtitle ?? "");
  const [active, setActive] = useState(s?.is_active ?? true);

  function submit() {
    startTransition(async () => {
      const res = await save({ title: title.trim(), subtitle: subtitle.trim() || null, is_active: active });
      if (res.ok) { toast.success(res.message ?? "Saved."); onSaved(); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{dialog.mode === "edit" ? "Edit section" : "New section"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Subtitle (optional)</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Active</span>
            <Switch checked={active} onCheckedChange={setActive} aria-label="Active" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !title.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
