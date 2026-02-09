# Interview Prep: Addresses

**Feature:** User addresses (billing / shipping)  
**Base path:** `/api/addresses`

---

## APIs

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/addresses` | Yes | List my addresses (default first) |
| GET | `/api/addresses/:id` | Yes | Get one address by ID (must belong to me) |
| POST | `/api/addresses` | Yes | Create address (optional isDefault) |
| PATCH | `/api/addresses/:id` | Yes | Update address (all fields optional) |
| PUT | `/api/addresses/:id` | Yes | Same as PATCH |
| DELETE | `/api/addresses/:id` | Yes | Delete address |
| POST | `/api/addresses/:id/set-default` | Yes | Set this address as default |

---

## Implementation

**Key files:**

- **Routes:** `src/routes/address.routes.js` — all routes use `router.use(authenticateJWT)`. Params validated with addressIdParamSchema (24-char hex); body with createAddressSchema or updateAddressSchema.
- **Controller:** `src/controllers/address.controller.js` — every handler passes `req.user.id` so only the current user’s addresses are read/updated/deleted. getAddress/getAddressById return 404 if address not found or not owned.
- **Service:** `src/services/address.service.js` — getAddressesByUserId: find by user, sort by isDefault desc then createdAt desc so default appears first. getAddressById: findOne by _id and user so users can’t read others’ addresses. createAddress: if data.isDefault, updateMany for that user to set isDefault false, then create. updateAddress: findOne by id and user; if data.isDefault true, clear other defaults then assign and save. setDefaultAddress: find by id and user, updateMany to clear other defaults, set this one isDefault true and save. deleteAddress: findOneAndDelete by id and user.
- **Validators:** `src/validators/address.schema.js` — createAddressSchema: line1, city, state, pincode required; label, line2, country, phone, isDefault optional. updateAddressSchema: all optional. addressIdParamSchema: id must match 24-char hex (MongoDB ObjectId).

**Flow:** All operations are scoped to the authenticated user. Only one address per user can be default; setting a new default unsets the previous one. Orders can reference an addressId for billing; the address document is not embedded so historical orders may reference deleted addresses (application choice).

---

## Interview Q&A

**How do we ensure a user only sees their own addresses?**  
Every service method that takes an address id also takes the userId. We use findOne({ _id: addressId, user: userId }) or find({ user: userId }). The controller always passes req.user.id from the JWT.

**How is “default” enforced?**  
When creating or updating with isDefault: true, we first set isDefault: false on all other addresses for that user (updateMany), then set or save the current one as default. setDefaultAddress does the same: clear others, then set this address’s isDefault to true.

**Why support both PATCH and PUT for update?**  
Some clients or APIs expect PUT for full replacement. We treat both the same (partial update via updateAddressSchema, all fields optional) so either method works.

**What’s in the address document?**  
Typical fields: user (ref), label, line1, line2, city, state, pincode, country (default e.g. India), phone, isDefault. Used as billing address at checkout when user passes addressId to POST /orders.

---

## Key takeaways

- All address routes require authentication; ownership enforced by passing req.user.id in service.
- List sorted with default first (isDefault: -1, createdAt: -1).
- Only one default per user: setting isDefault true clears other addresses’ isDefault.
- Params validated with addressIdParamSchema (valid ObjectId) to avoid invalid IDs.
- Addresses are referenced by id in orders (billingAddress can be populated or snapshot at order creation).
