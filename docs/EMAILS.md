# Email catalogue

Every transactional email, when it fires, its variables, and who receives it.
Rendering: `lib/email/render.ts` (`renderTemplate(key, context)`) loads the
admin-editable `email_templates` row (or a code fallback in `lib/email/fallbacks.ts`),
interpolates `{{variables}}`, renders **markdown-lite** (`**bold**`,
`[links](https://…)`, blank-line paragraphs), and wraps it in the theme-driven
600px table shell (`lib/email/shell.ts`). Colours come from the site theme, so
rebranding the site rebrands the emails.

## Rules

- **Missing variable** at send time → the raw `{{key}}` is rendered and a warning
  logged. Never throws.
- **Disabled or missing** template → optional templates skip silently; locked/
  essential templates fall back to the seeded code default and still send.
- **Every send** writes an `email_log` row (template, recipient, status, provider
  id, error). See `/admin/emails/log`.
- **Owner opt-out** (`profiles.email_opt_out`, edited on `/dashboard/profile`)
  suppresses non-essential mail only: expiry nudges, welcome, tips. Receipts,
  enquiries, and account-security mail always send.
- **Admin alerts** go to the recipients in the `email_admin_recipients` setting
  (falls back to `admin_notification_recipients`).
- Globals always available: `{{site_name}}`, `{{support_email}}`, `{{site_url}}`.

## Account

| Key | Fires when | Key variables | To |
| --- | --- | --- | --- |
| `complete_profile` | New account provisioned during submit | owner_name, magic_link | Owner |
| `welcome` | First sign-in / account ready (optional) | owner_name | Owner |
| `account_suspended` | Admin suspends the user | reason | Owner |
| `verification_approved` | Admin verifies the business | owner_name | Owner |

## Listing

| Key | Fires when | Key variables | To |
| --- | --- | --- | --- |
| `listing_submitted` | Listing submitted for review | owner_name, listing_name, listing_path, review_days | Owner |
| `listing_approved` | Admin approves | owner_name, listing_name, listing_path | Owner |
| `listing_changes_requested` | Admin requests changes | owner_name, listing_name, reason, edit_link | Owner |
| `listing_rejected` | Admin rejects | owner_name, listing_name, reason, edit_link | Owner |
| `listing_edit_pending` | Edited live listing goes back to review | owner_name, listing_name, listing_path | Owner |
| `listing_unpublished` | Admin unpublishes | listing_name, reason, edit_link | Owner |
| `listing_blocked` | Admin blocks | listing_name, reason | Owner |
| `listing_deleted` | Soft delete | owner_name, listing_name, grace_period | Owner |
| `listing_expiring` | Approaching expiry (optional) | owner_name, listing_name, expires_on, edit_link | Owner |
| `listing_expired` | Past expiry (optional) | listing_name, edit_link | Owner |

## Billing

| Key | Fires when | Key variables | To |
| --- | --- | --- | --- |
| `payment_receipt` | Checkout completed | owner_name, listing_name, total, line_items, receipt_url, next_steps | Owner |
| `payment_failed` | Invoice payment failed | owner_name, grace_days | Owner |
| `subscription_renewed` | Renewal invoice paid | owner_name, line_items | Owner |
| `subscription_canceled` | Subscription canceled | owner_name | Owner |

## Add-ons

| Key | Fires when | Key variables | To |
| --- | --- | --- | --- |
| `addons_purchased` | Add-on checkout completed | owner_name, listing_name, items, total | Owner |
| `addon_fulfilled` | Admin marks a manual add-on done | owner_name, listing_name, addon_name, note, listing_path | Owner |
| `addon_expiring` | Add-on approaching expiry (optional) | owner_name, listing_name, addon_name, expires_on, extras_link | Owner |

## Enquiries

| Key | Fires when | Key variables | To |
| --- | --- | --- | --- |
| `inquiry_received` | Family sends a message | enquirer_name, enquirer_email, message, listing_name | Owner |
| `inquiry_confirmation` | Confirmation to the enquirer | listing_name | Enquirer |

## Admin alerts (to `email_admin_recipients`)

| Key | Fires when | Key variables |
| --- | --- | --- |
| `admin_listing_pending` | A listing enters the review queue | owner_name, listing_name |
| `admin_addon_fulfilment` | A manual add-on is purchased | owner_name, listing_name, addon_name |
| `admin_payment_received` | A payment is recorded | owner_name, listing_name, total, line_items |
| `admin_system_alert` | Ad-hoc system alerts | message |

## Editing

`/admin/emails` lists templates by category with an enabled switch (disabled for
locked templates). The editor validates on save that every `{{variable}}` used
exists in that template's variable list and refuses the save naming the bad one,
keeps a revision history (`email_template_versions`) with one-click revert, has a
"reset to default", and "send test to me" fires through the real pipeline.

## Testing across clients

Table-based layout + inline styles throughout — no flexbox, no grid — so Outlook
renders it. `color-scheme: light` + `supported-color-schemes: light` keep it
legible under dark-mode inversion. Preview and send a test to check Gmail
(desktop + mobile), Apple Mail, and Outlook.
