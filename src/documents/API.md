# Game Store API Reference

Base URL: `http://localhost:5000` (or your server origin)

---

## Authentication (protected routes)

Send the JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## Common response shapes

### Success (typical)

```json
{
  "success": true,
  "data": { ... }
}
```

### Error (4xx / 5xx)

```json
{
  "success": false,
  "message": "Error description"
}
```

### Validation error (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Valid email is required." }
  ]
}
```

### Rate limit (429)

```json
{
  "success": false,
  "message": "Too many requests, please try again later."
}
```

Response headers for rate-limited routes include: `X-RateLimit-Limit`, `X-RateLimit-Remaining`.

---

## Pagination

List endpoints support pagination via query parameters. Use these in the frontend to implement page controls, "Load more", or infinite scroll.

### Query parameters

| Parameter | Type   | Default | Description                          |
|-----------|--------|---------|--------------------------------------|
| `page`    | number | 1       | Page number (1-based).                |
| `limit`   | number | 10      | Number of items per page.            |

### Endpoints that support pagination

| Endpoint                     | Pagination params | Meta in response |
|------------------------------|-------------------|------------------|
| `GET /api/products`          | `page`, `limit`   | No               |
| `GET /api/users`             | `page`, `limit`   | No               |
| `GET /api/orders`            | `page`, `limit`   | Yes              |
| `GET /api/admin/orders`      | `page`, `limit`   | Yes              |
| `GET /api/admin/invoices`    | `page`, `limit`   | Yes              |

- **Products and users:** Response is `{ "success": true, "data": [ ... ] }`. No `total` or `totalPages`. To build "Page 1 of N" you can request a single large page (e.g. `?limit=100`) to get a count, or treat "next" as available when `data.length === limit`.
- **Orders:** Response includes `meta`: `{ "total", "page", "limit", "totalPages" }` so you can render full pagination (e.g. "Page 1 of 5", next/prev disabled at boundaries).

### Example requests

```
GET /api/products?page=1&limit=10
GET /api/products?page=2&limit=10
GET /api/products?limit=30
GET /api/orders?page=1&limit=10
```

### Example response with meta (orders only)

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

### Frontend usage

- **Products / users:** Use `page` and `limit` in the URL. For "Next" button: if `data.length === limit`, there may be a next page; request `page + 1`. For "Previous": if `page > 1`, request `page - 1`. To show all items in one list, use a large `limit` (e.g. `limit=100`).
- **Orders:** Use `meta.total`, `meta.page`, `meta.limit`, and `meta.totalPages` to render page numbers and disable next/prev when `page === 1` or `page === totalPages`.

---

## Health

| Method | Path      | Auth | Description   |
|--------|-----------|------|---------------|
| GET    | `/health` | No   | Server health |

**Response (200)**

```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-02-06T12:00:00.000Z"
}
```

---

## Auth

Base path: `/api/auth`

### Register

| Method | Path        | Auth | Rate limit      |
|--------|-------------|------|-----------------|
| POST   | `/api/auth/register` | No   | 5 req/min per IP |

**Request body**

| Field    | Type   | Required | Rules                    |
|----------|--------|----------|--------------------------|
| email    | string | Yes      | Valid email              |
| password | string | Yes      | Min 6 characters         |
| name     | string | **Yes (mandatory)** | Non-empty; leading/trailing spaces trimmed |

**Example**

```json
{
  "email": "user@example.com",
  "password": "secret123",
  "name": "John Doe"
}
```

**Response (201)**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "<userId>",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "7d"
  }
}
```

**Error (409)** – Email already registered

```json
{
  "success": false,
  "message": "Email already registered"
}
```

---

### Login

| Method | Path        | Auth | Rate limit      |
|--------|-------------|------|-----------------|
| POST   | `/api/auth/login` | No   | 5 req/min per IP |

**Request body**

| Field    | Type   | Required | Rules         |
|----------|--------|----------|---------------|
| email    | string | Yes      | Valid email   |
| password | string | Yes      | Non-empty     |

**Example**

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Response (200)**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "<userId>",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "7d"
  }
}
```

**Error (401)** – Invalid credentials

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

## Products

Base path: `/api/products`

### List products

| Method | Path              | Auth | Description                    |
|--------|-------------------|------|--------------------------------|
| GET    | `/api/products`   | No   | Paginated, filterable list     |

**Query parameters**

| Param    | Type   | Description                                                                 |
|----------|--------|-----------------------------------------------------------------------------|
| page     | number | Page number (default: 1)                                                    |
| limit    | number | Items per page (default: 10)                                                |
| search   | string | Text search in title, description, shortDescription, genre, tags (case-insensitive) |
| q        | string | Same as `search` (alternative param name)                                   |
| platform | string | Filter: `PC` \| `PS5` \| `XBOX` \| `SWITCH`                                 |
| genre    | string | Filter by genre                                                             |
| tag      | string | Filter by single tag (products that have this tag)                          |
| tags     | string | Comma-separated tags; products that have any of these tags                  |
| minPrice | number | Min price                                                                   |
| maxPrice | number | Max price                                                                   |
| fields   | string | Comma-separated field list (e.g. `title,price`)                             |
| sort     | string | Sort (e.g. `price`, `-createdAt`)                                           |

**Examples:** `GET /api/products?search=action`, `GET /api/products?q=RPG&platform=PC`, `GET /api/products?tag=multiplayer`, `GET /api/products?search=game&minPrice=10&maxPrice=50`

**Response (200)**

```json
{
  "success": true,
  "data": [
    {
      "_id": "<productId>",
      "title": "GTA VI",
      "description": "Open-world action adventure set in a sprawling city...",
      "shortDescription": "Open-world action adventure",
      "tags": ["action", "open-world", "multiplayer"],
      "price": 4999,
      "platform": "PS5",
      "genre": "Action",
      "stock": 50,
      "rating": 0,
      "coverImage": null,
      "releaseDate": null,
      "youtubeLinks": [],
      "isActive": true,
      "isOnSale": false,
      "discountedPrice": null,
      "createdAt": "2026-02-04T12:09:35.058Z",
      "updatedAt": "2026-02-04T13:26:29.900Z"
    }
  ]
}
```

- **Sale:** When `isOnSale` is true and `discountedPrice` is set, show the discounted price as the selling price and the original `price` as strikethrough. Cart and checkout use the discounted price in that case.
- **Descriptions:** Use `shortDescription` on listing/card views; use `description` on the product details page.
- **Tags:** Array of strings (e.g. `["action", "multiplayer"]`) for filtering and recommendations (e.g. related by tags). Stored normalized (trimmed, lowercase). Max 20 tags, each max 50 characters.
- **youtubeLinks:** Array of 0–3 YouTube URLs (e.g. `https://www.youtube.com/watch?v=...`, `https://youtu.be/...`).

