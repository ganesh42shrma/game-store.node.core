# Interview Prep: Payments

**Feature:** Mock payment flow (create payment, confirm/capture); triggers invoice creation and recent-purchase SSE  
**Base path:** `/api/payments`

All payment endpoints require **authentication**. There is no real gateway; the client simulates “redirect to payment” and “return and confirm.”

---

## APIs

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/payments` | Yes | Create payment for an order (body: orderId, optional method); returns payment + mockPaymentUrl |
| GET | `/api/payments/:id` | Yes | Get payment by ID (only if mine) |
| POST | `/api/payments/:id/confirm` | Yes | Confirm/capture payment; order marked paid, invoice created, SSE event emitted |

---

## Implementation

**Key files:**

- **Routes:** `src/routes/payment.routes.js` — authenticateJWT; createPaymentSchema (orderId, optional method); paymentIdParamSchema for :id and :id/confirm.
- **Controller:** `src/controllers/payment.controller.js` — createPayment: map ORDER_NOT_FOUND → 404, ORDER_ALREADY_PAID → 400; success 201 with payment and mockPaymentUrl. getPayment: 404 if not found. confirmPayment: map PAYMENT_NOT_FOUND → 404, PAYMENT_FAILED → 400, ALREADY_CAPTURED → 200 with message; success 200 with payment.
- **Service:** `src/services/payment.service.js` — createPaymentForOrder: find order by id and userId; if not found return ORDER_NOT_FOUND; if order.paymentStatus === "paid" return ORDER_ALREADY_PAID. If a payment already exists for this order with status created/authorized, return it and its mockPaymentUrl. Otherwise create Payment (order, user, amount from order.totalAmount, currency INR, status created, method, gatewayPaymentId mock_<id>), return payment and mockPaymentUrl. getPaymentById: findOne by id and user, populate order. confirmPayment: find payment by id and user; if not found return PAYMENT_NOT_FOUND; if status captured return ALREADY_CAPTURED; if failed return PAYMENT_FAILED. Set payment status captured, capturedAt; update Order: paymentStatus paid, paidAt, payment ref, status completed. Load order with user; create invoice via invoiceService.createInvoiceFromOrder; send purchase confirmation email (mailer.sendPurchaseWithInvoice); call recentPurchaseEvents.addRecentPurchase(buyerName, country, productTitles, orderId). Return populated payment.
- **Validators:** `src/validators/payment.schema.js` — orderId (ObjectId), method optional from PAYMENT_METHOD (e.g. mock_card, mock_upi, mock_netbanking).

**Flow:** User has an unpaid order. Client calls POST /payments with orderId; gets back payment id and mockPaymentUrl (e.g. /pay/:paymentId). Client can show a “Pay now” page and on button click call POST /payments/:id/confirm. Confirm: payment → captured; order → paid, completed; invoice created; email sent; SSE event pushed for “someone just purchased” toasts.

---

## Interview Q&A

**Why return an existing payment when creating again for the same order?**  
So the user can refresh the payment page or retry without creating duplicate payment records. We look for an existing payment for that order with status created or authorized; if found we return it and the same mockPaymentUrl so the client can still call confirm with that id.

**What happens when we confirm a payment?**  
We set the payment to captured and update the order: paymentStatus paid, paidAt, payment ref, status completed. Then we create an invoice from the order, send a purchase confirmation email (if mailer configured), and emit a recent-purchase event so all SSE clients get the “someone from X just purchased Y” toast.

**Why is the payment “mock”?**  
There is no integration with a real gateway (Stripe, Razorpay, etc.). The amount and method are stored; confirm just flips status. A real implementation would verify a webhook or redirect payload from the gateway before marking captured.

**What data do we send in the recent-purchase event?**  
Only buyer first name (first word of user name or “Someone”), billing country, product titles, and orderId. No email or full address—minimal for the toast and privacy.

**What if the user calls confirm twice?**  
We check payment.status === "captured" and return ALREADY_CAPTURED with 200 and the existing payment so the client can treat it as success (idempotent).

---

## Key takeaways

- Payments are mock: create → get mockPaymentUrl → confirm from client to simulate “pay now.”
- Order must belong to user and be unpaid to create payment; existing non-captured payment for same order is reused.
- Confirm: payment captured, order paid + completed, invoice created, email sent, SSE recent-purchase event emitted.
- getPaymentById and confirm are scoped to req.user.id so users only access their own payments.
- Idempotent confirm: if already captured we return 200 with “Payment already captured.”
