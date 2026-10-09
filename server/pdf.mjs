function escapePdf(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildInvoicePdf({ invoiceNumber, order, fees }) {
  const lines = [
    `Nexlo VAT invoice ${invoiceNumber}`,
    `Order ${order.order_number}`,
    `Bill to: ${order.shipping_name || "Customer"}`,
    `Date: ${new Date(order.created_at).toISOString().slice(0, 10)}`,
    "",
    ...((order.items || []).map((item) => `${item.title}  x${item.quantity}  NPR ${Number(item.price || 0).toFixed(2)}`)),
    "",
    `Total NPR ${Number(order.total_amount || 0).toFixed(2)}`,
  ];
  if (fees) {
    lines.push(`Commission NPR ${Number(fees.commission || 0).toFixed(2)}`);
    lines.push(`Net to seller NPR ${Number(fees.net_to_seller || 0).toFixed(2)}`);
  }
  const content = lines
    .map((line, i) => `BT /F1 11 Tf 48 ${760 - i * 16} Td (${escapePdf(line)}) Tj ET`)
    .join("\n");
  const stream = `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    stream,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}
