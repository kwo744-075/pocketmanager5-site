import { notFound } from "next/navigation";
import { requireServerSession } from "@/lib/auth/session";
import { RECEIPT_DISCLAIMER_TEXT, RECEIPT_DISCLAIMER_TITLE } from "@/lib/miniPos/receiptDisclaimer";
import { AutoPrint } from "./AutoPrint";

type ReceiptPageProps = {
  params: Promise<{ slug: string; workOrderId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function getFirstParam(search: Record<string, string | string[] | undefined> | undefined, key: string) {
  if (!search) return null;
  const raw = search[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function lineBreaks(text: string) {
  return text.split("\n").map((chunk, idx) => (
    // eslint-disable-next-line react/no-array-index-key
    <span key={idx}>
      {chunk}
      <br />
    </span>
  ));
}

export default async function MiniPosReceiptPage({ params, searchParams }: ReceiptPageProps) {
  const { slug, workOrderId } = await params;
  if (slug !== "mini-pos") notFound();
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const format = getFirstParam(resolvedSearch, "format");

  const session = await requireServerSession();

  const { data: wo, error } = await session.supabase
    .from("manual_work_orders")
    .select("*")
    .eq("id", workOrderId)
    .maybeSingle();

  if (error || !wo) {
    notFound();
  }

  const payload = (wo.payload ?? {}) as any;
  const cartItems = (payload.cartItems ?? []) as Array<{ label: string; price: number; quantity: number }>;
  const customer = (payload.customerInfo ?? {}) as Record<string, string | undefined>;
  const vehicle = (payload.vehicleInfo ?? {}) as Record<string, string | undefined>;

  const issuedAt = new Date(wo.updated_at ?? wo.created_at).toLocaleString();
  const title = `Work Order ${String(wo.id).slice(0, 8).toUpperCase()}`;

  return (
    <html lang="en">
      <head>
        <title>{title}</title>
        <style>{`
          :root { color-scheme: light; }
          body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111827; }
          .page { padding: 22px 22px 160px; max-width: 980px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #111827; padding-bottom: 12px; }
          .headerTitle { font-size: 18px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; }
          .headerMeta { font-size: 12px; line-height: 1.35; text-align: right; }
          .grid { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .block { border: 1px solid #111827; padding: 10px 12px; }
          .blockTitle { font-size: 11px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; margin: 0 0 6px; }
          .kv { font-size: 12px; line-height: 1.35; }
          .kv strong { font-weight: 700; }
          .items { margin-top: 14px; border: 1px solid #111827; }
          .itemsHeader { display: grid; grid-template-columns: 1fr 90px 90px 110px; gap: 10px; padding: 8px 12px; border-bottom: 1px solid #111827; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
          .itemsRow { display: grid; grid-template-columns: 1fr 90px 90px 110px; gap: 10px; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
          .itemsRow:last-child { border-bottom: 0; }
          .right { text-align: right; }
          .muted { color: #374151; }
          .totalsWrap { margin-top: 14px; display: grid; grid-template-columns: 1fr 280px; gap: 14px; align-items: start; }
          .totals { border: 2px solid #111827; padding: 10px 12px; }
          .totalsLine { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 4px 0; }
          .totalsLine strong { font-weight: 800; }
          .totalDue { border-top: 2px solid #111827; margin-top: 6px; padding-top: 8px; font-size: 14px; font-weight: 900; }

          .receiptFooter { position: fixed; left: 0; right: 0; bottom: 0; background: #b91c1c; color: #fff; padding: 14px 16px; }
          .receiptFooterTitle { font-weight: 900; font-size: 16px; letter-spacing: 0.5px; text-transform: uppercase; }
          .receiptFooterText { margin-top: 8px; font-size: 12px; line-height: 1.35; font-weight: 600; white-space: pre-wrap; }
          .receiptFooterMeta { margin-top: 10px; display: flex; justify-content: space-between; gap: 10px; font-size: 11px; opacity: 0.95; font-weight: 700; flex-wrap: wrap; }
          @media print {
            .receiptFooter { break-inside: avoid; }
          }
        `}</style>
      </head>
      <body>
        <AutoPrint />
        <div className="page">
          <div className="header">
            <div>
              <div className="headerTitle">Invoice / Receipt</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {wo.shop_number ? `Shop ${wo.shop_number}` : "Shop"} • Manual Work Order
              </div>
            </div>
            <div className="headerMeta">
              <div>
                <strong>{title}</strong>
              </div>
              <div>Issued: {issuedAt}</div>
              {format === "pdf" ? <div className="muted">PDF format</div> : null}
            </div>
          </div>

          <div className="grid">
            <div className="block">
              <div className="blockTitle">Customer</div>
              <div className="kv">
                <div>
                  <strong>Name:</strong> {customer.name || "—"}
                </div>
                <div>
                  <strong>Phone:</strong> {customer.phone || "—"}
                </div>
                <div>
                  <strong>Email:</strong> {customer.email || "—"}
                </div>
                <div>
                  <strong>PO/Auth:</strong> {customer.purchaseOrder || "—"}
                </div>
              </div>
            </div>
            <div className="block">
              <div className="blockTitle">Vehicle</div>
              <div className="kv">
                <div>
                  <strong>VIN:</strong> {vehicle.vin || "—"}
                </div>
                <div>
                  <strong>Year/Make/Model:</strong> {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}
                </div>
                <div>
                  <strong>Mileage:</strong> {vehicle.mileage || "—"}
                </div>
                <div>
                  <strong>Plate/Unit:</strong> {[vehicle.licensePlate, vehicle.unitNumber].filter(Boolean).join(" • ") || "—"}
                </div>
                <div>
                  <strong>Oil type:</strong> {vehicle.oilType || "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="items">
            <div className="itemsHeader">
              <div>Description</div>
              <div className="right">Qty</div>
              <div className="right">Price</div>
              <div className="right">Line Total</div>
            </div>
            {cartItems.length ? (
              cartItems.map((line, idx) => {
                const qty = Number(line.quantity ?? 1) || 1;
                const price = Number(line.price ?? 0) || 0;
                const total = qty * price;
                return (
                  // eslint-disable-next-line react/no-array-index-key
                  <div className="itemsRow" key={`${line.label}-${idx}`}>
                    <div style={{ wordBreak: "break-word" }}>{line.label}</div>
                    <div className="right">{qty}</div>
                    <div className="right">{currency.format(price)}</div>
                    <div className="right">{currency.format(total)}</div>
                  </div>
                );
              })
            ) : (
              <div className="itemsRow">
                <div className="muted">No line items</div>
                <div />
                <div />
                <div />
              </div>
            )}
          </div>

          <div className="totalsWrap">
            <div className="block">
              <div className="blockTitle">Notes</div>
              <div className="kv">{payload.serviceNotes ? String(payload.serviceNotes) : "—"}</div>
            </div>
            <div className="totals">
              <div className="totalsLine">
                <span>Subtotal</span>
                <span>{currency.format(Number(wo.subtotal ?? 0) || 0)}</span>
              </div>
              <div className="totalsLine">
                <span>Discounts</span>
                <span>-{currency.format(Number(wo.discount_amount ?? 0) || 0)}</span>
              </div>
              <div className="totalsLine">
                <span>Tax</span>
                <span>{currency.format(Number(wo.tax_amount ?? 0) || 0)}</span>
              </div>
              <div className="totalsLine totalDue">
                <strong>Total Due</strong>
                <strong>{currency.format(Number(wo.total_due ?? 0) || 0)}</strong>
              </div>
            </div>
          </div>
        </div>

        <footer className="receiptFooter">
          <div className="receiptFooterTitle">{RECEIPT_DISCLAIMER_TITLE}</div>
          <div className="receiptFooterText">{lineBreaks(RECEIPT_DISCLAIMER_TEXT)}</div>
          <div className="receiptFooterMeta">
            <span>RO DETAILS</span>
            <span>Started: ____</span>
            <span>Completed: ____</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

