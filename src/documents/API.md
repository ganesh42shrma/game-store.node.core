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

## Razorpay (real gateway) integration

Use these endpoints to integrate Razorpay Checkout in the storefront. Ensure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set in your server environment (e.g. `.env`).

Base path: `/api/payments/razorpay`

### Create Razorpay order
| Method | Path | Auth |
|--------|------|------|
| POST | `/api/payments/razorpay/create-order` | Yes |

Creates a Razorpay Order for an existing `Order` in the app.

Request body

```json
{ "orderId": "<app order id>" }
```

Response (200)

```json
{
  "key": "<RAZORPAY_KEY_ID>",
  "order": { "id": "order_ABC...", "amount": 14160, "currency": "INR" },
  "appOrderId": "<app order id>"
}
```

Notes:
- `order.amount` is in paise (integer). Use this when initializing Razorpay Checkout.
- Backend creates a `Payment` document and stores the Razorpay order id in the payment record.

### Verify / capture Razorpay payment
| Method | Path | Auth |
|--------|------|------|
| POST | `/api/payments/razorpay/verify` | Yes |

Verify the client-side payment success by validating the HMAC signature and marking the order paid.

Request body

```json
{
  "razorpay_order_id": "<razorpay order id>",
  "razorpay_payment_id": "<razorpay payment id>",
  "razorpay_signature": "<signature>",
  "appOrderId": "<app order id>"
}
```

Response (200)

```json
{ "success": true, "result": { /* payment + order info */ } }
```

What happens server-side:
- Validates HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`.
- Updates `Payment` status to `captured`, sets `gatewayPaymentId` to the Razorpay payment id and `capturedAt`.
- Updates the `Order` to `paymentStatus: "paid"`, `status: "completed"`, sets `paidAt` and links the payment id.
- Creates an invoice and emits a recent-purchase SSE event (if configured).

### Webhooks (recommended)
- Optional: configure Razorpay webhooks in your Razorpay dashboard and add a secure `POST /api/payments/razorpay/webhook` endpoint to handle async events (`payment.failed`, `payment.captured`, `refund.*`). Verify webhook signatures and reconcile state.

### Frontend (Vite + React) integration — minimal flow

1. Create an app order via your normal checkout flow (POST `/api/orders`) and obtain `orderId`.
2. From your React payment page call POST `/api/payments/razorpay/create-order` with `{ orderId }`.
   - Receive `{ key, order: { id, amount, currency }, appOrderId }`.
3. Load the Razorpay Checkout script and open the Checkout with these options:

```jsx
// Minimal React example (call on button click)
async function startRazorpayCheckout(appOrderId, token, user) {
  const res = await fetch(`${API_BASE}/api/payments/razorpay/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId: appOrderId }),
  });
  const data = await res.json();
  const { key, order } = data;

  const options = {
    key,
    amount: order.amount,
    currency: order.currency,
    name: 'Game Store',
    description: `Order ${data.appOrderId}`,
    order_id: order.id,
    handler: async function(response){
      // send to server for verification
      await fetch(`${API_BASE}/api/payments/razorpay/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          appOrderId: data.appOrderId,
        }),
      });
      // on success: navigate to order success page
    },
    prefill: { email: user?.email, name: user?.name },
    theme: { color: '#F37254' },
  };

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => { new window.Razorpay(options).open(); };
  document.body.appendChild(script);
}
```

Notes for frontend:
- Only the `key` (RAZORPAY_KEY_ID) is public; the secret must remain server-side.
- The handler receives `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature` — always POST these plus your `appOrderId` to `/api/payments/razorpay/verify` for server-side verification.
- Handle network failures and display appropriate success/error pages to users.

### Quick curl smoke-tests

1. Create order (server must have `RAZORPAY_*` env vars):

```bash
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"orderId":"<appOrderId>"}' http://localhost:5000/api/payments/razorpay/create-order
```

2. Verify (use values returned by Razorpay client after a successful checkout):

```bash
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"razorpay_order_id":"<id>","razorpay_payment_id":"<id>","razorpay_signature":"<sig>","appOrderId":"<appOrderId>"}' \
  http://localhost:5000/api/payments/razorpay/verify
