# Product Alerts Agent – Design & Implementation

This document describes the **product alerts / reminder agent** that runs in the background and notifies users when:
- A game goes on sale
- A game's price drops to or below a target
- A game is back in stock (available)

---

## Architecture Overview

### 1. **Connection Choice: SSE vs WebSocket vs WebRTC**

| Option | Use Case | Our Choice |
|--------|----------|------------|
| **SSE** | Server→client push, one-way | ✅ **Yes** – for real-time when user is online |
| **WebSocket** | Bidirectional, full duplex | Not needed – we only push to client |
| **WebRTC** | P2P video/audio | Overkill for notifications |

**Delivery strategy (hybrid):**

1. **Email** – Always works, even when user is offline. Uses SendGrid.
2. **In-app notifications** – Stored in DB; user fetches via REST when they return.
3. **SSE** – Optional real-time push when user has an open connection to `GET /api/events/my-alerts` (auth required).

---

## Components

### Models

- **UserProductAlert** – User preferences: `{ user, product, triggerType, priceThreshold?, isActive }`
  - `triggerType`: `on_sale` | `available` | `price_drop` | `price_below`
- **UserNotification** – In-app notification record: `{ user, type, product, title, message, meta, read }`

### Services

- **productAlert.service** – Create/list/deactivate alerts; match logic for cron.
- **userNotification.service** – Create notification, send email, push to SSE.
- **userNotificationEvents** – Per-user SSE subscribers (in-memory; Redis for scaling).
- **alertCron.service** – Runs periodically; checks products against alerts; fires notifications.

### Cron Script

```bash
node src/scripts/run-product-alerts.js
```

Schedule with cron (e.g. every 15 minutes):

```cron
*/15 * * * * cd /path/to/project && node src/scripts/run-product-alerts.js
```

Or via npm:

```bash
npm run alerts:run
```

---

## APIs

### REST

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/alerts` | Yes | List user's alerts |
| POST | `/api/alerts` | Yes | Create alert `{ productId, triggerType, priceThreshold? }` |
| DELETE | `/api/alerts/:id` | Yes | Deactivate alert |
| GET | `/api/notifications` | Yes | List notifications (`?limit=20&unreadOnly=true`) |
| PATCH | `/api/notifications/read` | Yes | Mark as read `{ notificationIds: string[] }` |
| PATCH | `/api/notifications/read-all` | Yes | Mark all as read |

### SSE

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/events/my-alerts` | Yes (Bearer) | Stream of product alerts for this user |

Client example:

```js
const es = new EventSource("https://api.example.com/api/events/my-alerts", {
  withCredentials: true,
});
// Note: EventSource doesn't support custom headers. Use fetch + ReadableStream or a library that supports Authorization header.
```

For bearer auth with SSE, the client typically uses a query param (`?token=...`) or a library that supports headers. Alternatively, use a cookie-based auth for SSE.

---

## Chat Integration

The **games-qa agent** has two new tools:

- **create_alert** – When user says "notify me when X is on sale", "tell me when price drops below ₹30", "tell me when available".
- **list_alerts** – Show user's active alerts.

The agent automatically calls these when the user's intent is clear.

---

## Add to Cart and Buy Tools

The **games-qa agent** can add games to cart and complete purchases when the user says e.g. "Add Elden Ring to cart" or "Buy this game". It always clarifies and confirms before executing.

### Helper tools (read-only)

| Tool | Purpose |
|------|---------|
| **get_user_addresses** | List user's addresses (id, label, city, state). If empty, agent tells user to add address first. |
| **get_user_cart** | List cart items (titles, quantities, prices). Used to ask: buy only this game or checkout entire cart? |
| **get_payment_options** | Returns: mock_card, mock_upi, mock_netbanking. Agent asks user which to use. |

### Action tools (require agent confirmation)

| Tool | Params | Behavior |
|------|--------|----------|
| **add_to_cart** | user_id, product_id, quantity | Adds product to cart. Agent confirms first: "I'll add [Game] to your cart. Confirm?" |
| **buy_for_me** | user_id, product_id, address_id, payment_method, quantity, checkout_scope | If `single`: create order for product only. If `full_cart`: add to cart, checkout entire cart. Creates payment and confirms. Agent must get address_id, payment_method, checkout_scope from user first. |

### Flow (add to cart)

1. User: "Add Elden Ring to cart"
2. Agent: "I'll add Elden Ring to your cart. Confirm?"
3. User: "Yes"
4. Agent calls `add_to_cart` → success

### Flow (buy)

1. User: "Buy Elden Ring"
2. Agent calls `get_user_addresses`. If empty → "Please add an address first (Profile > Addresses)." Stop.
3. Agent calls `get_payment_options`. Asks: "Which address? (1, 2, ...) Which payment: Card, UPI, or Net Banking?"
4. Agent asks: "Buy only Elden Ring, or add to cart and checkout everything?"
5. Agent: "I'll purchase Elden Ring for ₹X using [address] and [payment]. Confirm?"
6. User: "Yes"
7. Agent calls `buy_for_me` with address_id, payment_method, checkout_scope

### Edge cases

| Edge case | Handling |
|-----------|----------|
| No addresses | `get_user_addresses` returns []; agent tells user to add address; never call `buy_for_me` |
| Product out of stock | Tool returns error before add/order |
| Product not found/inactive | Tool returns error |
| Invalid address_id | `buy_for_me` returns ADDRESS_NOT_FOUND |
| User says "no" to confirmation | Agent does not call the tool |
| checkout_scope full_cart, cart empty | Add product first, then `createOrderFromCart` |

---

## Flow