---

### List all tags

| Method | Path                 | Auth | Description                                           |
|--------|----------------------|------|-------------------------------------------------------|
| GET    | `/api/products/tags` | No   | All distinct tags across products (sorted alphabetically). |

Use this when creating or editing a product: call it to get existing tags for autocomplete/suggestions. The admin can pick from these or type a new tag; new tags are stored with the product and will appear in this list for future products.

**Response (200)**

```json
{
  "success": true,
  "data": ["action", "multiplayer", "open-world", "rpg", "singleplayer"]
}
```

---

### Get product by ID

| Method | Path                   | Auth |
|--------|------------------------|------|
| GET    | `/api/products/:id`    | No   |

**Response (200)**

```json
{
  "success": true,
  "data": {
    "_id": "<productId>",
    "title": "GTA VI",
    "description": "Open-world action adventure set in a sprawling city...",
    "shortDescription": "Open-world action adventure",
    "tags": ["action", "open-world", "multiplayer"],
    "price": 4999,
    "platform": "PS5",
    "genre": "Action",
    "stock": 50,
    "rating": 4.2,
    "reviewCount": 150,
    "positiveCount": 128,
    "reviewSummary": {
      "label": "Very Positive",
      "percentPositive": 85,
      "reviewCount": 150
    },
    "coverImage": null,
    "releaseDate": null,
    "isActive": true,
    "createdAt": "2026-02-04T12:09:35.058Z",
    "updatedAt": "2026-02-04T13:26:29.900Z"
  }
}
```

- **rating** – Average of all review ratings (1–5), updated when reviews are added/updated/deleted.
- **reviewCount** / **positiveCount** – Used to compute **reviewSummary**. A review is "positive" if rating ≥ 4.
- **reviewSummary** – Steam-style summary: **label** (e.g. "Very Positive", "Mixed", "No reviews yet"), **percentPositive** (null if no reviews), **reviewCount**. Labels: Overwhelmingly Positive (95%+), Very Positive (80–94%), Positive (65–79%), Mostly Positive (50–64%), Mixed (40–49%), Mostly Negative (25–39%), Negative (15–24%), Very Negative (5–14%), Overwhelmingly Negative (0–4%). Shown only when there are ≥ 5 reviews; otherwise "No reviews yet" or "Need more reviews".

**Error (404)**

```json
{
  "success": false,
  "message": "Product not found"
}
```

---

### Related products (similar games)

| Method | Path                        | Auth | Description                                      |
|--------|-----------------------------|------|--------------------------------------------------|
| GET    | `/api/products/:id/related` | No   | Products that share at least one tag, ranked by most tags in common. |

Use this on the product details page to show a "Similar games" or "You might also like" section.

**Query parameters**

| Param  | Type   | Default | Description                    |
|--------|--------|---------|--------------------------------|
| limit  | number | 6       | Max number of related products (1–20). |

**Response (200)** – array of product objects (same shape as list/detail; excludes the current product). Sorted by number of matching tags (descending), then by `_id`. Returns an empty array if the product has no tags or no other products share any tag.

```json
{
  "success": true,
  "data": [
    {
      "_id": "<otherProductId>",
      "title": "Other Game",
      "shortDescription": "...",
      "tags": ["action", "open-world"],
      "price": 49.99,
      "platform": "PC",
      "genre": "Action",
      "coverImage": "...",
      ...
    }
  ]
}
```

**Error (404)** – Product not found (same as Get product by ID).

---

### Reviews

Base path: `/api/products/:id/reviews` (replace `:id` with the product ID).

#### List reviews for a product

| Method | Path                        | Auth | Description                    |
|--------|-----------------------------|------|--------------------------------|
| GET    | `/api/products/:id/reviews` | No   | Paginated list of reviews with Steam-style summary. |

**Query parameters**

| Param  | Type   | Default     | Description              |
|--------|--------|-------------|--------------------------|
| page   | number | 1           | Page number.             |
| limit  | number | 10          | Items per page (max 50). |
| sort   | string | `-createdAt`| `createdAt` (oldest first) or `-createdAt` (newest first). |

**Response (200)**

```json
{
  "success": true,
  "data": {
    "summary": {
      "label": "Very Positive",
      "percentPositive": 85,
      "reviewCount": 150
    },
    "reviews": [
      {
        "_id": "<reviewId>",
        "user": { "_id": "<userId>", "name": "John", "profilePicture": null },
        "product": "<productId>",
        "rating": 5,
        "comment": "Great game!",
        "createdAt": "2026-02-06T10:00:00.000Z",
        "updatedAt": "2026-02-06T10:00:00.000Z"
      }
    ],
    "meta": { "total": 150, "page": 1, "limit": 10, "totalPages": 15 }
  }
}
```

**Error (404)** – Product not found.

---

#### Create or update my review

| Method | Path                        | Auth | Description                                      |
|--------|-----------------------------|------|--------------------------------------------------|
| POST   | `/api/products/:id/reviews` | Yes  | One review per user per product; upserts (create or replace). |

**Request body**

| Field   | Type   | Required | Rules                    |
|---------|--------|----------|--------------------------|
| rating  | number | Yes      | Integer 1–5              |
| comment | string | No       | Max 2000 characters      |

**Response (200)** – The saved review (with populated `user`: name, profilePicture).

**Error (404)** – Product not found.

---

#### Get my review for this product