```

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

### My alerts (SSE – product alerts)

Per-user stream for product alerts (price drop, on sale, available). When a user has an alert and the condition is met (e.g. game goes on sale), the server pushes a notification to all connected clients for that user.

| Method | Path                         | Auth | Description                    |
|--------|------------------------------|------|--------------------------------|
| GET    | `/api/events/my-alerts`      | Yes  | Server-Sent Events stream      |

**Behavior**

- Response is a long-lived **text/event-stream**. The server sends a new event whenever an alert fires for this user (e.g. price drop, game on sale, back in stock).
- Each event is one line: `data: <JSON>\n\n`.
- Requires **Authentication** (Bearer token). Use `fetch()` with `Accept: text/event-stream` and `Authorization: Bearer <token>` (standard `EventSource` does not support custom headers) or a library that supports headers for SSE.

**Event payload (JSON)**

| Field          | Type     | Description                                      |
|----------------|----------|--------------------------------------------------|
| id             | string   | Notification `_id`                               |
| type           | string   | `price_drop` \| `on_sale` \| `available` \| `price_below` |
| productId      | string   | Product `_id`                                    |
| productTitle   | string   | Product title                                   |
| title          | string   | Notification title (e.g. "Game on sale!")        |
| message        | string   | Notification message                             |
| meta           | object   | `{ price, discountedPrice, isOnSale, stock }`    |
| createdAt      | string   | ISO timestamp                                   |

---

## Product Alerts

Base path: `/api/alerts`  
All endpoints require **Authentication**. Users can create alerts for products (“notify me when on sale”, “tell me when price drops below ₹X”, “tell me when available”). A background cron job (e.g. `npm run alerts:run`) checks product state and fires notifications via email and in-app notification.

Alerts can also be created via the **Chat** agent when the user says e.g. “Notify me when Elden Ring goes on sale” or “Tell me when this game drops below 2000”.

### List alerts

| Method | Path           | Auth |
|--------|----------------|------|
| GET    | `/api/alerts`  | Yes  |

Returns the current user's active product alerts.

**Response (200)**

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "<alertId>",
        "productId": "<productId>",
        "productTitle": "Elden Ring",
        "triggerType": "price_below",
        "priceThreshold": 2000,
        "createdAt": "2026-02-12T10:00:00.000Z"
      }
    ]
  }
}
```

### Create alert

| Method | Path           | Auth |
|--------|----------------|------|
| POST   | `/api/alerts`  | Yes  |

**Request body**

| Field          | Type   | Required | Rules                                                                 |
|----------------|--------|----------|-----------------------------------------------------------------------|
| productId      | string | Yes      | Valid product `_id`                                                   |
| triggerType    | string | Yes      | `on_sale` \| `available` \| `price_drop` \| `price_below`              |
| priceThreshold | number | No       | Required for `price_drop` and `price_below`; target price (e.g. 2000) |

**Example**

```json
{
  "productId": "698c2768a7dee4fffd793738",
  "triggerType": "price_below",
  "priceThreshold": 2000
}
```

**Response (201)**

```json
{
  "alert": {
    "_id": "<alertId>",
    "user": "<userId>",
    "product": "<productId>",
    "triggerType": "price_below",
    "priceThreshold": 2000,
    "isActive": true,
    "createdAt": "2026-02-12T10:00:00.000Z"
  }
}
```

### Deactivate alert

| Method | Path               | Auth |
|--------|--------------------|------|
| DELETE | `/api/alerts/:id`  | Yes  |

Deactivates the alert. Returns 404 if the alert does not exist or does not belong to the user.

**Response (200)**

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

---

## Notifications

Base path: `/api/notifications`  
All endpoints require **Authentication**. In-app notifications are created when an alert fires (price drop, on sale, available). Users receive notifications via email and can fetch them via REST. When connected to **GET /api/events/my-alerts**, they also receive real-time SSE events.

### List notifications

| Method | Path                  | Auth |
|--------|-----------------------|------|
| GET    | `/api/notifications`  | Yes  |

Returns the current user's notifications.

**Query parameters**

| Parameter   | Type   | Default | Description                          |
|-------------|--------|---------|--------------------------------------|
| limit       | number | 20      | Max items (1–50)                     |
| unreadOnly  | string | false   | `true` or `1` to return only unread   |

