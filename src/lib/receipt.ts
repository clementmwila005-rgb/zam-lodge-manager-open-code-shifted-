import { supabase } from "@/integrations/supabase/client";

export type ReceiptData = {
  business: { name: string; business_code: string; phone?: string | null; address?: string | null };
  orderId: string;
  orderType: "restaurant" | "bar";
  tableNumber?: string | null;
  items: { name: string; quantity: number; unit_price: number; line_total: number }[];
  subtotal: number;
  serviceFee: number;
  total: number;
  paymentMethod: string | null;
  servedBy?: string | null;
  createdAt: string;
};

export async function loadReceipt(orderId: string): Promise<ReceiptData | null> {
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_type, table_id, subtotal, service_fee, total, payment_method, created_at, business_id, created_by",
    )
    .eq("id", orderId)
    .single();
  if (!order) return null;

  const [{ data: items }, { data: business }, { data: table }, { data: profile }] =
    await Promise.all([
      supabase
        .from("order_items")
        .select("name, quantity, unit_price, line_total")
        .eq("order_id", orderId),
      supabase
        .from("businesses")
        .select("name, business_code, phone, address")
        .eq("id", order.business_id)
        .single(),
      order.table_id
        ? supabase
            .from("restaurant_tables")
            .select("table_number")
            .eq("id", order.table_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      order.created_by
        ? supabase.from("profiles").select("full_name").eq("id", order.created_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return {
    business: business!,
    orderId: order.id,
    orderType: order.order_type as "restaurant" | "bar",
    tableNumber: table?.table_number ?? null,
    items: (items ?? []).map((i) => ({
      name: i.name,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
    })),
    subtotal: Number(order.subtotal),
    serviceFee: Number(order.service_fee),
    total: Number(order.total),
    paymentMethod: order.payment_method,
    servedBy: profile?.full_name ?? null,
    createdAt: order.created_at,
  };
}

export function receiptToText(r: ReceiptData): string {
  const line = "------------------------------";
  const lines: string[] = [];
  lines.push(r.business.name);
  if (r.business.address) lines.push(r.business.address);
  if (r.business.phone) lines.push("Tel: " + r.business.phone);
  lines.push("Code: " + r.business.business_code);
  lines.push(line);
  lines.push(`Receipt #${r.orderId.slice(0, 8).toUpperCase()}`);
  lines.push(new Date(r.createdAt).toLocaleString());
  lines.push(`${r.orderType.toUpperCase()}${r.tableNumber ? "  Table " + r.tableNumber : ""}`);
  if (r.servedBy) lines.push("Served by: " + r.servedBy);
  lines.push(line);
  for (const it of r.items) {
    lines.push(`${it.quantity} x ${it.name}`);
    lines.push(`   K${it.unit_price.toFixed(2)}        K${it.line_total.toFixed(2)}`);
  }
  lines.push(line);
  lines.push(`Subtotal:        K${r.subtotal.toFixed(2)}`);
  if (r.serviceFee > 0) lines.push(`Service fee:     K${r.serviceFee.toFixed(2)}`);
  lines.push(`TOTAL:           K${r.total.toFixed(2)}`);
  if (r.paymentMethod) lines.push(`Paid via:        ${r.paymentMethod.replace("_", " ")}`);
  lines.push(line);
  lines.push("Thank you!");
  return lines.join("\n");
}

export function printReceiptWindow(r: ReceiptData) {
  const w = window.open("", "_blank", "width=380,height=600");
  if (!w) return;
  const items = r.items
    .map(
      (i) =>
        `<tr><td>${i.quantity} x ${escapeHtml(i.name)}</td><td style="text-align:right">K${i.line_total.toFixed(2)}</td></tr>`,
    )
    .join("");
  w.document.write(`<!doctype html><html><head><title>Receipt ${r.orderId.slice(0, 8)}</title>
    <style>
      body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;padding:12px;width:300px;margin:0 auto;color:#000}
      h1{font-size:14px;margin:0;text-align:center}
      .muted{color:#555;text-align:center;font-size:11px}
      hr{border:none;border-top:1px dashed #999;margin:8px 0}
      table{width:100%;border-collapse:collapse}
      td{padding:2px 0;vertical-align:top}
      .totals td{font-weight:600}
      .center{text-align:center}
      @media print{ @page{margin:4mm} body{width:auto} }
    </style></head><body>
    <h1>${escapeHtml(r.business.name)}</h1>
    ${r.business.address ? `<div class="muted">${escapeHtml(r.business.address)}</div>` : ""}
    ${r.business.phone ? `<div class="muted">Tel: ${escapeHtml(r.business.phone)}</div>` : ""}
    <div class="muted">Code: ${escapeHtml(r.business.business_code)}</div>
    <hr/>
    <div>Receipt #${r.orderId.slice(0, 8).toUpperCase()}</div>
    <div class="muted" style="text-align:left">${new Date(r.createdAt).toLocaleString()}</div>
    <div>${r.orderType.toUpperCase()}${r.tableNumber ? " &middot; Table " + escapeHtml(r.tableNumber) : ""}</div>
    ${r.servedBy ? `<div class="muted" style="text-align:left">Served by: ${escapeHtml(r.servedBy)}</div>` : ""}
    <hr/>
    <table>${items}</table>
    <hr/>
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">K${r.subtotal.toFixed(2)}</td></tr>
      ${r.serviceFee > 0 ? `<tr><td>Service fee</td><td style="text-align:right">K${r.serviceFee.toFixed(2)}</td></tr>` : ""}
      <tr class="totals"><td>TOTAL</td><td style="text-align:right">K${r.total.toFixed(2)}</td></tr>
      ${r.paymentMethod ? `<tr><td>Paid via</td><td style="text-align:right">${escapeHtml(r.paymentMethod.replace("_", " "))}</td></tr>` : ""}
    </table>
    <hr/>
    <div class="center">Thank you!</div>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`);
  w.document.close();
}

export function whatsappReceipt(r: ReceiptData, phone?: string) {
  const text = encodeURIComponent(receiptToText(r));
  const num = (phone ?? "").replace(/[^0-9]/g, "");
  const url = num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank");
}

export function emailReceipt(r: ReceiptData, email?: string) {
  const subject = encodeURIComponent(
    `${r.business.name} — Receipt ${r.orderId.slice(0, 8).toUpperCase()}`,
  );
  const body = encodeURIComponent(receiptToText(r));
  const a = document.createElement("a");
  a.href = `mailto:${email ?? ""}?subject=${subject}&body=${body}`;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