| Method | Path                             | Auth | Description                    |
|--------|----------------------------------|------|--------------------------------|
| GET    | `/api/products/:id/reviews/me`  | Yes  | Returns the authenticated user's review or `null`. |

**Response (200)** – `{ "success": true, "data": <review or null> }`

**Error (404)** – Product not found.

---

#### Delete my review

| Method | Path                        | Auth | Description                    |
|--------|-----------------------------|------|--------------------------------|
| DELETE | `/api/products/:id/reviews` | Yes  | Deletes the authenticated user's review for this product. |

**Response (200)** – `{ "success": true, "message": "Review deleted" }`

**Error (404)** – Review not found (user has not reviewed this product).

---

### Create product

| Method | Path              | Auth | Roles        |
|--------|-------------------|------|--------------|
| POST   | `/api/products`   | Yes  | admin, manager |

**Request body**

| Field             | Type     | Required | Rules                          |
|-------------------|----------|----------|--------------------------------|
| title             | string   | Yes      | Non-empty                      |
| description       | string   | Yes      | Non-empty (full text for details page) |
| shortDescription  | string   | No       | Max 300 chars; for listing/card preview |
| price             | number   | Yes      | > 0 (actual/original price)              |
| isOnSale          | boolean  | No       | Default `false`; set `true` to show as on sale |
| discountedPrice   | number   | No       | Must be &lt; price when set; used as selling price when `isOnSale` is true |
| platform          | string   | Yes      | `PC` \| `PS5` \| `XBOX` \| `SWITCH` |
| genre             | string   | Yes      | Non-empty                      |
| stock             | number   | No       | Int ≥ 0                        |
| youtubeLinks      | string[] | No       | 0–3 YouTube URLs               |
| tags              | string[] | No       | For recommendations; e.g. `["action", "multiplayer"]`. Max 20, each max 50 chars; stored normalized (lowercase). |

**Example**

```json
{
  "title": "Test Game",
  "description": "A game",
  "shortDescription": "A short preview for listings",
  "price": 19.99,
  "platform": "PC",
  "genre": "RPG",
  "stock": 10,
  "youtubeLinks": ["https://www.youtube.com/watch?v=xxx", "https://youtu.be/yyy"],
  "tags": ["rpg", "singleplayer"]
}
```

**Response (201)**

```json
{
  "success": true,
  "data": {
    "_id": "<productId>",
    "title": "Test Game",
    "description": "A game",
    "shortDescription": "A short preview for listings",
    "tags": ["rpg", "singleplayer"],
    "price": 19.99,
    "platform": "PC",
    "genre": "RPG",
    "stock": 10,
    "rating": 0,
    "isActive": true,
    "isOnSale": false,
    "discountedPrice": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Sale behaviour:** `price` is always the actual/original price. When `isOnSale` is true and `discountedPrice` is set, the API returns both; cart and checkout use `discountedPrice` as the selling price. When updating, set `discountedPrice` to `null` to clear the discount; it must be less than `price` when present.

---

### Update product

| Method | Path                   | Auth | Roles        |
|--------|------------------------|------|--------------|
| PATCH  | `/api/products/:id`   | Yes  | admin, manager |

**Request body** – all fields optional

| Field             | Type     | Rules                                                                 |
|-------------------|----------|-----------------------------------------------------------------------|
| title             | string   | Non-empty                                                             |
| description       | string   | Non-empty                                                             |
| shortDescription  | string   | Max 300 chars (omit to leave unchanged)                               |
| price             | number   | > 0 (actual price)                                                    |
| isOnSale          | boolean  | Set/unset sale flag (e.g. for frontend toggle)                        |
| discountedPrice  | number   | Must be &lt; price; use `null` to clear. When set with `isOnSale: true`, cart/checkout use this as selling price. |
| platform          | string   | `PC` \| `PS5` \| `XBOX` \| `SWITCH`                                  |
| genre             | string   | Non-empty                                                             |
| stock             | number   | Int ≥ 0 (set to 0 for out of stock)                                  |
| isActive          | boolean  | `false` = hide from store (soft delete); `true` = visible             |
| youtubeLinks      | string[] | 0–3 YouTube URLs (omit to leave unchanged)                            |
| tags              | string[] | Max 20 tags, each max 50 chars; stored normalized (omit to leave unchanged) |

**Response (200)** – updated product object (same shape as create; includes `shortDescription`, `tags`, `youtubeLinks`, `isActive`, `isOnSale`, `discountedPrice`).

**Error (404)** – Product not found.

---

### Delete product

| Method | Path                   | Auth | Roles        |
|--------|------------------------|------|--------------|
| DELETE | `/api/products/:id`   | Yes  | admin, manager |

**Response (200)**

```json
{
  "success": true,
  "message": "Product deleted successfully."
}
```

**Error (404)** – Product not found.

---

### Upload product image

| Method | Path                       | Auth | Roles        |
|--------|----------------------------|------|--------------|
| POST   | `/api/products/:id/image` | Yes  | admin, manager |

Upload a cover image for the product. Request must be **multipart/form-data** with a single file in the field **`image`**.

**Allowed types:** image/jpeg, image/png, image/gif, image/webp  
**Max size:** 5MB

**Example (curl)**

```bash
curl -X POST "http://localhost:5000/api/products/<productId>/image" \
  -H "Authorization: Bearer <token>" \
  -F "image=@/path/to/cover.jpg"
