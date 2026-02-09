# Interview Prep: Admin

**Feature:** Admin-only operations: analytics dashboard, order management, invoice management  
**Base path:** `/api/admin`

All admin endpoints require **authentication** and **admin** role (`requireRole(["admin"])`).

---

## APIs

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/admin/analytics` | Yes | admin | Dashboard: overview, revenue/orders by period, top products, sales by platform/genre, review metrics, user growth |
| GET | `/api/admin/orders` | Yes | admin | List all orders (paginated; filter status, paymentStatus, userId, from, to; sort) |
| PATCH | `/api/admin/orders/:id` | Yes | admin | Update order status (pending, completed, cancelled) |
| GET | `/api/admin/invoices` | Yes | admin | List invoices (paginated; filter from, to, userId, orderId, status) |
| GET | `/api/admin/invoices/:id` | Yes | admin | Get any invoice by ID |
| PATCH | `/api/admin/invoices/:id` | Yes | admin | Update invoice (status, notes) |

---

## Implementation

**Key files:**

- **Routes:** `src/routes/admin.routes.js` — router.use(authenticateJWT); router.use(requireRole(["admin"])); then analytics (listAnalyticsQuerySchema), orders (listOrdersAdminQuerySchema, orderIdParamSchema, updateOrderStatusSchema), invoices (listInvoicesQuerySchema, invoiceIdParamSchema, updateInvoiceSchema). All admin routes are under this single router so one role check applies to all.
- **Analytics controller:** `src/controllers/admin.analytics.controller.js` — getAnalytics: reads from, to, groupBy, limit from query; calls analyticsService in parallel for getOverview, getRevenueByPeriod, getOrdersByPeriod, getTopProducts, getSalesByPlatform, getSalesByGenre, getReviewMetrics, getUserGrowth; returns single JSON with data.overview, data.revenueByPeriod, etc.
- **Analytics service:** `src/services/analytics.service.js` — Time range: if from/to omitted, last 30 days. getOverview: total revenue (paid orders, optional paidAt range), total/completed orders, orders by status, total users (isActive), total products (isActive), lowStockCount (stock < 5). getRevenueByPeriod: paid orders, bucket by paidAt (or createdAt) with $dateToString (day/week/month), sum totalAmount and count. getOrdersByPeriod: all orders, bucket by createdAt. getTopProducts: paid orders, $unwind items, group by product, sum quantity and revenue, sort by revenue, limit (1–50), $lookup product for title/platform. getSalesByPlatform / getSalesByGenre: paid orders, unwind items, lookup product platform/genre, group by platform/genre, sum revenue and order count. getReviewMetrics: count reviews, avg rating. getUserGrowth: users by createdAt in range, bucket by date.
- **Admin order controller:** `src/controllers/admin.order.controller.js` — listOrders: orderService.getOrdersForAdmin(req.query); return data + meta. updateOrderStatus: orderService.updateOrderStatus(params.id, body.status); 404 if order not found or invalid status.
- **Invoice controller (admin):** listInvoices, getInvoiceAdmin (getInvoiceById with isAdmin true), updateInvoice — see [interview-prep-invoices.md](interview-prep-invoices.md).
- **Validators:** listAnalyticsQuerySchema (from, to, groupBy day/week/month, limit 1–50); listOrdersAdminQuerySchema (page, limit, status, paymentStatus, userId, from, to, sort); updateOrderStatusSchema (status enum); listInvoicesQuerySchema, updateInvoiceSchema — see invoice schema.

**Flow:** Analytics is read-only and aggregates Orders, Users, Products, Review. Revenue and time-series use paid orders and optional from/to; when omitted, default last 30 days. Admin order list/update reuse order.service (getOrdersForAdmin filters any user; updateOrderStatus sets order.status). Invoices: list/get/update as in invoices feature doc, with admin bypassing user filter on get by id.

---

## Interview Q&A

**How is the admin role enforced?**  
After authenticateJWT we run requireRole(["admin"]) on the whole admin router. So every request to /api/admin/* must have a valid JWT and user.role === "admin". Otherwise 403.

**Why return all analytics in one request?**  
The dashboard can render overview, charts, and tables without multiple round-trips. We run the analytics service methods in parallel (Promise.all) so the response time is bounded by the slowest aggregation, not the sum of all.

**How is the time range applied for revenue and orders?**  
When from/to are provided we filter orders by paidAt (for revenue) or createdAt (for order counts) in that range. When neither is provided we use the last 30 days (defaultTimeRange in analytics.service). groupBy (day/week/month) controls the bucket format for $dateToString.

**What does “low stock” mean in overview?**  
Products with isActive true and stock < LOW_STOCK_THRESHOLD (5). We count them so admin can see how many products need restocking.

**Can admin change an order’s status after it’s paid?**  
Yes. updateOrderStatus updates the order’s status field (pending, completed, cancelled). When payment is confirmed we set status to completed; admin can later set it to cancelled (e.g. for refund) or back to pending if needed. Payment status is separate (paid/unpaid/…).

**How do top products and sales by platform/genre work?**  
We aggregate paid orders: $unwind items, compute line revenue (quantity × price), then either group by items.product (top products with $lookup for title/platform) or $lookup product and group by platform or genre. Revenue and order count are summed per bucket.

---

## Key takeaways

- All /api/admin/* routes require JWT + admin role via requireRole(["admin"]).
- Analytics: one GET returns overview, revenueByPeriod, ordersByPeriod, topProducts, salesByPlatform, salesByGenre, reviewMetrics, userGrowth; optional query params from, to, groupBy, limit.
- Revenue metrics use paid orders only; time bucketing uses paidAt when present else createdAt.
- Admin orders: list with filters (status, paymentStatus, userId, date range), PATCH status (pending/completed/cancelled).
- Admin invoices: list with filters, get any by id, PATCH status and notes.
- Analytics service uses MongoDB aggregations ($match, $group, $lookup, $dateToString) and parallel Promise.all for dashboard load.
