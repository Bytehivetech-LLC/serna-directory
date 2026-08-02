"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { formatRelative } from "@/lib/utils/format";
import { SectionCard } from "@/components/layout/section-card";
import { Switch } from "@/components/ui/switch";
import { toggleTemplateAction } from "@/lib/admin/email-actions";
import type { TemplateListItem } from "@/lib/admin/email-queries";

const CATEGORY_LABEL: Record<string, string> = {
  account: "Account",
  listing: "Listing",
  billing: "Billing",
  addon: "Add-ons",
  inquiry: "Enquiries",
  admin: "Admin alerts",
};
const ORDER = ["account", "listing", "billing", "addon", "inquiry", "admin"];

export function EmailList({ templates }: { templates: TemplateListItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const byCat = new Map<string, TemplateListItem[]>();
  for (const t of templates) {
    const list = byCat.get(t.category) ?? [];
    list.push(t);
    byCat.set(t.category, list);
  }
  const cats = [...byCat.keys()].sort((a, b) => (ORDER.indexOf(a) + 99) - (ORDER.indexOf(b) + 99));

  function toggle(key: string, value: boolean) {
    startTransition(async () => {
      const res = await toggleTemplateAction(key, value);
      if (res.ok) { toast.success(res.message ?? "Updated."); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {cats.map((cat) => (
        <SectionCard key={cat} title={CATEGORY_LABEL[cat] ?? cat}>
          <ul className="divide-y divide-border">
            {(byCat.get(cat) ?? []).map((t) => (
              <li key={t.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/emails/${t.key}`} className="font-semibold text-ink no-underline hover:text-indigo">
                      {t.name}
                    </Link>
                    {t.is_locked ? <Lock className="h-3.5 w-3.5 text-faint" aria-label="Locked on" /> : null}
                  </div>
                  {t.description ? <p className="text-xs text-muted-foreground">{t.description}</p> : null}
                  <p className="mt-0.5 text-xs text-faint">
                    Edited {formatRelative(t.updated_at)}
                    {t.last_sent ? ` · last sent ${formatRelative(t.last_sent)}` : " · never sent"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span title={t.is_locked ? "This email is locked on — it carries essential account information." : undefined}>
                    <Switch
                      checked={t.is_enabled}
                      disabled={t.is_locked || pending}
                      onCheckedChange={(v) => toggle(t.key, v)}
                      aria-label={`${t.name} enabled`}
                    />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}
    </div>
  );
}
