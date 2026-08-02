import "server-only";
import { getSettings } from "@/lib/settings";
import { sendTemplateEmail } from "./send";
import type { EmailContext } from "./render";

/**
 * Send an admin-alert template to everyone in the admin-recipients setting.
 * Reads `email_admin_recipients` (falls back to `admin_notification_recipients`).
 * Best-effort — never throws into the caller.
 */
export async function sendAdminAlert(templateKey: string, context: EmailContext): Promise<void> {
  try {
    const settings = await getSettings(["email_admin_recipients", "admin_notification_recipients"]);
    const raw = settings.email_admin_recipients ?? settings.admin_notification_recipients;
    const recipients = Array.isArray(raw)
      ? (raw as unknown[]).map((r) => String(r).trim()).filter(Boolean)
      : typeof raw === "string"
        ? raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
        : [];
    for (const to of recipients) {
      await sendTemplateEmail(templateKey, { to, context });
    }
  } catch (err) {
    console.error("[email] admin alert failed", templateKey, err);
  }
}
