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
};

/** Last-resort generic when a key has no DB row and no fallback. */
export const GENERIC_FALLBACK: TemplateShape = {
  subject: "{{site_name}}",
  heading: "{{site_name}}",
  body: "You have a new notification from {{site_name}}.",
};
