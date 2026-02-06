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
| name     | string | Yes      | Non-empty                |

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

| Param    | Type   | Description                                      |
|----------|--------|--------------------------------------------------|
| page     | number | Page number (default: 1)                         |
| limit    | number | Items per page (default: 10)                     |
| platform | string | Filter: `PC` \| `PS5` \| `XBOX` \| `SWITCH`      |
| genre    | string | Filter by genre                                  |
| minPrice | number | Min price                                        |
| maxPrice | number | Max price                                        |
| fields   | string | Comma-separated field list (e.g. `title,price`)  |
| sort     | string | Sort (e.g. `price`, `-createdAt`)               |

**Response (200)**

```json
{
  "success": true,
  "data": [
    {
      "_id": "<productId>",
      "title": "GTA VI",
      "description": "Open-world action adventure",
      "price": 4999,
      "platform": "PS5",
      "genre": "Action",
      "stock": 50,
      "rating": 0,
      "coverImage": null,
      "releaseDate": null,
      "isActive": true,
      "createdAt": "2026-02-04T12:09:35.058Z",
      "updatedAt": "2026-02-04T13:26:29.900Z"
    }
  ]
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
    "description": "Open-world action adventure",
    "price": 4999,
    "platform": "PS5",
    "genre": "Action",
    "stock": 50,
    "rating": 0,
    "coverImage": null,
    "releaseDate": null,
    "isActive": true,
    "createdAt": "2026-02-04T12:09:35.058Z",
    "updatedAt": "2026-02-04T13:26:29.900Z"
  }
}
```

**Error (404)**

```json
{
  "success": false,
  "message": "Product not found"
}
```

---

### Create product

| Method | Path              | Auth | Roles        |
|--------|-------------------|------|--------------|
| POST   | `/api/products`   | Yes  | admin, manager |

**Request body**

| Field       | Type   | Required | Rules                          |
|-------------|--------|----------|--------------------------------|
| title       | string | Yes      | Non-empty                      |
| description | string | Yes      | Non-empty                      |
| price       | number | Yes      | > 0                            |
| platform    | string | Yes      | `PC` \| `PS5` \| `XBOX` \| `SWITCH` |
| genre       | string | Yes      | Non-empty                      |
| stock       | number | No       | Int ≥ 0                        |

**Example**

```json
{
  "title": "Test Game",
  "description": "A game",
  "price": 19.99,
  "platform": "PC",
  "genre": "RPG",
  "stock": 10
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
    "price": 19.99,
    "platform": "PC",
    "genre": "RPG",
    "stock": 10,
    "rating": 0,
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### Update product

| Method | Path                   | Auth | Roles        |
|--------|------------------------|------|--------------|
| PATCH  | `/api/products/:id`   | Yes  | admin, manager |

**Request body** – all fields optional

| Field       | Type   | Rules                          |
|-------------|--------|---------------------------------|
| title       | string | Non-empty                       |
| description | string | Non-empty                       |
| price       | number | > 0                             |
| platform    | string | `PC` \| `PS5` \| `XBOX` \| `SWITCH` |
| genre       | string | Non-empty                       |
| stock       | number | Int ≥ 0                         |

**Response (200)** – updated product object (same shape as create).

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
| name     | string | Yes      | Non-empty                      |
| role     | string | No       | `user` \| `admin` \| `manager` (default: user) |

**Response (201)** – user object (no password).

---

### Update user

| Method | Path              | Auth | Roles        |
|--------|-------------------|------|--------------|
| PATCH  | `/api/users/:id`  | Yes  | admin, user  |

**Request body** – all optional

| Field    | Type    | Rules                          |
|----------|---------|--------------------------------|
| email    | string  | Valid email                    |
| password | string  | Min 6 characters               |
| name     | string  | Non-empty                      |
| role     | string  | `user` \| `admin` \| `manager` |
| isActive | boolean | -                             |

**Response (200)** – updated user (no password).

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

## Orders

Base path: `/api/orders`  
All order endpoints require **Authentication**.

### Create order (checkout)

| Method | Path            | Auth |
|--------|-----------------|------|
| POST   | `/api/orders`   | Yes  |

Creates an order from the current cart and clears the cart.

**Request body:** `{}` or omit.

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
    "totalAmount": 39.98,
    "status": "pending",
    "createdAt": "2026-02-06T06:43:14.639Z",
    "updatedAt": "2026-02-06T06:43:14.639Z"
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

**Response (200)**

```json
{
  "success": true,
  "data": [
    {
      "_id": "<orderId>",
      "user": "<userId>",
      "items": [
        {
          "product": { "_id": "...", "title": "Test Game", "price": 19.99, "platform": "PC" },
          "title": "Test Game",
          "quantity": 2,
          "price": 19.99
        }
      ],
      "totalAmount": 39.98,
      "status": "pending",
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

**Response (200)** – single order object (same shape as list item).

**Error (404)**

```json
{
  "success": false,
  "message": "Order not found"
}
```

---

## Summary table

| Method | Path | Auth | Module |
|--------|------|------|--------|
| GET | `/health` | No | Health |
| POST | `/api/auth/register` | No | Auth |
| POST | `/api/auth/login` | No | Auth |
| GET | `/api/products` | No | Products |
| GET | `/api/products/:id` | No | Products |
| POST | `/api/products` | Yes (admin/manager) | Products |
| PATCH | `/api/products/:id` | Yes (admin/manager) | Products |
| DELETE | `/api/products/:id` | Yes (admin/manager) | Products |
| GET | `/api/users` | No | Users |
| GET | `/api/users/:id` | Yes (admin) | Users |
| POST | `/api/users` | Yes (admin/user) | Users |
| PATCH | `/api/users/:id` | Yes (admin/user) | Users |
| DELETE | `/api/users/:id` | Yes (admin) | Users |
| GET | `/api/cart` | Yes | Cart |
| POST | `/api/cart/items` | Yes | Cart |
| PATCH | `/api/cart/items/:productId` | Yes | Cart |
| DELETE | `/api/cart/items/:productId` | Yes | Cart |
| DELETE | `/api/cart` | Yes | Cart |
| POST | `/api/orders` | Yes | Orders |
| GET | `/api/orders` | Yes | Orders |
| GET | `/api/orders/:id` | Yes | Orders |

---

## Enums / constants

- **User roles:** `user`, `admin`, `manager`
- **Product platform:** `PC`, `PS5`, `XBOX`, `SWITCH`
- **Order status:** `pending`, `completed`, `cancelled`
