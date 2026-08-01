import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth/guards";
import { getPaymentsForExport, type PaymentsQuery } from "@/lib/admin/payments-queries";

function csvCell(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const query: PaymentsQuery = {
    status: sp.get("status") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
  };

  const rows = await getPaymentsForExport(query);

  const header = [
    "Date",
    "Status",
    "Amount",
    "Currency",
    "User",
    "Listing",
    "PaymentIntent",
    "Invoice",
    "Checkout",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.paid_at ?? r.created_at),
        csvCell(r.status),
        csvCell((r.amount_cents / 100).toFixed(2)),
        csvCell(r.currency.toUpperCase()),
        csvCell(r.user_email),
        csvCell(r.listing_name),
        csvCell(r.stripe_payment_intent_id),
        csvCell(r.stripe_invoice_id),
        csvCell(r.stripe_checkout_id),
      ].join(","),
    );
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