**Response (200)**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "<notificationId>",
        "type": "on_sale",
        "productId": "<productId>",
        "product": { "title": "Elden Ring", "price": 2999, "discountedPrice": 1999, "isOnSale": true },
        "title": "Game on sale!",
        "message": "Elden Ring is now on sale at ₹1999.00.",
        "meta": { "price": 2999, "discountedPrice": 1999, "isOnSale": true, "stock": 50 },
        "read": false,
        "createdAt": "2026-02-12T10:30:00.000Z"
      }
    ]
  }
}
```

### Mark notifications as read

| Method | Path                             | Auth |
|--------|----------------------------------|------|
| PATCH  | `/api/notifications/read`        | Yes  |

**Request body**

| Field            | Type            | Required | Rules                     |
|------------------|-----------------|----------|---------------------------|
| notificationIds  | string \| string[] | Yes    | Single id or array of ids |

**Example**

```json
{
  "notificationIds": ["674a1234567890abcdef1234"]
}
```

or

```json
{
  "notificationIds": ["674a1234567890abcdef1234", "674a1234567890abcdef5678"]
}
```

**Response (200)**

```json
{
  "success": true,
  "data": {
    "modified": 2
  }
}
```

### Mark all notifications as read

| Method | Path                              | Auth |
|--------|-----------------------------------|------|
| PATCH  | `/api/notifications/read-all`     | Yes  |

**Response (200)**

```json
{
  "success": true,
  "data": {
    "modified": 5
  }
}
```

---

## Chat (Games Q&A)

Base path: `/api/chat`  
All chat endpoints require **Authentication** (any logged-in user). The agent answers about games, listings, stock, price, on-sale status, and reviews. It can **add games to cart** and **purchase** them when the user says e.g. "Add Elden Ring to cart" or "Buy this game". It always clarifies and confirms before executing, and asks which address and payment method to use for purchases. It refuses PII, prompt-injection, and off-topic requests (e.g. other users' accounts, role changes).

### Send message (Games Q&A agent)

| Method | Path         | Auth |
|--------|--------------|------|
| POST   | `/api/chat`  | Yes  |

Sends the user’s message to the games Q&A agent. The agent can list products, get product details, and get reviews. When it mentions a specific game, the reply includes the product id so the frontend can link to the product page and call **GET /api/products/:id** (and **GET /api/products/:id/reviews**) for full details.

**Request body**

| Field       | Type    | Required | Rules                                      |
|-------------|---------|----------|--------------------------------------------|
| message     | string  | Yes      | Non-empty; max 2000 characters             |
| thread_id   | string  | No       | Conversation thread id; when omitted and user is logged in, server uses `{user_id}-chat`. Send the same value to keep a coherent thread. |
| new_chat    | boolean | No       | When `true`, starts a fresh conversation: no history is loaded, a new thread id is created and returned. Use for "New chat" / "Clear context". |

When the user is **authenticated**, the agent has **long-term memory** per user: it can remember preferences (e.g. budget, favorite genre, platform) via tools and use them to personalize answers. The agent can also **create product alerts** when the user says e.g. “Notify me when Elden Ring is on sale”, “Tell me when this game drops below ₹2000”, or “Tell me when it’s available”; use **GET /api/alerts** to list and **DELETE /api/alerts/:id** to remove. The agent can **add to cart** ("Add X to cart") and **buy** ("Buy X" or "Purchase X"): it confirms once before executing, asks which address (from **GET /api/addresses**) and payment method (Card, UPI, or Net Banking), and asks whether to buy only that game or checkout the entire cart. If the user has no addresses, the agent tells them to add one first. The server injects the current user id for memory; the client may send **thread_id** to align with a specific conversation thread.

**Chat history** is persisted per user and thread. Each message (user and assistant) is saved to the database. The agent receives the last 10 messages of the thread as context (configurable via `AGENT_HISTORY_LIMIT`). Long messages are truncated to save tokens. Use **GET /api/chat/history** to load previous messages when the user opens a chat; use **GET /api/chat/threads** to list a user's conversation threads. To start a fresh conversation (clear context), send `new_chat: true` in the request body; the server returns a new `thread_id` to use for follow-up messages. Each user is limited to 3 threads; starting a new one when at the limit deletes the oldest thread.

**Example**

```json
{
  "message": "What games are on sale? Is Hades in stock?"
}
```

With optional thread (e.g. for resuming a session):

```json
{
  "message": "Recommend something under $50",
  "thread_id": "user123-chat"
}
```

To start a fresh conversation (clear context, e.g. "New chat" button):

```json
{
  "message": "Hi, what's on sale?",
  "new_chat": true
}
```

**Response (200)**

```json
{
  "success": true,
  "data": {
    "message": "Here are some games on sale: Hades (product id: 698c2768a7dee4fffd793738) is $19.99, in stock...",
    "productIds": ["698c2768a7dee4fffd793738"],
    "thread_id": "674a1234567890abcdef1234-chat",
    "user_id": "674a1234567890abcdef1234"
  }
}
```

- **message** – The agent’s reply, sanitized for display: no product IDs or exact stock numbers (e.g. “in stock” instead of “stock count is 95”). Use this as the chat bubble text. Do not show product IDs to the user.
- **productIds** – Array of product IDs (from tool results and reply). Use only for “View game” links (e.g. `/products/:id`) and for **GET /api/products/:id**; do not display these IDs in the chat.
- **orderId** – Present when a purchase was completed in this turn. Use for "View order" links (e.g. `/orders/:id`).
- **invoiceId** – Present when a purchase was completed in this turn. Use for "View invoice" links (e.g. `/orders/:id/invoice` or `/api/invoices/:id`).
- **thread_id** – Present when a thread was used (server-generated or client-sent). Reuse in subsequent requests to keep the same conversation thread.
- **user_id** – Present when the user is authenticated; used for long-term memory (preferences). For display or debugging only; do not rely for authorization.

**Streaming response**

To receive the reply as a **Server-Sent Events (SSE)** stream (token-by-token), either:

- Set the request header: **`Accept: text/event-stream`**, or  
- Add a query parameter: **`?stream=true`** (or `stream=1`).

Same **POST /api/chat** endpoint and body; only the response format changes.

**Response (200)** – `Content-Type: text/event-stream`. Each line is an SSE event. **Tool output (e.g. raw catalog JSON) is never sent**; only the agent’s text is exposed. The stream emits **thinking** events (status updates like "Browsing catalog...") and **chunk** events (parts of the final text reply).

| Event `data` (JSON)      | Description |
|--------------------------|-------------|
| `{ "type": "thinking", "message": "…" }` | Status update (e.g. “Browsing the catalog…”, “Checking stock…”). Show this in a loading indicator; do not append to the chat history. |
| `{ "type": "chunk", "content": "…" }` | A piece of the **final answer**. Append `content` to the displayed reply. |
| `{ "type": "done", "productIds": ["…"], "message": "…", "orderId": "…", "invoiceId": "…", "thread_id": "…", "user_id": "…" }` | Stream finished. **productIds**: use only for "View game" links (do not show to the user). **message**: optional sanitized full reply (no product IDs or exact stock numbers); use for display when present. **orderId** / **invoiceId**: present when a purchase was completed; use for "View order" / "View invoice" links. **thread_id** / **user_id**: optional; same meaning as non-stream response. |
| `{ "type": "error", "message": "…" }` | Stream failed (e.g. LLM error). Only sent on server error during stream. |

**Example (streaming)**

```
data: {"type":"thinking","message":"Browsing the catalog..."}
data: {"type":"thinking","message":"Reading reviews for Hades..."}
data: {"type":"chunk","content":"Hades "}
data: {"type":"chunk","content":"is currently in stock and highly rated."}
data: {"type":"done","productIds":["698b1e2a82d35cab4bb1b1eb"], "message": "Hades is currently in stock and highly rated."}
```

**Frontend (streaming):** Use `fetch()` with `Accept: text/event-stream` and `Authorization: Bearer <token>`. Parse each `data:` line as JSON:
- **thinking**: Update your UI's loading/status indicator with `data.message`.
- **chunk**: Append `data.content` to the chat bubble.
- **done**: stream complete. Hide loading indicator. Use `productIds` for links.
- **error**: Handle error.

### Get chat history

| Method | Path              | Auth |
|--------|-------------------|------|
| GET    | `/api/chat/history` | Yes  |

Returns messages for a thread. Query: `thread_id` (optional, default: `{user_id}-chat`), `limit` (optional, default: 20, max: 50). Response: `{ "messages": [{ "role", "content", "createdAt" }], "thread_id" }`.

### List chat threads

| Method | Path               | Auth |
|--------|--------------------|------|
| GET    | `/api/chat/threads` | Yes  |

Returns threads with at least one message. Response: `{ "threads": [{ "threadId", "lastMessageAt", "title" }] }`. **title** is LLM-generated from the first message by default; users can rename via **PATCH /api/chat/threads/:threadId**. May be null for new threads. Each user is limited to 3 threads; the oldest is deleted when a new one is started.

### Delete a chat thread

| Method | Path                        | Auth |
|--------|-----------------------------|------|
| DELETE | `/api/chat/threads/:threadId` | Yes  |

Deletes a thread and all its messages for the authenticated user. Only the thread owner can delete it. Response: `{ "deleted": true, "deletedCount": 5 }` where `deletedCount` is the number of messages removed.

### Rename a chat thread

| Method | Path                        | Auth |
|--------|-----------------------------|------|
| PATCH  | `/api/chat/threads/:threadId` | Yes  |

Renames a thread. By default, thread titles are LLM-generated from the first message; users can override with a custom name. Request body: `{ "title": "My custom name" }`. Title is trimmed and limited to 100 characters. Response: `{ "updated": true, "title": "My custom name" }`. Returns 404 if the thread does not exist or does not belong to the user.

**Guardrails**

- Input is checked for prompt-injection patterns, PII/abuse phrases, and length. Blocked messages return **400** with a generic safety message; the LLM is not called.
- The agent’s system prompt restricts answers to catalog/reviews only; it refuses account, order, or other-user questions.

**Frontend usage**

1. On chat load: call **GET /api/chat/history** to restore previous messages; use `?thread_id=...` for a specific thread.
2. Call **POST /api/chat** with `{ "message": "..." }` and the user's JWT. Include `thread_id` in the body to continue a thread.
3. Display `data.message` in the chat UI.
4. For each id in `data.productIds`, show a link to the product page (e.g. `/products/698c2768a7dee4fffd793738`).
5. On the product page, use **GET /api/products/:id** for full details and **GET /api/products/:id/reviews** for the review list.
6. For multi-thread support: call **GET /api/chat/threads** to list threads; pass `threadId` as `thread_id` when sending messages.
7. To clear context and start fresh: send `new_chat: true` with the message; use the returned `thread_id` for subsequent messages in that conversation.
8. To delete a thread: call **DELETE /api/chat/threads/:threadId** with the thread id from the threads list.
9. To rename a thread: call **PATCH /api/chat/threads/:threadId** with body `{ "title": "Custom name" }`. Titles are LLM-generated by default; users can override.

**Error (400)** – Validation or guardrail (empty message, too long, or blocked content)

```json
{
  "success": false,
  "message": "Message could not be processed. Please ask about games, listings, or reviews."
}
```

**Error (401)** – Missing or invalid token.

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

Returns dashboard metrics and chart data: overview KPIs, revenue and orders by period, top products, sales by platform/genre, review metrics, user growth, and LLM analytics (token usage by agent and provider). One request returns all sections; optional `from`/`to` scope time-bound metrics (default last 30 days for time-series).

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
    ],
    "llmAnalytics": {
      "overview": {
        "totalRequests": 150,
        "totalInputTokens": 45000,
        "totalOutputTokens": 12000,
        "totalTokens": 57000,
        "byAgent": [
          { "agentType": "games-qa", "requests": 140, "inputTokens": 42000, "outputTokens": 11000, "totalTokens": 53000 },
          { "agentType": "game-creation", "requests": 10, "inputTokens": 3000, "outputTokens": 1000, "totalTokens": 4000 }
        ],
        "byProvider": [
          { "provider": "groq", "requests": 150, "inputTokens": 45000, "outputTokens": 12000, "totalTokens": 57000 }
        ]
      },
      "usageByPeriod": [
        { "date": "2026-02-01", "requests": 25, "inputTokens": 8000, "outputTokens": 2000, "totalTokens": 10000 }
      ]
    }
  }
}
```

