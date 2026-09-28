(function () {
    function escapeHtml(value) {
        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function money(value) {
        return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
    }

    function destinationMarkup(order) {
        if (order.fulfillment === "pickup") {
            const locations = (order.pickupLocations || []).map(item => `Setor ${escapeHtml(item.location?.sector || "-")}, Rua ${escapeHtml(item.location?.street || "-")}, Box ${escapeHtml(item.location?.box || "-")}`).join("<br>");
            return `<strong>Retirada no Moda Center</strong><br>${locations || "Local de retirada não informado"}`;
        }
        const address = order.deliveryAddress || {};
        return `<strong>Entrega</strong><br>${escapeHtml(address.recipient || order.clientName || "Cliente")}<br>${escapeHtml(address.street || "-")}<br>${escapeHtml(address.city || "-")} - ${escapeHtml(address.state || "-")}<br>CEP ${escapeHtml(address.zip || "-")}${address.complement ? `<br>${escapeHtml(address.complement)}` : ""}`;
    }

    function buildOrderReceiptHtml(order, audience = "cliente") {
        const orderCode = escapeHtml(String(order.id || "").slice(0, 8).toUpperCase());
        const isStore = audience === "loja";
        const title = isStore ? "Nota de separação do pedido" : "Comprovante de pedido";
        const subtitle = isStore ? "Use esta nota para conferir e separar os itens." : "Guarde este comprovante para confirmar sua compra.";
        const items = (order.items || []).map(item => `<tr><td>${escapeHtml(item.name || "Produto")}${item.variation ? `<small>${escapeHtml(item.variation.color)} / ${escapeHtml(item.variation.size)}</small>` : ""}</td><td>${Number(item.quantity || 0)}</td><td>${money(Number(item.price || 0) * Number(item.quantity || 0))}</td></tr>`).join("");
        const storeNames = [...new Set((order.items || []).map(item => item.ownerName).filter(Boolean))].join(" · ");
        return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} #${orderCode}</title><style>@page{size:auto;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:12px;background:#fff}.receipt{width:min(100%,760px);margin:0 auto;padding:24px}.brand{font-size:20px;font-weight:700;letter-spacing:.04em}.muted{color:#555}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:16px}.top h1{margin:8px 0 0;font-size:20px}.top p{margin:4px 0}.section{border:1px solid #bbb;padding:12px;margin:12px 0}.section h2{font-size:13px;margin:0 0 8px;text-transform:uppercase}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.info-grid div{line-height:1.5}.info-grid strong{display:block}.items{width:100%;border-collapse:collapse;margin-top:8px}.items th,.items td{padding:8px 4px;border-bottom:1px solid #bbb;text-align:left;vertical-align:top}.items th:nth-child(2),.items td:nth-child(2){width:60px;text-align:center}.items th:last-child,.items td:last-child{text-align:right;white-space:nowrap}.items small{display:block;margin-top:3px;color:#555}.total{display:flex;justify-content:space-between;border-top:2px solid #111;margin-top:12px;padding-top:10px;font-size:16px;font-weight:700}.footer{margin-top:20px;padding-top:10px;border-top:1px dashed #777;color:#555;font-size:11px}@media print{.receipt{width:100%;padding:0}.no-print{display:none!important}}@media(max-width:520px){.receipt{padding:10px}.info-grid{grid-template-columns:1fr}.top{display:block}}</style></head><body><main class="receipt"><header class="top"><div><div class="brand">MODA CENTER</div><h1>${title}</h1><p class="muted">${subtitle}</p></div><div><strong>Pedido #${orderCode}</strong><p class="muted">${new Date(order.createdAt || Date.now()).toLocaleString("pt-BR")}</p></div></header><section class="section"><h2>Destino do pedido</h2><div class="info-grid"><div>${destinationMarkup(order)}</div><div><strong>${isStore ? "Cliente" : "Lojas"}</strong>${escapeHtml(isStore ? order.clientName || "Cliente" : storeNames || "Loja Moda Center")}<br><strong>Modalidade</strong>${order.fulfillment === "pickup" ? "Retirada na loja" : "Entrega"}</div></div></section><section class="section"><h2>${isStore ? "Conferência dos itens" : "Itens do pedido"}</h2><table class="items"><thead><tr><th>Produto</th><th>Qtd.</th><th>Subtotal</th></tr></thead><tbody>${items}</tbody></table><div class="total"><span>Total</span><span>${money(order.total)}</span></div></section><footer class="footer">Documento gerado pelo Moda Center. Pedido registrado em ${new Date(order.createdAt || Date.now()).toLocaleString("pt-BR")}.</footer></main></body></html>`;
    }

    function downloadOrderReceipt(order, audience) {
        const blob = new Blob([buildOrderReceiptHtml(order, audience)], { type: "text/html;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `nota-pedido-${String(order.id || "pedido").slice(0, 8)}-${audience}.html`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function printOrderReceipt(order, audience) {
        const receiptWindow = window.open("", "_blank", "width=800,height=900");
        if (!receiptWindow) return;
        receiptWindow.document.write(buildOrderReceiptHtml(order, audience));
        receiptWindow.document.close();
        receiptWindow.focus();
        receiptWindow.onload = () => receiptWindow.print();
    }

    window.OrderReceipt = { build: buildOrderReceiptHtml, download: downloadOrderReceipt, print: printOrderReceipt };
}());
