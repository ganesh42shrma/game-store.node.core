# Interview Prep: Orders

**Feature:** Checkout (create order from cart) and order history  
**Base path:** `/api/orders`

All order endpoints require **authentication**. Design (cart vs order, snapshot): see [orders-carts-design.md](orders-carts-design.md).

---

## APIs

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/orders` | Yes | Create order from cart (optional body: addressId); cart cleared on success |
| GET | `/api/orders` | Yes | List my orders (paginated; optional status, sort); response includes meta (total, page, limit, totalPages) |
| GET | `/api/orders/:id` | Yes | Get order by ID (only if mine) |
| GET | `/api/orders/:id/invoice` | Yes | Get invoice for this order (only if mine and order is paid) |

---

## Implementation

**Key files:**

- **Routes:** `src/routes/order.routes.js` — authenticateJWT on all; createOrderSchema (optional addressId); orderIdParamSchema for :id and :id/invoice. Invoice by order id is handled by invoiceController.getInvoiceByOrderId.
- **Controller:** `src/controllers/order.controller.js` — createOrder: call orderService.createOrderFromCart(userId, addressId); map result codes EMPTY_CART, ADDRESS_NOT_FOUND, NO_VALID_ITEMS to 400 with message; success return 201 with order. getOrders: getOrdersByUserId with query, return data + meta (total, page, limit, totalPages). getOrder: getOrderById(id, userId), 404 if not found.
- **Service:** `src/services/order.service.js` — createOrderFromCart: load cart with items.product populated. If empty return EMPTY_CART. If addressId given, load address by id and userId; if not found return ADDRESS_NOT_FOUND. Build order items from cart: skip inactive products; price = discountedPrice when isOnSale else price; snapshot product id, title, quantity, price. If no valid items return NO_VALID_ITEMS. Compute subTotal, gstAmount (GST_RATE 18%), totalAmount. Create Order with user, items, billingAddress (snapshot from address if provided), subTotal, gstRate, gstAmount, totalAmount, status pending, paymentStatus unpaid. Clear cart (items = []) and save. Return populated order. getOrdersByUserId: filter by user, optional status, sort (default -createdAt), paginate; populate items.product; return orders and total. getOrderById: findOne by _id and user, populate items.product.
- **Model:** `src/models/order.model.js` — user (ref), items (array of { product, title, quantity, price }), billingAddress (embedded), subTotal, gstRate, gstAmount, totalAmount, status (pending/completed/cancelled), paymentStatus (unpaid/paid/…), paidAt, payment (ref). Order items are a snapshot; price is what was charged.
- **Validators:** `src/validators/order.schema.js` — createOrderSchema: optional addressId (ObjectId). orderIdParamSchema: id (ObjectId).

**Flow:** Checkout is “create order from cart”. Only active products with current price (or discountedPrice when on sale) are included. Billing address is optional; if provided it must belong to the user and is copied into the order. After order creation the cart is cleared. Payment and invoice are separate: payment confirm sets order paymentStatus and status, and creates the invoice.

---

## Interview Q&A

**Why snapshot items in the order instead of keeping product refs only?**  
We store title, quantity, and price per line so that if the product is later edited or deleted, the order still shows what was bought and at what price. The order is a legal record of the transaction; price comes from the cart at checkout time (with sale price if applicable).

**What happens to the cart after checkout?**  
We set cart.items = [] and save the cart. So one order per checkout; the cart is cleared so the user starts fresh. If payment fails they can add items again and create a new order.

**How is GST applied?**  
We use a fixed GST_RATE (18%). subTotal is the sum of (price × quantity) for all order lines. gstAmount = subTotal * (GST_RATE / 100), rounded. totalAmount = subTotal + gstAmount. All stored on the order.

**When is billing address set?**  
Optional at order creation. If the client sends addressId (one of the user’s addresses), we copy line1, line2, city, state, pincode, country, phone into the order’s billingAddress. If not sent, billingAddress can be undefined. Invoice and payment flows can still proceed.

**How do we ensure a user only sees their own orders?**  
All list/get use userId from req.user. getOrderById and getOrdersByUserId filter by user. getInvoiceByOrderId (invoice controller) will only return the invoice if the order belongs to the user and is paid.

---

## Key takeaways

- Order is created from the current cart; only active products included; price = discountedPrice when isOnSale else price.
- Order items are a snapshot (product ref + title, quantity, price); cart is cleared after order creation.
- Optional billing address: addressId must belong to user; stored as embedded snapshot on order.
- GST: 18% on subTotal; gstAmount and totalAmount stored.
- Order status (pending/completed/cancelled) and paymentStatus (unpaid/paid/…) updated on payment confirm; invoice created on payment confirm.
- List returns meta (total, page, limit, totalPages) for pagination UI.
