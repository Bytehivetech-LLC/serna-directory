"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateUserProfileAction } from "@/lib/admin/users-actions";

export function UserProfileForm({
  userId,
  initial,
}: {
  userId: string;
  initial: {
    full_name: string;
    phone: string;
    business_address: string;
    notes: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);

  const set = (key: keyof typeof values, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  function save() {
    startTransition(async () => {
      const res = await updateUserProfileAction(userId, {
        full_name: values.full_name,
        phone: values.phone,
        business_address: values.business_address,
        notes: values.notes,
      });
      if (res.ok) {
        toast.success(res.message ?? "Saved.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pf-name">Full name</Label>
          <Input
            id="pf-name"
            value={values.full_name}
            onChange={(e) => set("full_name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-phone">Phone</Label>
          <Input
            id="pf-phone"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-address">Business address</Label>
        <Input
          id="pf-address"
          value={values.business_address}
          onChange={(e) => set("business_address", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-notes">Internal notes</Label>
        <Textarea
          id="pf-notes"
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="Only visible to staff."
        />
      </div>
      <div>
        <Button onClick={save} disabled={pending}>
          Save profile
        </Button>
      </div>
    </div>
  );
}
