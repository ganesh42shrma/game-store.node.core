# Interview Prep: Events (SSE – Recent Purchases)

**Feature:** Server-Sent Events stream for “Someone from X just purchased Y” toasts  
**Base path:** `/api/events`

---

## APIs

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/events/recent-purchases` | No | SSE stream: initial batch of last ~20 purchases, then live events on each payment confirm |

---

## Implementation summary

- **Trigger:** When a payment is confirmed (`POST /api/payments/:id/confirm`), the payment service calls `recentPurchaseEvents.addRecentPurchase({ buyerName, country, productTitles, orderId })`.
- **Event store:** In-memory list of last 50 events and a Set of write callbacks (one per open SSE connection). Each new purchase is appended, formatted as `data: <JSON>\n\n`, and written to every subscriber.
- **SSE endpoint:** Sets headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`), sends the last 20 events to the new client, then subscribes this response’s write function. On `req.on("close")` we unsubscribe so we don’t write to closed connections.

**Key files:** `src/controllers/events.controller.js` (streamRecentPurchases), `src/services/recentPurchaseEvents.js` (addRecentPurchase, getRecentPurchases, subscribe), `src/routes/events.routes.js`, and payment.service (calls addRecentPurchase after confirm).

For **detailed SSE logic, format, and full Q&A**, see **[SSE-and-recent-purchases-interview-guide.md](SSE-and-recent-purchases-interview-guide.md)**.

---

## Interview Q&A (feature-level)

**How does this feature fit with the rest of the API?**  
It’s a read-only, real-time feed. No auth so any visitor can subscribe. The data is emitted from the payment flow: once an order is paid we push a minimal event (first name, country, product titles) so storefronts can show “Alex from India purchased Elden Ring” without exposing PII. It doesn’t change any resource; it’s a side effect of payment confirmation.

**Why no authentication on the SSE endpoint?**  
We want every storefront visitor to see the live activity. The payload is intentionally minimal (no email, no full name, no address). If we needed to restrict subscribers we could add JWT validation before setting up the stream.

**What happens to the connection when the user closes the tab?**  
The server sees `req.on("close")` and calls the unsubscribe function, which removes this response’s write callback from the Set. We stop writing to that connection and avoid holding references to closed sockets.

**Could we scale this across multiple server instances?**  
Currently no: state is in-memory per process. To scale we’d use a shared pub/sub (e.g. Redis). On payment confirm we’d publish to a channel; each instance would subscribe and broadcast to its own SSE clients. The “last 20” history could live in Redis or the DB.

---

## Key takeaways

- Single endpoint: GET `/api/events/recent-purchases`; long-lived response; no auth.
- Events are triggered only by payment confirm; payload: buyerName, country, productTitles, orderId, at.
- In-memory: last 50 events + Set of write callbacks; new clients get last 20 then live stream.
- Cleanup on disconnect: req.on("close") → unsubscribe to avoid leaks and write errors.
- For deep dive (SSE format, headers, scaling, testing): use [SSE-and-recent-purchases-interview-guide.md](SSE-and-recent-purchases-interview-guide.md).
