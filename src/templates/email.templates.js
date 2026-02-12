/**
 * HTML email templates for transactional and marketing emails.
 * All templates use inline-friendly HTML for broad client support.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5174";

function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function baseLayout(title, bodyHtml) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); padding: 24px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0 0 16px; color: #1a1a1a; }
    h2 { font-size: 16px; margin: 16px 0 8px; color: #333; }
    p { margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f8f8; font-weight: 600; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 8px 0; }
    .footer { font-size: 12px; color: #666; margin-top: 24px; }
    .amount { font-weight: 600; }
    .muted { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${bodyHtml}
    </div>
    <p class="footer">You received this email because you have an account at Game Store. If you did not expect this, please ignore.</p>
  </div>
</body>
</html>`;
}

/**
 * Purchase confirmation with invoice summary
 * @param {{ userName: string, invoiceNumber: string, orderId: string, items: Array<{ title: string, quantity: number, price: number, amount: number }>, subTotal: number, gstRate: number, gstAmount: number, totalAmount: number, issuedAt: Date }} data
 */
function purchaseWithInvoice(data) {
    const {
        userName,
        invoiceNumber,
        orderId,
        items = [],
        subTotal,
        gstRate,
        gstAmount,
        totalAmount,
        issuedAt,
    } = data;
    const dateStr = issuedAt ? new Date(issuedAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "";

    const rows = items
        .map(
            (i) =>
                `<tr>
          <td>${escapeHtml(i.title)}</td>
          <td>${i.quantity}</td>
          <td>₹${Number(i.price).toFixed(2)}</td>
          <td class="amount">₹${Number(i.amount != null ? i.amount : i.price * i.quantity).toFixed(2)}</td>
        </tr>`
        )
        .join("");

    const body = `
  <h1>Thank you for your purchase!</h1>
  <p>Hi ${escapeHtml(userName)},</p>
  <p>Your order has been confirmed. Here is your invoice summary.</p>
  <p><strong>Invoice:</strong> ${escapeHtml(invoiceNumber)}</p>
  <p><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p>Subtotal: ₹${Number(subTotal).toFixed(2)}</p>
  <p>GST (${gstRate}%): ₹${Number(gstAmount).toFixed(2)}</p>
  <p class="amount">Total: ₹${Number(totalAmount).toFixed(2)}</p>
  <p><a href="${escapeHtml(FRONTEND_URL)}/orders/${escapeHtml(String(orderId))}" class="btn">View order</a></p>
`;
    return baseLayout("Order confirmed – Invoice " + invoiceNumber, body);
}

/**
 * Cart abandonment – items left in cart for several hours
 * @param {{ userName: string, items: Array<{ title: string, quantity: number, price: number?, coverImage?: string }>, cartTotal?: number, hoursLeft?: number }} data
 */
function cartAbandonment(data) {
    const { userName, items = [], cartTotal, hoursLeft = 3 } = data;
    const listItems = items
        .map(
            (i) =>
                `<li>${escapeHtml(i.title)} ${i.quantity > 1 ? `× ${i.quantity}` : ""}${i.price != null ? ` – ₹${Number(i.price).toFixed(2)}` : ""}</li>`
        )
        .join("");
    const totalLine =
        cartTotal != null
            ? `<p class="amount">Cart total: ₹${Number(cartTotal).toFixed(2)}</p>`
            : "";

    const body = `
  <h1>You left something behind</h1>
  <p>Hi ${escapeHtml(userName)},</p>
  <p>You have items in your cart that have been waiting for over ${hoursLeft} hours. Complete your purchase before they're gone!</p>
  <ul>${listItems}</ul>
  ${totalLine}
  <p><a href="${escapeHtml(FRONTEND_URL)}/cart" class="btn">Complete purchase</a></p>
`;
    return baseLayout("Complete your purchase", body);
}

/**
 * Game on sale notification
 * @param {{ userName: string, products: Array<{ title: string, price: number, discountedPrice: number, productId: string, coverImage?: string }> }} data
 */
function gameOnSale(data) {
    const { userName, products = [] } = data;
    const listItems = products
        .map((p) => {
            const percent = Math.round((1 - p.discountedPrice / p.price) * 100);
            return `<li><strong>${escapeHtml(p.title)}</strong> – was ₹${Number(p.price).toFixed(2)}, now <strong>₹${Number(p.discountedPrice).toFixed(2)}</strong> (${percent}% off). <a href="${escapeHtml(FRONTEND_URL)}/products/${escapeHtml(String(p.productId))}">View</a></li>`;
        })
        .join("");

    const body = `
  <h1>Games you might like are on sale</h1>
  <p>Hi ${escapeHtml(userName)},</p>
  <p>Good news – the following games are now on sale. Grab them before the offer ends!</p>
  <ul>${listItems}</ul>
    <p><a href="${escapeHtml(FRONTEND_URL)}/products" class="btn">Browse all games</a></p>
`;
    return baseLayout("Games on sale", body);
}

/**
 * Product alert notification (price drop, on sale, available)
 * @param {{ userName: string, title: string, message: string, productTitle: string, productId: string, price?: number, discountedPrice?: number, isOnSale?: boolean }} data
 */
function productAlert(data) {
    const { userName, title, message, productTitle, productId, price, discountedPrice, isOnSale } = data;
    const priceLine =
        discountedPrice != null && isOnSale
            ? `<p>Was ₹${Number(price).toFixed(2)}, now <strong>₹${Number(discountedPrice).toFixed(2)}</strong></p>`
            : price != null
            ? `<p>Price: ₹${Number(price).toFixed(2)}</p>`
            : "";

    const body = `
  <h1>${escapeHtml(title)}</h1>
  <p>Hi ${escapeHtml(userName)},</p>
  <p>${escapeHtml(message)}</p>
  <p><strong>${escapeHtml(productTitle)}</strong></p>
  ${priceLine}
  <p><a href="${escapeHtml(FRONTEND_URL)}/products/${escapeHtml(String(productId))}" class="btn">View game</a></p>
`;
    return baseLayout(title, body);
}

module.exports = {
    purchaseWithInvoice,
    cartAbandonment,
    gameOnSale,
    productAlert,
    escapeHtml,
};
