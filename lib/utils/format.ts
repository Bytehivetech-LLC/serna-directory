import { format, formatDistanceToNow, parseISO } from "date-fns";

/**
 * Format a whole-dollar or cents amount as USD.
 * By default the input is treated as whole dollars (400 -> "$400").
 * Pass `fromCents: true` for Stripe-style integer cents (40000 -> "$400").
 */
export function formatCurrency(
  amount: number | null | undefined,
  opts: { fromCents?: boolean; cents?: boolean } = {},
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const dollars = opts.fromCents ? amount / 100 : amount;
  const showCents = opts.cents ?? !Number.isInteger(dollars);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(dollars);
}

function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return parseISO(value);
}

/** "Aug 1, 2026" */
export function formatDate(value: Date | string | number): string {
  return format(toDate(value), "MMM d, yyyy");
}

/** "Aug 1, 2026, 3:45 PM" */
export function formatDateTime(value: Date | string | number): string {
  return format(toDate(value), "MMM d, yyyy, h:mm a");
}

/** "3 days ago" */
export function formatRelative(value: Date | string | number): string {
  return formatDistanceToNow(toDate(value), { addSuffix: true });
}

/**
 * Format a US phone number for display: "(480) 555-0142".
 * Handles an optional country code and falls back to the original string
 * (trimmed) when it isn't a recognisable 10/11-digit US number.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return raw.trim();
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

/** "tel:+14805550142" — E.164-ish href for a US number, else null. */
export function phoneHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return null;
}
