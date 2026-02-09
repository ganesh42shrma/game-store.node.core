# Interview Prep: Invoices

**Feature:** Invoices for paid orders (user: get by id or by order id; admin: list, get, update)  
**Base paths:** `/api/invoices` (user get by id), `/api/orders/:id/invoice` (user get by order id), `/api/admin/invoices` (admin)

---

## APIs

### User (authenticated)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/invoices/:id` | Yes | Get invoice by ID (only if it belongs to me) |
| GET | `/api/orders/:id/invoice` | Yes | Get invoice for order (only if order is mine and paid) |

### Admin (admin role)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/admin/invoices` | Yes | admin | List invoices (paginated; filter by from, to, userId, orderId, status) |
| GET | `/api/admin/invoices/:id` | Yes | admin | Get any invoice by ID |
| PATCH | `/api/admin/invoices/:id` | Yes | admin | Update invoice (status, notes) |

---

## Implementation

**Key files:**

- **User routes:** `src/routes/invoice.routes.js` — GET /:id with invoiceIdParamSchema → getInvoice. Order route (in order.routes.js) GET /:id/invoice → invoiceController.getInvoiceByOrderId.
- **Admin routes:** `src/routes/admin.routes.js` — under router.use(requireRole(["admin"])): GET /invoices (listInvoicesQuerySchema), GET /invoices/:id, PATCH /invoices/:id (updateInvoiceSchema) → invoiceController.listInvoices, getInvoiceAdmin, updateInvoice.
- **Controller:** `src/controllers/invoice.controller.js` — getInvoiceByOrderId: invoiceService.getInvoiceByOrderId(orderId, req.user.id); 404 “Invoice not found for this order”. getInvoice: getInvoiceById(id, req.user.id, false); 404 if not found. listInvoices: invoiceService.listInvoices(req.query); return data + meta. getInvoiceAdmin: getInvoiceById(id, req.user.id, true). updateInvoice: invoiceService.updateInvoice(params.id, req.body); 404 if not found.
- **Service:** `src/services/invoice.service.js` — getNextInvoiceNumber: uses a counters collection (findOneAndUpdate with $inc on seq, upsert) to generate INV-YYYY-NNNNN. createInvoiceFromOrder(order): called from payment.service after capture; builds items from order.items (product, title, quantity, price, amount); creates Invoice with invoiceNumber, order, user, billingAddress, items, subTotal, gstRate, gstAmount, totalAmount, status issued, issuedAt. getInvoiceByOrderId: findOne by order and user. getInvoiceById(invoiceId, userId, isAdmin): if not isAdmin filter by user; populate order (paymentStatus, paidAt, status). listInvoices: filter by userId, orderId, status, issuedAt range; paginate; populate user and order. updateInvoice: findByIdAndUpdate with $set data (status, notes), new: true.
- **Validators:** `src/validators/invoice.schema.js` — invoiceIdParamSchema (id ObjectId); listInvoicesQuerySchema (page, limit, from, to, userId, orderId, status); updateInvoiceSchema (status, notes optional from INVOICE_STATUS).

**Flow:** Invoices are created only when payment is confirmed (invoiceService.createInvoiceFromOrder in payment.service). User can fetch by invoice id (must own) or by order id (order must be mine; invoice exists only if order was paid). Admin can list with filters and update status/notes.

---

## Interview Q&A

**When is an invoice created?**  
When we confirm a payment (POST /api/payments/:id/confirm). The payment service creates the order’s invoice via createInvoiceFromOrder(order) after updating the order to paid/completed. So every paid order has exactly one invoice.

**How is the invoice number generated?**  
We use a MongoDB “counters” collection. We findOneAndUpdate on { _id: "invoice" } with $inc: { seq: 1 } and upsert: true, then format as INV-<year>-<padded seq> (e.g. INV-2026-00001). This gives a unique, human-readable sequence per year.

**Why can a user get invoice by order id and by invoice id?**  
By order id: natural from the order detail page (“View invoice”). By invoice id: useful if the client stores the invoice id (e.g. after payment response or email) and later fetches the invoice directly. Both are scoped to the authenticated user.

**What can admin update on an invoice?**  
Status (e.g. draft/issued) and notes. Implemented via updateInvoiceSchema; the service does findByIdAndUpdate with the provided fields. Admin does not need to pass userId because they can access any invoice by id.

**What’s in the invoice document?**  
invoiceNumber, order (ref), user (ref), billingAddress (snapshot), items (product ref, title, quantity, price, amount per line), subTotal, gstRate, gstAmount, totalAmount, status, issuedAt, notes. Matches the order at the time of payment.

---

## Key takeaways

- Invoice is created once per order when payment is confirmed (in payment.service).
- Invoice number: sequence from counters collection, format INV-YYYY-NNNNN.
- User: get by invoice id (must own) or by order id (GET /api/orders/:id/invoice); invoice exists only for paid orders.
- Admin: list with filters (date range, userId, orderId, status), get any by id, PATCH status/notes.
- getInvoiceById(invoiceId, userId, isAdmin): when isAdmin we don’t filter by user so admin can load any invoice.
