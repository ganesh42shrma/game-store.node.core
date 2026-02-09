# SSE & Recent-Purchase Events – Logic and Interview Guide

This document explains how the **"Someone from X just purchased Y"** feature works and prepares you to answer backend/Node/Express interview questions about **Server-Sent Events (SSE)** and this implementation.

---

## Part 1: What is SSE?

### Definition

**Server-Sent Events (SSE)** is a standard (part of the HTML5 spec) that lets the **server push data to the client over a single, long-lived HTTP connection**. The client opens the connection; the server keeps it open and sends events (text chunks) whenever it has new data. It is **one-way: server → client only**.

- **Protocol:** Plain HTTP (GET request). No separate protocol like WebSockets.
- **Direction:** Server pushes; client only receives (no client→server messages over the same channel).
- **Format:** Text-based. Each message is one or more lines; a line starting with `data:` carries the payload. Messages are separated by a blank line (`\n\n`).
- **Browser API:** `EventSource(url)`. The browser handles the connection, reconnection, and parsing.

### SSE vs other approaches

| Approach | Who initiates | Direction | Use case |
|----------|----------------|-----------|----------|
| **Polling** | Client repeatedly sends GET | Client → Server (request); Server → Client (response) | "Any new data?" every N seconds. Simple but wasteful. |
| **Long polling** | Client sends GET; server holds until data or timeout | Same, but server holds the response until there is data | Reduces empty polls; still request-driven. |
| **SSE** | Client opens one GET; server keeps connection open and pushes | **Server → Client only** (over one connection) | Live feeds, notifications, dashboards. One-way is enough. |
| **WebSockets** | Client opens WS handshake; then full duplex | **Bidirectional** | Chat, collaborative editing, games. Need two-way. |
| **Webhooks** | Your server **calls an external URL** (e.g. POST) when something happens | Your server → External system | Integrations (Slack, CRM). Not for browser UI. |

**When to use SSE in an interview:**  
"When we need the server to push updates to the browser in real time, and we don't need the client to send messages back over the same channel, SSE is a good fit. It's simpler than WebSockets and works over plain HTTP, so it's easier to deploy and debug. Our recent-purchase toasts are a perfect fit: we only need to push 'someone just bought X' to all open tabs."

---

## Part 2: How our recent-purchase feature works (logic)

### High-level flow

1. **User A** completes payment → `POST /api/payments/:id/confirm` is called.
2. **Backend** marks payment as captured, order as paid, creates invoice.
3. **Backend** loads the order (with user name and billing address), builds a small payload (buyer first name, country, product titles).
4. **Backend** calls `recentPurchaseEvents.addRecentPurchase(payload)`.
5. **Event service** (a) appends the event to an in-memory list (last 50), (b) formats it as an SSE line (`data: {...}\n\n`), (c) **writes that line to every registered subscriber** (each subscriber is the `res.write` of an open SSE connection).
6. **Every browser** that has an open connection to `GET /api/events/recent-purchases` receives the new event and can show a toast: "Alex from India purchased Elden Ring."

So: **one payment confirm → one event → broadcast to all connected clients**. No polling; no webhook.

### Component-by-component logic

#### 1. Trigger: payment confirmation

**File:** `src/services/payment.service.js` – `confirmPayment()`

- After updating the order (paid, completed) and creating the invoice, we fetch the order again with `user` populated (for name).
- We derive:
  - **buyerName:** first word of `user.name` (e.g. "Alex Johnson" → "Alex"), or "Someone" if missing.
  - **country:** `billingAddress.country` or "Unknown".
  - **productTitles:** `order.items[].title`.
- We call `recentPurchaseEvents.addRecentPurchase({ buyerName, country, productTitles, orderId })`. We do **not** pass full PII; only first name and country for the toast.

**Interview tip:** "The event is emitted from the payment service right after we've confirmed the payment and created the invoice, so we're sure the purchase is real. We only expose minimal, non-sensitive data: first name and country for the toast."

#### 2. Event store and broadcast

**File:** `src/services/recentPurchaseEvents.js`

- **In-memory state:**
  - `recentPurchases`: array of the last 50 events (each has `buyerName`, `country`, `productTitles`, `orderId`, `at`).
  - `subscribers`: a `Set` of **write functions**. Each function is effectively `(line) => res.write(line)` for one SSE response object.

