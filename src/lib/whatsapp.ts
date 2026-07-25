export type PreorderItem = { name: string; quantity: number; unitPrice?: number };

export type PreorderParams = {
  orderType: "restaurant" | "bar";
  location?: string;
  items: PreorderItem[];
  notes?: string;
  ownerName?: string;
  businessName?: string;
};

export function formatPreorderMessage(p: PreorderParams): string {
  const lines: string[] = [];
  const now = new Date();
  lines.push(
    `*PRE-ORDER*  ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
  );
  if (p.businessName) lines.push(p.businessName);
  lines.push("━━━━━━━━━━━━━");
  if (p.location) lines.push(`*Location:* ${p.location}`);
  lines.push(`*Type:* ${p.orderType === "restaurant" ? "Restaurant" : "Bar"}`);
  lines.push("━━━━━━━━━━━━━");
  for (const item of p.items) {
    const price = item.unitPrice != null ? `  K${(item.unitPrice * item.quantity).toFixed(2)}` : "";
    lines.push(`• ${item.name} × ${item.quantity}${price}`);
  }
  if (p.items.length === 0) lines.push("(no items)");
  lines.push("━━━━━━━━━━━━━");
  if (p.notes) {
    lines.push(`*Notes:* ${p.notes}`);
    lines.push("━━━━━━━━━━━━━");
  }
  if (p.ownerName) lines.push(`From: ${p.ownerName}`);
  return lines.join("\n");
}

export function openWaLink(phone: string, text: string) {
  const num = phone.replace(/[^0-9]/g, "");
  const encoded = encodeURIComponent(text);
  const url = `https://wa.me/${num}?text=${encoded}`;
  window.open(url, "_blank");
}
