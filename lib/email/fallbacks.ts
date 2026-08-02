import "server-only";

export type TemplateShape = {
  subject: string;
  preheader?: string;
  heading: string;
  body: string;
  callout?: string;
  cta_label?: string;
  cta_path?: string;
  footer_note?: string;
};

/**
 * Hardcoded fallbacks used only when the email_templates row is missing or
 * disabled — a transactional email must still send. The DB rows are the source
 * of truth; these keep the critical account-flow emails resilient.
 */
export const FALLBACK_TEMPLATES: Record<string, TemplateShape> = {
  complete_profile: {
    subject: "Finish setting up your {{site_name}} account",
    heading: "You're almost there, {{owner_name}}",
    body: "Your listing is saved. Click below to sign in and finish setting up your account — the link works once and expires in 24 hours.",
    cta_label: "Sign in and finish setup",
    cta_path: "{{magic_link}}",
    footer_note: "If you didn't start a listing on {{site_name}}, you can ignore this email.",
  },
  listing_submitted: {
    subject: "We've got {{listing_name}}",
    heading: "Thanks, {{owner_name}} — we've got it",
    body: "Your listing is live at a shareable link right now. It'll appear in directory search once our team reviews it, usually within {{review_days}} days.",
    cta_label: "View my listing",
    cta_path: "{{listing_path}}",
  },
  inquiry_received: {
    subject: "New enquiry about {{listing_name}}",
    heading: "You have a new enquiry",
    body: "{{enquirer_name}} ({{enquirer_email}}) sent you a message:\n\n{{message}}",
    callout: "Just reply to this email to respond to {{enquirer_name}}.",
    cta_label: "See all enquiries",
    cta_path: "/dashboard",
  },
  listing_approved: {
    subject: "{{listing_name}} is now live",
    heading: "You're approved, {{owner_name}}",
    body: "Good news — {{listing_name}} has been reviewed and is now published in the {{site_name}} directory. Families can find it in search right away.",
    cta_label: "View your live listing",
    cta_path: "{{listing_path}}",
  },
  listing_rejected: {
    subject: "About your {{site_name}} listing",
    heading: "We couldn't approve {{listing_name}} yet",
    body: "Thanks for submitting {{listing_name}}. We weren't able to publish it as-is. Here's why:\n\n{{reason}}\n\nYou're welcome to make changes and resubmit — just reply to this email if you have any questions.",
    cta_label: "Edit your listing",
    cta_path: "{{edit_link}}",
  },
  listing_changes_requested: {
    subject: "A few changes needed for {{listing_name}}",
    heading: "Almost there, {{owner_name}}",
    body: "We reviewed {{listing_name}} and need a couple of changes before it can go live:\n\n{{reason}}\n\nUpdate your listing and it'll come back to us for a quick re-review.",
    cta_label: "Make the changes",
    cta_path: "{{edit_link}}",
  },
  addons_purchased: {
    subject: "Your {{listing_name}} extras are confirmed",
    heading: "Thanks, {{owner_name}} — that's confirmed",
    body: "You added: {{items}} for {{listing_name}} ({{total}}). Anything automatic is active right away. For anything we run by hand (like a newsletter spotlight), we'll be in touch within 2 business days to schedule it.",
    cta_label: "Manage your extras",
    cta_path: "/dashboard",
  },
  addon_expiring: {
    subject: "An extra on {{listing_name}} is expiring soon",
    heading: "Heads up, {{owner_name}}",
    body: "Your {{addon_name}} on {{listing_name}} expires on {{expires_on}}. Renew it to keep the perk running without a gap.",
    cta_label: "Renew it",
    cta_path: "{{extras_link}}",
  },
  addon_fulfilled: {
    subject: "Your {{addon_name}} is done",
    heading: "All set, {{owner_name}}",
    body: "We've completed your {{addon_name}} for {{listing_name}}. {{note}}",
    cta_label: "View your listing",
    cta_path: "{{listing_path}}",
  },
  welcome: {
    subject: "Welcome to {{site_name}}",
    heading: "Welcome, {{owner_name}}",
    body: "Your account is ready. From your dashboard you can create listings, track enquiries, and manage billing.",
    cta_label: "Go to your dashboard",
    cta_path: "/dashboard",
  },
  account_suspended: {
    subject: "Your {{site_name}} account has been suspended",
    heading: "Account suspended",
    body: "Your account has been suspended and your listings are hidden. {{reason}}\n\nReply to this email if you think this was a mistake.",
  },
  verification_approved: {
    subject: "You're verified on {{site_name}}",
    heading: "You're verified, {{owner_name}}",
    body: "Your business has been verified — a badge now shows on your listings so families know you're the real deal.",
    cta_label: "See your listings",
    cta_path: "/dashboard/listings",
  },
  listing_edit_pending: {
    subject: "Your changes to {{listing_name}} are under review",
    heading: "Thanks, {{owner_name}} — we're reviewing your edits",
    body: "Your update to {{listing_name}} needs a quick review before it goes live. Your previous version stays published in the meantime.",
    cta_label: "View your listing",
    cta_path: "{{listing_path}}",
  },
  listing_unpublished: {
    subject: "{{listing_name}} has been unpublished",
    heading: "Your listing is offline",
    body: "{{listing_name}} has been unpublished and no longer appears in the directory. {{reason}}",
    cta_label: "Edit your listing",
    cta_path: "{{edit_link}}",
  },
  listing_blocked: {
    subject: "About your listing {{listing_name}}",
    heading: "Your listing has been blocked",
    body: "{{listing_name}} has been blocked from the directory. {{reason}}\n\nReply to this email if you have questions.",
  },
  listing_deleted: {
    subject: "{{listing_name}} has been deleted",
    heading: "Your listing was deleted",
    body: "{{listing_name}} has been removed from the directory. We'll keep its data and photos for {{grace_period}} days in case you want it back — after that they're permanently erased. Reply to this email to restore it.",
  },
  listing_expiring: {
    subject: "{{listing_name}} expires soon",
    heading: "Heads up, {{owner_name}}",
    body: "{{listing_name}} expires on {{expires_on}}. Renew to keep it live in the directory.",
    cta_label: "Renew now",
    cta_path: "{{edit_link}}",
  },
  listing_expired: {
    subject: "{{listing_name}} has expired",
    heading: "Your listing expired",
    body: "{{listing_name}} has expired and is no longer shown in the directory. You can bring it back anytime from your dashboard.",
    cta_label: "Reactivate",
    cta_path: "{{edit_link}}",
  },
  subscription_renewed: {
    subject: "Your {{site_name}} subscription renewed",
    heading: "Thanks, {{owner_name}}",
    body: "Your subscription renewed successfully. {{line_items}}",
    cta_label: "View billing",
    cta_path: "/dashboard/billing",
  },
  subscription_canceled: {
    subject: "Your {{site_name}} subscription was canceled",
    heading: "Subscription canceled",
    body: "Your subscription has been canceled and won't renew. Your paid features stay active until the end of the current period.",
    cta_label: "Manage billing",
    cta_path: "/dashboard/billing",
  },
  inquiry_confirmation: {
    subject: "We passed your message to {{listing_name}}",
    heading: "Your message is on its way",
    body: "Thanks for reaching out to {{listing_name}} through {{site_name}}. They'll reply to you directly.",
  },
  admin_listing_pending: {
    subject: "New listing awaiting review: {{listing_name}}",
    heading: "A listing needs review",
    body: "{{listing_name}} (by {{owner_name}}) was submitted and is waiting in the review queue.",
    cta_label: "Open the review queue",
    cta_path: "/admin/listings/review",
  },
  admin_addon_fulfilment: {
    subject: "Add-on to fulfil: {{addon_name}}",
    heading: "A manual add-on needs you",
    body: "{{owner_name}} bought {{addon_name}} for {{listing_name}}. It's in the fulfilment queue.",
    cta_label: "Open fulfilment",
    cta_path: "/admin/fulfilment",
  },
  admin_payment_received: {
    subject: "Payment received: {{total}}",
    heading: "New payment",
    body: "{{owner_name}} paid {{total}} for {{listing_name}}. {{line_items}}",
    cta_label: "View payments",
    cta_path: "/admin/payments",
  },
  admin_system_alert: {
    subject: "{{site_name}} system alert",
    heading: "System alert",
    body: "{{message}}",
  },
};

/** Last-resort generic when a key has no DB row and no fallback. */
export const GENERIC_FALLBACK: TemplateShape = {
  subject: "{{site_name}}",
  heading: "{{site_name}}",
  body: "You have a new notification from {{site_name}}.",
};