- **addRecentPurchase(payload):**
  1. Add `at` (ISO timestamp).
  2. Push to `recentPurchases`; if length > 50, shift the oldest out.
  3. Format one SSE message: `data: ${JSON.stringify(event)}\n\n`.
  4. Call every function in `subscribers` with this line (so each open HTTP response gets the new event). If a write throws (e.g. client disconnected), we remove that subscriber.

- **getRecentPurchases(limit):**  
  Returns the last `limit` events (e.g. 20). Used when a **new** client connects, so they see recent history immediately instead of waiting for the next purchase.

- **subscribe(write):**  
  Adds `write` to `subscribers` and returns an unsubscribe function that removes it. When the client closes the connection, we call unsubscribe so we stop writing to that response.

**Interview tip:** "We keep a bounded in-memory list for the last 50 events so new connections get context. We keep a set of write callbacks—one per open SSE connection—and when a new purchase happens we iterate and write the same line to each. That's our broadcast. If a write fails we remove that subscriber so we don't leak or throw on dead connections."

#### 3. SSE endpoint (controller)

**File:** `src/controllers/events.controller.js` – `streamRecentPurchases(req, res)`

1. **Set SSE headers:**
   - `Content-Type: text/event-stream` – browser treats it as an event stream.
   - `Cache-Control: no-cache, no-transform` – no caching of the stream.
   - `Connection: keep-alive` – keep the connection open.
   - `X-Accel-Buffering: no` – disables buffering in nginx so events flush immediately (optional but useful behind proxies).

2. **Flush headers** so the client gets the 200 and knows the connection is open.

3. **Send recent history:**  
   Get last 20 events from `getRecentPurchases(20)` and for each write `data: ${JSON.stringify(event)}\n\n` to `res`. Then flush so the client sees them right away.

4. **Subscribe for future events:**  
   Call `recentPurchaseEvents.subscribe((line) => { res.write(line); res.flush?.(); })`. From now on, every new purchase will trigger this callback and we write the same line to this response.

5. **Cleanup on disconnect:**  
   `req.on("close", () => unsubscribe())`. When the client closes the tab or the connection drops, we unsubscribe so we stop writing to this response and the Set doesn't keep a dead reference.

**Interview tip:** "We set the standard SSE headers, send the last 20 events so new joiners see something, then register this response's write function with our event service. Every new purchase the service calls all registered writes with the same formatted line. On request close we unsubscribe so we don't leak memory or try to write to a closed socket."

#### 4. Route

**File:** `src/routes/events.routes.js`  
- `GET /recent-purchases` → `streamRecentPurchases`.  
Mounted under `/api/events`, so full path is `GET /api/events/recent-purchases`. No auth (public livestream).

---

## Part 3: SSE format and headers (for interviews)

### Response headers

| Header | Value | Why |
|--------|--------|-----|
| `Content-Type` | `text/event-stream` | Tells client this is SSE; browser uses EventSource API semantics. |
| `Cache-Control` | `no-cache, no-transform` | Don't cache the stream; don't transform (e.g. gzip can buffer). |
| `Connection` | `keep-alive` | Keep the TCP connection open. |
| `X-Accel-Buffering` | `no` | If behind nginx: don't buffer; flush each event (optional). |

### Message format

- Each event is one or more lines. Our implementation uses a single line per event:
  - `data: <JSON>\n\n`
- The `data:` prefix is required for SSE. The rest is payload (we use JSON).
- Two newlines (`\n\n`) mark the end of one event. The client's `EventSource` fires one `message` per event and puts the content after `data:` in `event.data`.

### Client side (for completeness)

```js
const es = new EventSource("https://api.example.com/api/events/recent-purchases");
es.onmessage = (e) => {
  const { buyerName, country, productTitles } = JSON.parse(e.data);
  showToast(`${buyerName} from ${country} purchased ${productTitles.join(", ")}`);
};
es.onerror = () => { /* EventSource auto-reconnects by default */ };
```

The browser automatically reconnects if the connection drops (with exponential backoff). No custom reconnection logic needed for basic use.

---

## Part 4: Interview Q&A

### What is Server-Sent Events (SSE)?

"SSE is a standard that lets the server push data to the client over a single long-lived HTTP connection. The client opens a GET request; the server keeps the connection open and sends events as text, using a simple format: lines starting with `data:` and separated by blank lines. It's one-way, server to client, and works with the browser's `EventSource` API. It's useful for live notifications, feeds, or dashboards where the client doesn't need to send data back on the same channel."

### Why did you use SSE instead of WebSockets for this feature?

