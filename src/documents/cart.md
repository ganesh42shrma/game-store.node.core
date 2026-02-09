# Interview Prep: Cart

**Feature:** Shopping cart (one per user)  
**Base path:** `/api/cart`

All cart endpoints require **authentication**.

---

## APIs

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/cart` | Yes | Get my cart (items with product details; empty if none) |
| POST | `/api/cart/items` | Yes | Add item (body: productId, quantity) or increase quantity |
| PATCH | `/api/cart/items/:productId` | Yes | Update quantity (body: quantity; 0 removes line) |
| DELETE | `/api/cart/items/:productId` | Yes | Remove item |
| DELETE | `/api/cart` | Yes | Clear cart |

Design details (cart vs order, snapshot vs live): see [orders-carts-design.md](orders-carts-design.md).

---

## Implementation

**Key files:**

- **Routes:** `src/routes/cart.routes.js` — `router.use(authenticateJWT)`; POST items and PATCH items use validate(addCartItemSchema) and validate(updateCartItemSchema) for body.
- **Controller:** `src/controllers/cart.controller.js` — all handlers use req.user.id. addItem and updateItem return 404 if product not found/inactive or cart/item not found; others return full cart (or empty) and 200.
- **Service:** `src/services/cart.service.js` — getCartByUserId: findOne by user, populate items.product with title, price, isOnSale, discountedPrice, platform, coverImage, isActive; filter out items whose product is inactive; return { _id, user, items } or { items: [], user } if no cart. addItem: ensure product exists and isActive; find or create cart for user; if product already in items, add to quantity else push { product, quantity }; clear lastAbandonmentEmailSentAt; save and return full cart. updateItemQuantity: quantity 0 removes the line; else set item.quantity; save and return full cart. removeItem/clearCart: filter items or set [], save, return full cart.
- **Model:** `src/models/cart.model.js` — user (ObjectId, ref User, unique), items array of { product (ObjectId ref Product), quantity (min 1) }, lastAbandonmentEmailSentAt (for abandonment emails). One cart per user (unique on user).
- **Validators:** `src/validators/cart.schema.js` — addCartItemSchema: productId (24-char hex), quantity int ≥ 1. updateCartItemSchema: quantity int ≥ 0.

**Flow:** Cart is created on first add. Price is not stored in cart; it’s read from the populated Product at GET time (so sale/discount reflects current product). Inactive products are excluded from the returned cart and cannot be added. Order creation reads cart, builds order from current product prices (and discountedPrice when isOnSale), then clears the cart.

---

## Interview Q&A

**Why one cart per user?**  
The Cart schema has `user` with `unique: true`, so each user has at most one cart document. We find or create that document on add; all operations are by req.user.id. This keeps checkout simple: “create order from my cart” then “clear my cart”.

**Where is price stored?**  
Price is not stored in the cart. Cart items only store product (ObjectId) and quantity. When we return the cart we populate product and include current price, isOnSale, discountedPrice from the Product model. At checkout the order is built from the current product state so we snapshot price (and title) into the order.

**What if a product becomes inactive after being added to the cart?**  
getCartByUserId filters out items where product is inactive. addItem rejects inactive products. So the user sees only active products in the cart; at checkout we validate “all items still valid” and can return an error if the cart has no valid products.

**What is lastAbandonmentEmailSentAt?**  
Used by cart-abandonment email logic (e.g. in scripts): we can avoid sending multiple emails for the same cart by tracking when we last sent one. It’s reset when the user updates the cart (add/update/remove/clear).

**Why return the full cart after add/update/remove/clear?**  
So the client can update its state in one round-trip without calling GET /cart again. Response shape is the same as GET /cart.

---

## Key takeaways

- One cart per user (unique user ref); cart created on first add.
- Cart stores only product ref and quantity; price comes from Product at read time and at checkout.
- Inactive products are excluded from cart response and cannot be added.
- Quantity 0 in PATCH removes the line; DELETE item and DELETE /cart also remove items.
- Checkout (POST /orders) creates order from cart then clears cart; see [interview-prep-orders.md](interview-prep-orders.md).