```

**Response (200)** – Updated product (including `coverImage` URL).

```json
{
  "success": true,
  "data": {
    "_id": "<productId>",
    "title": "Test Game",
    "coverImage": "https://<bucket>.s3.<region>.amazonaws.com/products/<productId>/cover-1234567890.jpg",
    ...
  }
}
```

**Error (400)** – No file, wrong field name, invalid type, or file too large.

**Error (404)** – Product not found.

**Error (503)** – S3 not configured (missing AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or S3_BUCKET).

---

## Users

Base path: `/api/users`

### List users

| Method | Path             | Auth | Roles  |
|--------|------------------|------|--------|
| GET    | `/api/users`     | No*  | -      |

*No JWT required for list; for getUser by id admin is required.

**Query parameters**

| Param   | Type   | Description                                |
|---------|--------|--------------------------------------------|
| page    | number | Default: 1                                 |
| limit   | number | Default: 10                                |
| role    | string | Filter: `user` \| `admin` \| `manager`      |
| isActive| string | `"true"` \| `"false"`                      |
| fields  | string | Comma-separated fields                     |
| sort    | string | e.g. `-createdAt`                          |

**Response (200)**

```json
{
  "success": true,
  "data": [
    {
      "_id": "<userId>",
      "email": "admin@gamestore.com",
      "name": "Admin User",
      "role": "admin",
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

*(Password is never returned.)*

---

### Get current user (me)

| Method | Path             | Auth | Roles        |
|--------|------------------|------|--------------|
| GET    | `/api/users/me`  | Yes  | any (own)    |

Returns the **authenticated user’s** full profile (no password). Use this after login or on refresh to hydrate the frontend with `name`, `profilePicture`, and other fields that are not stored in the JWT.

**Request:** `Authorization: Bearer <token>` (JWT from login/register).

**Response (200)**

```json
{
  "success": true,
  "data": {
    "_id": "<userId>",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "isActive": true,
    "profilePicture": "https://bucket.s3.region.amazonaws.com/users/<userId>/profile-123.jpg",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error (401)** – Missing or invalid token.

**Error (404)** – User not found (e.g. account deleted).

---

### Get user by ID

| Method | Path              | Auth | Roles |
|--------|-------------------|------|-------|
| GET    | `/api/users/:id`  | Yes  | admin |

**Response (200)**

```json
{
  "success": true,
  "data": {
    "_id": "<userId>",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "isActive": true,
    "profilePicture": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error (404)** – User not found.

---

### Create user

| Method | Path             | Auth | Roles        |
|--------|------------------|------|--------------|
| POST   | `/api/users`     | Yes  | admin, user  |

**Request body**

| Field    | Type   | Required | Rules                          |
|----------|--------|----------|--------------------------------|
| email    | string | Yes      | Valid email                    |
| password | string | Yes      | Min 6 characters               |
| name     | string | **Yes (mandatory)** | Non-empty; leading/trailing spaces trimmed |
| role     | string | No       | `user` \| `admin` \| `manager` (default: user) |

**Response (201)** – user object (no password).

**Validation:** Omitting `name` or sending an empty/whitespace-only name returns 400 with a validation error.

---

### Upload profile picture (current user)

| Method | Path                          | Auth | Roles        |
|--------|-------------------------------|------|--------------|
| POST   | `/api/users/me/profile-picture` | Yes  | any (own)    |

Uploads a profile picture for the **authenticated user**. File is sent to S3; the returned URL is saved on the user and returned. Use this to set or replace the current user’s profile picture.

**Request:** `multipart/form-data` with a single file field named **`image`**.

**Allowed types:** `image/jpeg`, `image/png`, `image/gif`, `image/webp`. Max size: 5MB.

**Response (200)**

```json
{
  "success": true,
  "data": {
    "_id": "<userId>",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "isActive": true,
    "profilePicture": "https://bucket.s3.region.amazonaws.com/users/<userId>/profile-1234567890.jpg",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Profile picture updated."
}
```

**Error (400)** – No file, wrong field name, invalid type, or file too large.

---

### Update user

| Method | Path              | Auth | Roles        |
|--------|-------------------|------|--------------|
| PATCH  | `/api/users/:id`  | Yes  | admin, user  |

**Request body** – all optional

| Field          | Type    | Rules                          |
|----------------|---------|--------------------------------|
| email          | string  | Valid email                    |
| password       | string  | Min 6 characters               |
| name           | string  | Non-empty                      |
| role           | string  | `user` \| `admin` \| `manager` |
| isActive       | boolean | -                              |
| profilePicture | string  | Valid URL, or `""` to clear    |

**Response (200)** – updated user (no password). User objects may include `profilePicture` (URL string or `null`).

**Error (404)** – User not found.

---

### Delete user

| Method | Path              | Auth | Roles |
|--------|-------------------|------|-------|
| DELETE | `/api/users/:id`  | Yes  | admin |

**Response (200)**

```json
{
  "success": true,
  "message": "User deleted successfully."
}
```

**Error (404)** – User not found.

---

## Cart

Base path: `/api/cart`  
All cart endpoints require **Authentication**.

### Get cart

| Method | Path         | Auth |
|--------|--------------|------|
| GET    | `/api/cart`  | Yes  |

**Response (200)**

```json
{
  "success": true,
  "data": {
    "_id": "<cartId>",
    "user": "<userId>",
    "items": [
      {
        "product": {
          "_id": "<productId>",
          "title": "Test Game",
          "price": 19.99,
          "platform": "PC",
          "isActive": true
        },
        "productId": "<productId>",
        "quantity": 2
      }
    ]
  }
}
```

If cart is empty, `items` is `[]` and `_id` may be absent; `user` is always present.

---

### Add item to cart

| Method | Path               | Auth |
|--------|--------------------|------|
| POST   | `/api/cart/items`  | Yes  |

**Request body**

| Field     | Type   | Required | Rules          |
|-----------|--------|----------|----------------|
| productId | string | Yes      | Valid 24-char hex (MongoDB ObjectId) |
| quantity  | number | Yes      | Integer ≥ 1    |

**Example**

```json
{
  "productId": "69858d821415d81f8ad6d4a8",
  "quantity": 2
}
```

**Response (200)** – full cart object (same shape as GET /api/cart).

**Error (404)**

```json
{
  "success": false,
  "message": "Product not found or inactive"
}
```

---

### Update item quantity

| Method | Path                          | Auth |
|--------|-------------------------------|------|
| PATCH  | `/api/cart/items/:productId`  | Yes  |

**URL params:** `productId` – product ObjectId.

**Request body**

| Field    | Type   | Required | Rules           |
|----------|--------|----------|-----------------|
| quantity | number | Yes      | Integer ≥ 0     |

Use `quantity: 0` to remove the line (or use DELETE).

**Example**

```json
{
  "quantity": 3
}
```

**Response (200)** – full cart object.

**Error (404)**

```json
{
  "success": false,
  "message": "Cart or item not found"
}
```

---

### Remove item from cart

| Method | Path                          | Auth |
|--------|-------------------------------|------|
| DELETE | `/api/cart/items/:productId`  | Yes  |

**Response (200)** – full cart object after removal.

---

### Clear cart

| Method | Path         | Auth |
|--------|--------------|------|
| DELETE | `/api/cart`  | Yes  |

**Response (200)**

```json
{
  "success": true,
  "data": { "items": [], "user": "<userId>" },
  "message": "Cart cleared"
}
```

---

## Addresses

Base path: `/api/addresses`  
All address endpoints require **Authentication**. Each user can have multiple addresses; one can be set as default for checkout.

### List my addresses

| Method | Path               | Auth |
|--------|--------------------|------|
| GET    | `/api/addresses`   | Yes  |

**Response (200)** – array of addresses (default first).

```json
{
  "success": true,
  "data": [
    {
      "_id": "<addressId>",
      "user": "<userId>",
      "label": "Home",
      "line1": "123 Main St",
      "line2": "Apt 4",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "country": "India",
      "phone": "9876543210",
      "isDefault": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### Get address by ID

| Method | Path                 | Auth |
|--------|----------------------|------|
| GET    | `/api/addresses/:id` | Yes  |

Returns the address only if it belongs to the authenticated user.

**Error (404)** – Address not found.

---

### Create address

| Method | Path               | Auth |
|--------|--------------------|------|
| POST   | `/api/addresses`   | Yes  |

**Request body**

| Field     | Type    | Required | Rules                    |
|-----------|---------|----------|---------------------------|
| line1     | string  | Yes      | Non-empty                 |
| line2     | string  | No       |                           |
| city      | string  | Yes      | Non-empty                 |
| state     | string  | Yes      | Non-empty                 |
| pincode   | string  | Yes      | Non-empty                 |
| country   | string  | No       | Default: India            |
| phone     | string  | No       |                           |
| label     | string  | No       | e.g. "Home", "Office"     |
| isDefault | boolean | No       | If true, unsets other defaults for user |

**Response (201)** – created address object.

---

### Update address

| Method | Path                 | Auth |
|--------|----------------------|------|
| PATCH  | `/api/addresses/:id` | Yes  |

**Request body** – same fields as create, all optional.

**Error (404)** – Address not found.

---

### Delete address

| Method | Path                 | Auth |
|--------|----------------------|------|
| DELETE | `/api/addresses/:id` | Yes  |

**Response (200)** – `{ "success": true, "message": "Address deleted successfully" }`

**Error (404)** – Address not found.

---

### Set default address

| Method | Path                       | Auth |
|--------|----------------------------|------|
| POST   | `/api/addresses/:id/set-default` | Yes  |

**Response (200)** – updated address and message.

**Error (404)** – Address not found.

---

## Orders

Base path: `/api/orders`  
All order endpoints require **Authentication**.

### Create order (checkout)

| Method | Path            | Auth |
|--------|-----------------|------|
| POST   | `/api/orders`   | Yes  |

Creates an order from the current cart and clears the cart. Optionally attach a billing address by sending `addressId` (one of the user’s addresses). Order includes GST breakdown (subTotal, gstRate, gstAmount, totalAmount) and starts with `paymentStatus: "unpaid"`.

**Request body**

| Field     | Type   | Required | Rules                    |
|-----------|--------|----------|---------------------------|
| addressId | string | No       | Valid ObjectId; must belong to user |

**Example:** `{}` or `{ "addressId": "<addressId>" }`

**Response (201)**

```json
{
  "success": true,
  "data": {
    "_id": "<orderId>",
    "user": "<userId>",
    "items": [
      {
        "product": "<productId>",
        "title": "Test Game",
        "quantity": 2,
        "price": 19.99
      }
    ],
    "billingAddress": {
      "line1": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "country": "India",
      "phone": "9876543210"
    },
    "subTotal": 120,
    "gstRate": 18,
    "gstAmount": 21.6,
    "totalAmount": 141.6,
    "status": "pending",
    "paymentStatus": "unpaid",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error (400)** – Cart empty

```json
{
  "success": false,
  "message": "Cart is empty"
}
```

**Error (400)** – Address not found (when `addressId` is provided)

```json
{
  "success": false,
  "message": "Address not found"
}
```

**Error (400)** – No valid products in cart

```json
{
  "success": false,
  "message": "No valid products in cart"
}
```

---

### List my orders

| Method | Path            | Auth |
|--------|-----------------|------|
| GET    | `/api/orders`   | Yes  |

**Query parameters**

| Param  | Type   | Description                          |
|--------|--------|--------------------------------------|
| page   | number | Default: 1                           |
| limit  | number | Default: 10                          |
| status | string | Filter: `pending` \| `completed` \| `cancelled` |
| sort   | string | e.g. `-createdAt`                    |

**Response (200)** – each order includes `billingAddress`, `subTotal`, `gstRate`, `gstAmount`, `totalAmount`, `paymentStatus`, and optionally `paidAt`, `payment`.

```json
{
  "success": true,
  "data": [
    {
      "_id": "<orderId>",
      "user": "<userId>",
      "items": [...],
      "billingAddress": { "line1": "...", "city": "...", "state": "...", "pincode": "...", "country": "...", "phone": "..." },
      "subTotal": 120,
      "gstRate": 18,
      "gstAmount": 21.6,
      "totalAmount": 141.6,
      "status": "pending",
      "paymentStatus": "paid",
      "paidAt": "...",
      "payment": "<paymentId>",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### Get order by ID

| Method | Path               | Auth |
|--------|--------------------|------|
| GET    | `/api/orders/:id`  | Yes  |

Returns the order only if it belongs to the authenticated user.

**Response (200)** – single order object (same shape as list item, with billingAddress, GST fields, paymentStatus, etc.).

**Error (404)**

```json
{
  "success": false,
  "message": "Order not found"
}
```

---

### Get invoice for order

| Method | Path                     | Auth |
|--------|--------------------------|------|
| GET    | `/api/orders/:id/invoice`| Yes  |

Returns the invoice for the given order if the order belongs to the authenticated user and is paid.

**Response (200)** – invoice object (see Invoices section).

**Error (404)**

```json
{
  "success": false,
  "message": "Invoice not found for this order"
}
```

---

## Payments (mock)

Base path: `/api/payments`  
All payment endpoints require **Authentication**. Payments are mock (no external gateway). Creating a payment returns a `mockPaymentUrl`; the client can then call **Confirm payment** to capture it. On capture, the order is marked paid and an invoice is created.

### Create payment

| Method | Path               | Auth |
|--------|--------------------|------|
| POST   | `/api/payments`    | Yes  |

Creates a payment for an order. Order must be unpaid and belong to the user. If a non-captured payment already exists for that order, returns it and its `mockPaymentUrl`.

**Request body**

| Field   | Type   | Required | Rules |
|---------|--------|----------|--------|
| orderId | string | Yes      | Valid ObjectId; order must belong to user and be unpaid |
| method  | string | No       | `mock_card` \| `mock_upi` \| `mock_netbanking` |

**Response (201)**

```json
{
  "success": true,
  "data": {
    "payment": {
      "_id": "<paymentId>",
      "order": "<orderId>",
      "user": "<userId>",
      "amount": 141.6,
      "currency": "INR",
      "status": "created",
      "method": "mock_upi",
      "gatewayPaymentId": "mock_<paymentId>",
      "createdAt": "...",
      "updatedAt": "..."
    },
    "mockPaymentUrl": "/pay/<paymentId>"
  }
}
```

**Error (404)** – Order not found.

**Error (400)** – Order is already paid.

---

### Get payment by ID

| Method | Path                 | Auth |
|--------|----------------------|------|
| GET    | `/api/payments/:id`  | Yes  |

Returns the payment only if it belongs to the authenticated user.

**Response (200)** – payment object (with optional `order` populated).

**Error (404)** – Payment not found.

---

### Confirm payment (capture)

| Method | Path                        | Auth |
|--------|-----------------------------|------|
| POST   | `/api/payments/:id/confirm`| Yes  |

Marks the payment as captured, sets the order’s `paymentStatus` to `paid`, **sets order `status` to `completed`**, and creates an invoice for the order.

**Response (200)** – payment object (status `captured`, `capturedAt` set).

**Error (404)** – Payment not found.

**Error (400)** – Payment has already failed. If already captured, returns 200 with existing payment and message "Payment already captured".

---

### Mock payment flow (frontend)

There is no real payment gateway; the frontend simulates “redirect to payment” and “return after payment”. Use this sequence:

**1. Checkout (create order)**  
- User selects a billing address (from **GET /api/addresses**) and reviews cart.  
- Call **POST /api/orders** with `{ "addressId": "<selectedAddressId>" }`.  
- On success, you receive the order with `_id`, `totalAmount`, `subTotal`, `gstAmount`, `billingAddress`.  
- Store `orderId` (e.g. in state or route param).  
- Redirect the user to your **payment page** (e.g. `/checkout/pay` or `/pay`) and pass `orderId` (query or state).

**2. Create payment**  
- On the payment page, call **POST /api/payments** with `{ "orderId": "<orderId>", "method": "mock_upi" }` (or omit `method`).  
- Response includes `data.payment._id` (paymentId) and `data.mockPaymentUrl` (e.g. `/pay/<paymentId>`).  
- Show a **payment summary**: order total, GST breakdown, billing address.  
- Show a **“Pay now”** (or “Confirm payment”) button that will trigger the capture.

**3. Simulate “user completed payment”**  
- When the user clicks “Pay now”, call **POST /api/payments/:id/confirm** with the `paymentId` from step 2.  
- Send the same `Authorization: Bearer <token>` header as for other API calls (the user’s JWT).  
- On 200: payment is captured, order is marked paid, and an invoice is created.  
- Redirect to a **success page** (e.g. `/orders/:orderId` or `/orders/:orderId/success`). Optionally show a link to **GET /api/orders/:orderId/invoice** to view or download the invoice.

**4. Optional: poll or re-fetch payment status**  
- If you show a “Processing…” state, you can poll **GET /api/payments/:id** until `status === "captured"` (or use the 200 response from confirm and skip polling).

**5. Error handling**  
- **POST /api/orders** → 400 “Cart is empty” / “Address not found” / “No valid products”: show message, stay on checkout.  
- **POST /api/payments** → 404 “Order not found” or 400 “Order is already paid”: show message, redirect to orders or cart.  
- **POST /api/payments/:id/confirm** → 404 or 400: show message; if “Payment already captured”, treat as success and redirect to order/success.

**Route suggestion**  
- You can use a route that matches `mockPaymentUrl` (e.g. `/pay/:paymentId`) so that “return from payment” links work: when the user lands on `/pay/<paymentId>`, load payment with **GET /api/payments/:id**, show summary and “Confirm payment” button, then call **POST /api/payments/:id/confirm** on button click.

---

## Events (SSE – recent purchases)

Used to power **"Someone from X just purchased Y"** toast notifications on the storefront. When a payment is confirmed, the server pushes a **recent-purchase** event to all connected SSE clients. This is **real-time push to the browser**, not an outgoing webhook.

| Method | Path                           | Auth | Description                    |
|--------|--------------------------------|------|--------------------------------|
| GET    | `/api/events/recent-purchases` | No   | Server-Sent Events stream     |

**Behavior**

- Response is a long-lived **text/event-stream**. The server sends an initial batch of the last ~20 recent purchases, then sends a new event whenever a payment is confirmed.
- Each event is one line: `data: <JSON>\n\n`.
- No authentication; any visitor can subscribe (payload only includes first name, country, and product titles).

**Event payload (JSON)**

| Field          | Type     | Description                                      |
|----------------|----------|--------------------------------------------------|
| buyerName      | string   | Buyer's first name (e.g. "Alex")                 |
| country        | string   | Billing country (e.g. "India")                  |
| productTitles  | string[] | Titles of purchased games                        |
| orderId        | string   | Order `_id`                                      |
| at             | string   | ISO timestamp when the event was emitted         |

**Example (single event)**

```
data: {"buyerName":"Alex","country":"India","productTitles":["Elden Ring"],"orderId":"507f1f77bcf86cd799439011","at":"2026-02-06T12:00:00.000Z"}

```

**Frontend usage**

- Open a connection with `EventSource('/api/events/recent-purchases')` (use full API base URL in production).
- Listen for `message` events; parse `event.data` as JSON and show a toast: e.g. *"Alex from India purchased Elden Ring"*.
- Reconnect on `error` or `close` if you want to keep the stream alive.

---

## Invoices

Base path: `/api/invoices` (get by id).  
Invoice for an order is also available at **GET /api/orders/:id/invoice**.  
All invoice endpoints require **Authentication**.

### Get invoice by ID

| Method | Path                 | Auth |
|--------|----------------------|------|
| GET    | `/api/invoices/:id`  | Yes  |

Returns the invoice only if it belongs to the authenticated user.

**Response (200)**

```json
{
  "success": true,
  "data": {
    "_id": "<invoiceId>",
    "invoiceNumber": "INV-2026-00001",
    "order": "<orderId>",
    "user": "<userId>",
    "billingAddress": { "line1": "...", "city": "...", "state": "...", "pincode": "...", "country": "...", "phone": "..." },
    "items": [
      { "product": "<productId>", "title": "Test Game", "quantity": 2, "price": 19.99, "amount": 39.98 }
    ],
    "subTotal": 120,
    "gstRate": 18,
    "gstAmount": 21.6,
    "totalAmount": 141.6,
    "status": "issued",
    "issuedAt": "...",
    "notes": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error (404)** – Invoice not found.

---

## Admin

Base path: `/api/admin`  
All admin endpoints require **Authentication** and **admin** role.

### List all orders (admin)

| Method | Path                   | Auth  |
|--------|------------------------|-------|
| GET    | `/api/admin/orders`    | Admin |

Returns all orders (order history for admins) with pagination and optional filters.

**Query parameters**

| Param         | Type   | Description |
|---------------|--------|-------------|
| page          | number | Default: 1  |
| limit         | number | Default: 10, max 100 |
| status        | string | Filter: `pending` \| `completed` \| `cancelled` |
| paymentStatus | string | Filter: `unpaid` \| `pending` \| `paid` \| `failed` \| `refunded` |
| userId        | string | Filter by user ObjectId |
| from          | string | Filter by createdAt ≥ (ISO date) |
| to            | string | Filter by createdAt ≤ (ISO date) |
| sort          | string | e.g. `-createdAt`, `createdAt`, `totalAmount` |

**Response (200)** – `data` array of orders; `meta`: `total`, `page`, `limit`, `totalPages`. Each order includes populated `user` (email, name) and `items.product` (title, price, platform).

---

### Update order status (admin)

| Method | Path                     | Auth  |
|--------|--------------------------|-------|
| PATCH  | `/api/admin/orders/:id`  | Admin |

Updates an order’s **status** (`pending`, `completed`, `cancelled`). Use this to mark an order as cancelled (e.g. refund) or to override status if needed. When payment is captured, the backend automatically sets order status to `completed`; admin can still change it to `cancelled` or back to `pending`.

**Request body**

| Field  | Type   | Required | Rules |
|--------|--------|----------|--------|
| status | string | Yes      | `pending` \| `completed` \| `cancelled` |

**Response (200)** – updated order object.

**Error (404)** – Order not found.

---

### List invoices (admin)

| Method | Path                     | Auth  |
|--------|--------------------------|-------|
| GET    | `/api/admin/invoices`    | Admin |

**Query parameters**

| Param  | Type   | Description |
|--------|--------|-------------|
| page   | number | Default: 1  |
| limit  | number | Default: 10 |
| from   | string | Filter by issuedAt ≥ (ISO date) |
| to     | string | Filter by issuedAt ≤ (ISO date) |
| userId | string | Filter by user ObjectId |
| orderId| string | Filter by order ObjectId |
| status | string | Filter: `draft` \| `issued` |

**Response (200)** – `data` array of invoices; `meta`: `total`, `page`, `limit`, `totalPages`. Invoices may include populated `user` (email, name) and `order` (paymentStatus, paidAt).

---

### Get invoice by ID (admin)

| Method | Path                        | Auth  |
|--------|-----------------------------|-------|
| GET    | `/api/admin/invoices/:id`  | Admin |

Returns any invoice by ID.

**Response (200)** – invoice object (same shape as user get).

**Error (404)** – Invoice not found.

---

### Update invoice (admin)

| Method | Path                        | Auth  |
|--------|-----------------------------|-------|
| PATCH  | `/api/admin/invoices/:id`   | Admin |

**Request body**

| Field  | Type   | Required | Rules |
|--------|--------|----------|--------|
| status | string | No       | `draft` \| `issued` |
| notes  | string | No       |       |

**Response (200)** – updated invoice object.

**Error (404)** – Invoice not found.

---

### Analytics (dashboard)

| Method | Path                   | Auth  |
|--------|------------------------|-------|
| GET    | `/api/admin/analytics` | Admin |

Returns dashboard metrics and chart data: overview KPIs, revenue and orders by period, top products, sales by platform/genre, review metrics, and user growth. One request returns all sections; optional `from`/`to` scope time-bound metrics (default last 30 days for time-series).

**Query parameters**

| Param    | Type   | Description |
|----------|--------|-------------|
| from     | string | Optional. Start of range (ISO date). When omitted with `to`, time-series use last 30 days. |
| to       | string | Optional. End of range (ISO date). |
| groupBy  | string | Time bucket for series: `day` (default), `week`, or `month`. |
| limit    | number | Optional. Max top products to return (1–50, default 10). |

**Response (200)**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalRevenue": 123456.78,
      "totalOrders": 42,
      "completedOrders": 40,
      "totalUsers": 100,
      "totalProducts": 50,
      "lowStockCount": 3,
      "ordersByStatus": { "pending": 1, "completed": 40, "cancelled": 1 }
    },
    "revenueByPeriod": [
      { "date": "2026-02-01", "revenue": 1000, "orderCount": 5 }
    ],
    "ordersByPeriod": [
      { "date": "2026-02-01", "count": 5 }
    ],
    "topProducts": [
      {
        "productId": "...",
        "title": "Game Title",
        "platform": "PC",
        "quantitySold": 10,
        "revenue": 2999.9
      }
    ],
    "salesByPlatform": [
      { "platform": "PC", "revenue": 5000, "orderCount": 25 }
    ],
    "salesByGenre": [
      { "genre": "Action", "revenue": 3000, "orderCount": 15 }
    ],
    "reviewMetrics": { "totalReviews": 200, "averageRating": 4.2 },
    "userGrowth": [
      { "date": "2026-02-01", "count": 2 }
    ]
  }
}
```

- **Revenue:** From orders with `paymentStatus: 'paid'`; time bucketing uses `paidAt` when present, else `createdAt`.
- **ordersByPeriod:** All order statuses, bucketed by `createdAt`.
- **salesByPlatform** / **salesByGenre:** `orderCount` is the number of order line items in that platform/genre.

---

## Summary table

| Method | Path | Auth | Module |
|--------|------|------|--------|
| GET | `/health` | No | Health |
| POST | `/api/auth/register` | No | Auth |
| POST | `/api/auth/login` | No | Auth |
| GET | `/api/products` | No | Products |
| GET | `/api/products/tags` | No | Products |
| GET | `/api/products/:id` | No | Products |
| GET | `/api/products/:id/related` | No | Products |
| GET | `/api/products/:id/reviews` | No | Products (Reviews) |
| GET | `/api/products/:id/reviews/me` | Yes | Products (Reviews) |
| POST | `/api/products/:id/reviews` | Yes | Products (Reviews) |
| DELETE | `/api/products/:id/reviews` | Yes | Products (Reviews) |
| POST | `/api/products` | Yes (admin/manager) | Products |
| PATCH | `/api/products/:id` | Yes (admin/manager) | Products |
| DELETE | `/api/products/:id` | Yes (admin/manager) | Products |
| POST | `/api/products/:id/image` | Yes (admin/manager) | Products |
| GET | `/api/users` | No | Users |
| GET | `/api/users/me` | Yes | Users |
| GET | `/api/users/:id` | Yes (admin) | Users |
| POST | `/api/users` | Yes (admin/user) | Users |
| POST | `/api/users/me/profile-picture` | Yes | Users |
| PATCH | `/api/users/:id` | Yes (admin/user) | Users |
| DELETE | `/api/users/:id` | Yes (admin) | Users |
| GET | `/api/addresses` | Yes | Addresses |
| GET | `/api/addresses/:id` | Yes | Addresses |
| POST | `/api/addresses` | Yes | Addresses |
| PATCH | `/api/addresses/:id` | Yes | Addresses |
| DELETE | `/api/addresses/:id` | Yes | Addresses |
| POST | `/api/addresses/:id/set-default` | Yes | Addresses |
| GET | `/api/cart` | Yes | Cart |
| POST | `/api/cart/items` | Yes | Cart |
| PATCH | `/api/cart/items/:productId` | Yes | Cart |
| DELETE | `/api/cart/items/:productId` | Yes | Cart |
| DELETE | `/api/cart` | Yes | Cart |
| POST | `/api/orders` | Yes | Orders |
| GET | `/api/orders` | Yes | Orders |
| GET | `/api/orders/:id` | Yes | Orders |
| GET | `/api/orders/:id/invoice` | Yes | Orders / Invoices |
| POST | `/api/payments` | Yes | Payments |
| GET | `/api/payments/:id` | Yes | Payments |
| POST | `/api/payments/:id/confirm` | Yes | Payments |
| GET | `/api/events/recent-purchases` | No | Events (SSE) |
| GET | `/api/invoices/:id` | Yes | Invoices |
| GET | `/api/admin/analytics` | Yes (admin) | Admin |
| GET | `/api/admin/orders` | Yes (admin) | Admin |
| PATCH | `/api/admin/orders/:id` | Yes (admin) | Admin |
| GET | `/api/admin/invoices` | Yes (admin) | Admin |
| GET | `/api/admin/invoices/:id` | Yes (admin) | Admin |
| PATCH | `/api/admin/invoices/:id` | Yes (admin) | Admin |

---

## Outgoing webhooks (concept; not implemented)

**What they are:** Your backend **POSTs to external URLs** when certain events happen (e.g. when an order is paid, you send a payload to a subscriber’s endpoint). Subscribers can be Zapier, Slack, a CRM, or your own service. This is different from the **SSE recent-purchases** stream above: SSE pushes to **browsers** for in-app toasts; webhooks push to **external servers** for integrations.

**What you can do with outgoing webhooks (if you add them):**

| Event              | Example use |
|--------------------|-------------|
| `order.completed`  | Notify Slack/Discord, send to CRM, trigger fulfillment, log in data warehouse |
| `payment.captured` | Sync to accounting, update external inventory |
| `user.registered` | Send to email marketing (Mailchimp, etc.) or analytics |
| `product.low_stock`| Alert warehouse or procurement system |
| `review.created`   | Moderation pipeline, sentiment analysis |

**Typical implementation:** A **webhook subscriptions** table (URL, secret, events[], enabled). When an event occurs, for each subscriber you POST the payload (with e.g. `X-Webhook-Signature: HMAC-SHA256`) and retry with backoff on failure. This API does not currently implement webhook delivery; the table above is for reference.

---

## Enums / constants

- **User roles:** `user`, `admin`, `manager`
- **Product platform:** `PC`, `PS5`, `XBOX`, `SWITCH`
- **Order status:** `pending`, `completed`, `cancelled`
- **Order payment status:** `unpaid`, `pending`, `paid`, `failed`, `refunded`
- **Payment status:** `created`, `authorized`, `captured`, `failed`
- **Payment method (mock):** `mock_card`, `mock_upi`, `mock_netbanking`
- **Invoice status:** `draft`, `issued`