1. **User** says in chat: "Tell me when Elden Ring drops below 2000" or "Notify me when this game is on sale".
2. **Agent** uses `create_alert` with `product_id`, `trigger_type`, `price_threshold` (for price-based).
3. **Cron** runs every 15 min (or configured interval):
   - Loads all active alerts grouped by product
   - For each product, checks: `isOnSale`, `stock > 0`, `price <= threshold`
   - On match: create notification, send email, push to SSE (if user connected)
   - Update `lastNotifiedAt` on alert (24h cooldown)
4. **User** receives:
   - Email (always)
   - In-app notification (fetched via GET `/api/notifications`)
   - Real-time SSE event (if connected to `/api/events/my-alerts`)

---

## Frontend Usage

### 1. Create an alert (REST)

When the user clicks "Notify me when on sale" or "Alert when price drops below ₹X" on a product page:

```ts
const API_BASE = "https://your-api.com/api"; // or import from config

async function createAlert(productId: string, triggerType: "on_sale" | "available" | "price_drop" | "price_below", priceThreshold?: number) {
  const res = await fetch(`${API_BASE}/alerts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      productId,
      triggerType,
      ...(priceThreshold != null && { priceThreshold }),
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Examples:
createAlert("698c2768a7dee4fffd793738", "on_sale");
createAlert("698c2768a7dee4fffd793738", "price_below", 2000);
createAlert("698c2768a7dee4fffd793738", "available");
```

### 2. Create an alert via Chat

User types in chat: "Notify me when Elden Ring goes on sale" or "Tell me when this game drops below 2000". The agent creates the alert automatically. No extra frontend call needed – just use your existing chat flow.

### 3. List alerts

Show user's active alerts (e.g. in a "My Alerts" page or product card):

```ts
async function listAlerts() {
  const res = await fetch(`${API_BASE}/alerts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const { data } = await res.json();
  return data.alerts;
}
```

### 4. Delete an alert

```ts
async function deleteAlert(alertId: string) {
  const res = await fetch(`${API_BASE}/alerts/${alertId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### 5. Fetch notifications

Load notifications for a bell icon or inbox:

```ts
async function getNotifications(options?: { limit?: number; unreadOnly?: boolean }) {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.unreadOnly) params.set("unreadOnly", "true");
  const url = `${API_BASE}/notifications${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const { data } = await res.json();
  return data.notifications;
}
```

### 6. Mark notifications as read

```ts
async function markAsRead(notificationIds: string | string[]) {
  const res = await fetch(`${API_BASE}/notifications/read`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      notificationIds: Array.isArray(notificationIds) ? notificationIds : [notificationIds],
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function markAllAsRead() {
  const res = await fetch(`${API_BASE}/notifications/read-all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### 7. Real-time SSE (alerts stream)

`EventSource` does not support custom headers (e.g. `Authorization`). Use one of these approaches:

```ts
type NotificationPayload = {
  id: string;
  type: "price_drop" | "on_sale" | "available" | "price_below";
  productId: string;
  productTitle: string;
  title: string;
  message: string;
  meta?: { price?: number; discountedPrice?: number; isOnSale?: boolean; stock?: number };
  createdAt: string;
};
```

**Option A: fetch + ReadableStream** (works with Bearer token)

```ts
async function subscribeToAlerts(token: string, onNotification: (n: NotificationPayload) => void) {
  const res = await fetch(`${API_BASE}/events/my-alerts`, {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok || !res.body) throw new Error("Failed to connect");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const payload = JSON.parse(line.slice(6));
          onNotification(payload);
        } catch (e) {
          // ignore malformed
        }
      }
    }
  }
}

// Usage:
subscribeToAlerts(token, (notification) => {
  showToast(`${notification.title}: ${notification.message}`);
  // Optionally refresh notifications list or update unread count
});
```

**Option B: @microsoft/fetch-event-source** (convenient wrapper)

```bash
npm install @microsoft/fetch-event-source
```

```ts
import { fetchEventSource } from "@microsoft/fetch-event-source";

function subscribeToAlerts(token: string, onNotification: (n: NotificationPayload) => void) {
  const ctrl = new AbortController();
  fetchEventSource(`${API_BASE}/events/my-alerts`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: ctrl.signal,
    onmessage(ev) {
      try {
        const payload = JSON.parse(ev.data);
        onNotification(payload);
      } catch (e) {}
    },
    onerror(err) {
      console.error("SSE error", err);
      // fetchEventSource supports retry; you can throw to stop
    },
  });
  return () => ctrl.abort(); // call to unsubscribe
}
```

### 8. Suggested UI flow

| Location | Action |
|----------|--------|
| **Product page** | "Notify when on sale" / "Alert when below ₹X" buttons → `POST /api/alerts` |
| **Chat** | User says "notify me when X is on sale" → agent creates alert; no extra UI |
| **My Alerts page** | List alerts → `GET /api/alerts`; delete → `DELETE /api/alerts/:id` |
| **Navbar bell icon** | Fetch `GET /api/notifications?unreadOnly=true&limit=20`; show count; on click, list and mark as read |
| **App init (logged in)** | Call `subscribeToAlerts()` to receive real-time toasts; on new event, refresh notifications and unread count |

---

## Scaling

- **SSE**: In-memory per process. For multiple instances, use Redis pub/sub: publish to `user:{userId}:notifications`; each instance subscribes and pushes to its local SSE clients.
- **Cron**: Run on a single scheduler (cron, AWS EventBridge, Vercel Cron) to avoid duplicate runs.

---

## Future: Scheduled Orders

For "schedule order when price drops" or "buy when available":

- Add `scheduledOrder` flag to `UserProductAlert` with optional `maxAmount`, `quantity`.
- When alert fires and `scheduledOrder` is true, create a draft order and optionally auto-checkout (with user consent and stored payment method).
- This requires payment method storage and consent flows; not implemented in the current scope.