"For the recent-purchase toasts we only need the server to push updates to the browser. We don't need the client to send messages back over the same connection. SSE is one-way and simpler: it's plain HTTP, so it works with existing infra, doesn't need a separate WebSocket server, and is easier to debug. The browser's EventSource also handles reconnection. WebSockets would be overkill here and add complexity we don't need."

### How do you broadcast to all connected clients?

"We keep a Set of write callbacks in memory—one per open SSE response. When a new purchase happens we format one SSE line and call every callback with that line. Each callback is essentially `res.write(line)` for that client's response. So one event triggers one write per connected client. When a client disconnects we listen for `req.on('close')` and remove that callback from the Set so we don't leak or write to a closed socket."

### Where is the event emitted and what data do you send?

"The event is emitted in the payment service, right after we confirm the payment and create the invoice. We load the order with the user populated, then build a small payload: buyer's first name, billing country, list of product titles, and order ID. We don't send full name, email, or address—only what's needed for the toast and in a non-sensitive way."

### What happens when a new client connects to the SSE endpoint?

"We send the last 20 recent purchases immediately, then subscribe that connection for future events. So new joiners see recent activity right away instead of waiting for the next purchase. The last N events are kept in an in-memory array (we cap at 50) and we slice the last 20 for the initial send."

### How is the SSE response kept open? Why doesn't the request "finish"?

"In Express we never call `res.end()` for the SSE route. We set headers, optionally send initial events, then only call `res.write()` when new events occur. The response stays in a 'pending' state with an open TCP connection. It only ends when the client disconnects or the server closes the connection. That's the standard pattern for SSE and streaming responses."

### What about scaling / multiple server instances?

"Our current implementation uses in-memory state: one array and one Set per process. So if you run multiple Node instances behind a load balancer, each instance has its own subscribers and its own recent-purchases list. A purchase that hits instance A will only be broadcast to clients connected to A, not to those on B. To scale properly we'd need a shared pub/sub layer—e.g. Redis pub/sub or a message queue. When a purchase happens we'd publish to a channel; every instance would subscribe and broadcast to its own connected clients. The recent-purchases list could also be stored in Redis or in the DB if we want it shared and durable."

### Is the SSE endpoint authenticated?

"No. We kept it public so any visitor can see the live 'someone just purchased' toasts. The payload only has first name, country, and product titles—no emails or IDs that would identify a specific user. If we needed to restrict who can subscribe we could require a JWT and validate it before setting up the stream, but for this use case we didn't."

### What's the difference between this and a webhook?

"Here we're pushing to **browsers** that have an open connection to our API. A webhook is when **our server** sends an HTTP request (e.g. POST) to **another server's URL** when something happens—for example to Slack or a CRM. So SSE is server→browser for real-time UI; webhooks are server→external system for integrations. Different direction and different consumer."

### How would you test this in an interview or in code?

"Unit-test the event service: call `addRecentPurchase` and assert the event is in `getRecentPurchases` and that a subscribed callback is invoked with the right line. Integration-test the flow: mock or trigger payment confirmation, then either assert the SSE endpoint receives the event (e.g. by having a test client open EventSource and collect messages) or assert that `addRecentPurchase` was called with the expected payload. For load testing we could open many SSE connections and trigger one purchase and assert all connections receive one event."

---

## Part 5: One-paragraph summary for interviews

"We have a 'someone just purchased' toast on the storefront. When a payment is confirmed we emit a small event—first name, country, product titles—into an in-memory service that keeps the last 50 events and a set of write callbacks, one per open SSE connection. The SSE endpoint sets the right headers, sends the last 20 events to new clients, then registers that response's write function with the service. Every new purchase the service writes the same formatted line to every registered callback, so all open browsers get the event in real time. We use SSE rather than WebSockets because we only need server-to-client push, and SSE is simpler and works over plain HTTP. For multiple server instances we'd add Redis pub/sub so every instance can broadcast to its own clients."

---

## Quick reference: files involved

| File | Role |
|------|------|
| `src/services/payment.service.js` | After `confirmPayment`, builds payload and calls `recentPurchaseEvents.addRecentPurchase`. |
| `src/services/recentPurchaseEvents.js` | In-memory store (last 50), Set of write callbacks, `addRecentPurchase`, `getRecentPurchases`, `subscribe`. |
| `src/controllers/events.controller.js` | Sets SSE headers, sends last 20 events, subscribes `res.write`, unsubscribes on `req.on("close")`. |
| `src/routes/events.routes.js` | `GET /recent-purchases` → `streamRecentPurchases`. |
| `src/routes/index.js` | Mounts events routes at `/api/events`. |