- **Revenue:** From orders with `paymentStatus: 'paid'`; time bucketing uses `paidAt` when present, else `createdAt`.
- **ordersByPeriod:** All order statuses, bucketed by `createdAt`.
- **salesByPlatform** / **salesByGenre:** `orderCount` is the number of order line items in that platform/genre.
- **llmAnalytics:** LLM usage (Games Q&A chat + game-creation agent). `overview` has totals and breakdown by agent and provider; `usageByPeriod` is token usage over time. Data is recorded when agents call the LLM; empty until first chat or game-creation request.

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
| GET | `/api/events/my-alerts` | Yes | Events (SSE) |
| GET | `/api/alerts` | Yes | Alerts |
| POST | `/api/alerts` | Yes | Alerts |
| DELETE | `/api/alerts/:id` | Yes | Alerts |
| GET | `/api/notifications` | Yes | Notifications |
| PATCH | `/api/notifications/read` | Yes | Notifications |
| PATCH | `/api/notifications/read-all` | Yes | Notifications |
| POST | `/api/chat` | Yes | Chat (Games Q&A) |
| DELETE | `/api/chat/threads/:threadId` | Yes | Delete chat thread |
| PATCH | `/api/chat/threads/:threadId` | Yes | Rename chat thread |
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
- **Alert trigger types:** `on_sale`, `available`, `price_drop`, `price_below`
- **Product platform:** `PC`, `PS5`, `XBOX`, `SWITCH`
- **Order status:** `pending`, `completed`, `cancelled`
- **Order payment status:** `unpaid`, `pending`, `paid`, `failed`, `refunded`
- **Payment status:** `created`, `authorized`, `captured`, `failed`
- **Payment method (mock):** `mock_card`, `mock_upi`, `mock_netbanking`
- **Invoice status:** `draft`, `issued`
