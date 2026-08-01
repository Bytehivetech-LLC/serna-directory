/** Build Stripe dashboard deep links, respecting test vs live mode. */
export function stripeDashboardBase(mode: "live" | "test" | null): string {
  return mode === "live"
    ? "https://dashboard.stripe.com"
    : "https://dashboard.stripe.com/test";
}

export function stripeLink(
  mode: "live" | "test" | null,
  kind: "payments" | "invoices" | "subscriptions" | "customers",
  id: string,
): string {
  return `${stripeDashboardBase(mode)}/${kind}/${id}`;
}
