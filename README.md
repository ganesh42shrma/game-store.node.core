# Game Store API

REST API backend for a game e-commerce application. Built with Node.js and Express. Supports authentication, role-based access, product catalog (with search), cart, addresses, checkout with GST, mock payments, invoices, and admin order/invoice management.

## Tech stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** MongoDB (Mongoose)
- **Cache / rate limiting:** Redis (optional; in-memory fallback)
- **Validation:** Zod
- **Auth:** JWT, bcrypt
- **Logging:** Winston
- **File storage:** AWS S3 (product cover images, user profile pictures)

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Redis (optional; rate limiting uses in-memory store when Redis is not configured)
- AWS S3 (optional; required for product image and user profile picture uploads)

## Installation

```bash
git clone <repository-url>
cd game-store.node.core
npm install
```

## Environment variables

Create a `.env` file in the project root:

| Variable              | Required | Description                                              |
|-----------------------|----------|----------------------------------------------------------|
| MONGODB_URI           | Yes      | MongoDB connection string                                |
| JWT_SECRET            | Yes      | Secret used to sign JWTs                                 |
| PORT                  | No       | Server port (default: 5000)                              |
| JWT_EXPIRES_IN        | No       | Token expiry (default: 7d)                               |
| LOG_LEVEL             | No       | Winston level (default: info)                            |
| REDIS_URI             | No       | Redis URL for rate limiting                              |
| CORS_ORIGIN           | No       | Allowed frontend origin(s); comma-separated for multiple  |
| AWS_ACCESS_KEY_ID     | No*      | AWS access key (required for S3 uploads)                 |
| AWS_SECRET_ACCESS_KEY | No*      | AWS secret key (required for S3 uploads)                 |
| AWS_REGION            | No       | AWS region (default: us-east-1)                           |
| S3_BUCKET             | No*      | S3 bucket name (required for S3 uploads)                  |
| S3_PUBLIC_BASE_URL    | No       | Base URL for S3 objects (default: https://&lt;bucket&gt;.s3.&lt;region&gt;.amazonaws.com) |

## Running the application

**Development (with reload):**

```bash
npm run dev
```

**Production:**

```bash
npm start
```

Server listens on `http://localhost:5000` (or the port set in `PORT`).

## Scripts

| Command                  | Description                                                      |
|--------------------------|------------------------------------------------------------------|
| `npm start`              | Start the server                                                 |
| `npm run dev`            | Start with nodemon                                               |
| `npm run seed:admin`     | Create an admin user (see below)                                  |
| `npm run seed:games`     | Seed sample products                                             |
| `npm run test:api`       | Run API smoke tests (server must be running)                     |
| `npm run test:full-flow` | Run full checkout flow as admin (server + products required)    |
| `npm run test:full-flow:user` | Run full checkout flow as user (ganesh@gamestore.com)     |

### Seeding an admin user

Creates a single admin user if none exists. Default credentials:

- **Email:** admin@gamestore.com  
- **Password:** admin123  

```bash
npm run seed:admin
```

### Seeding products

Adds sample game products to the catalog:

```bash
npm run seed:games
```

### Testing the API

**Basic smoke test** (server must be running):

```bash
npm run test:api
```

**Full flow test** (checkout → payment → invoice as admin):

```bash
npm run test:full-flow
```

**Full flow as user** (register/login as ganesh@gamestore.com, then run flow):

```bash
npm run test:full-flow:user
```

Override base URL:

```bash
BASE_URL=http://localhost:3000 npm run test:api
```

## API overview

Protected routes require the header: `Authorization: Bearer <token>`.

| Module     | Endpoints |
|------------|-----------|
| **Health** | `GET /health` |
| **Auth**   | `POST /api/auth/register`, `POST /api/auth/login` |
| **Products** | `GET /api/products` (search, filters, pagination), `GET /api/products/:id`, `POST/PATCH/DELETE /api/products/:id`, `POST /api/products/:id/image` |
| **Users**  | `GET /api/users`, `GET /api/users/me` (current user), `GET /api/users/:id`, `POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/me/profile-picture`, `DELETE /api/users/:id` |
| **Addresses** | `GET/POST /api/addresses`, `GET/PATCH/DELETE /api/addresses/:id`, `POST /api/addresses/:id/set-default` |
| **Cart**   | `GET /api/cart`, `POST /api/cart/items`, `PATCH/DELETE /api/cart/items/:productId`, `DELETE /api/cart` |
| **Orders** | `POST /api/orders` (checkout with optional addressId, GST breakdown), `GET /api/orders`, `GET /api/orders/:id`, `GET /api/orders/:id/invoice` |
| **Payments (mock)** | `POST /api/payments` (create payment for order), `GET /api/payments/:id`, `POST /api/payments/:id/confirm` (capture → order paid, invoice created) |
| **Invoices** | `GET /api/invoices/:id` (own), `GET /api/orders/:id/invoice` (invoice for order) |
| **Admin**  | `GET/PATCH /api/admin/orders`, `GET/PATCH /api/admin/orders/:id`, `GET /api/admin/invoices`, `GET/PATCH /api/admin/invoices/:id` |

Full request/response details, query parameters, and schemas: **[src/documents/API.md](src/documents/API.md)**.

Design notes (orders, carts, payments, invoices): **[src/documents/orders-carts-design.md](src/documents/orders-carts-design.md)**.

## Project structure

```
src/
  app.js              # Express app, CORS, middleware, error handler
  server.js           # Entry point, DB connect, listen
  config/             # DB, env, logger, Redis, S3
  controllers/        # Route handlers (auth, user, product, cart, order, address, payment, invoice, admin)
  middlewares/        # Auth, RBAC, validation, rate limit, request logger, upload (multer)
  models/             # User, Product, Cart, Order, Address, Payment, Invoice
  routes/             # Route definitions (auth, users, products, cart, orders, addresses, payments, invoices, admin)
  services/           # Business logic
  validators/         # Zod schemas
  documents/          # API reference (API.md), orders-carts-design.md
  scripts/            # Seed, test, and utility scripts
```

## Features

- **Authentication:** JWT-based; register and login with email/password. Name is mandatory on register/create user.
- **Current user:** `GET /api/users/me` returns full profile (name, profilePicture, etc.) for hydration after login/refresh.
- **User profile picture:** `POST /api/users/me/profile-picture` uploads image to S3 and saves URL on user.
- **Authorization:** Role-based access (user, admin, manager) via middleware.
- **Products:** CRUD with filters (platform, genre, minPrice, maxPrice), **text search** (title, description, genre), pagination, optional cover image upload to S3.
- **Addresses:** CRUD and set default; used at checkout for billing address snapshot on order.
- **Cart:** Add/update/remove items; one cart per user.
- **Checkout:** Create order from cart with optional addressId; order includes billing address snapshot, **GST breakdown** (subTotal, gstRate, gstAmount, totalAmount), paymentStatus.
- **Mock payments:** Create payment for order → get mockPaymentUrl → confirm payment (capture) → order marked paid, **invoice created** automatically.
- **Invoices:** User can get invoice by order or by invoice id; admin can list/filter and update invoices.
- **Admin:** List/update orders (status), list/get/update invoices.
- **Validation:** Request bodies/params/query validated with Zod; consistent error responses.
- **Rate limiting:** Per-IP limits on `/api`; stricter limits on auth endpoints. Uses Redis when `REDIS_URI` is set.
- **Logging:** Winston with request/response logging middleware.
- **Error handling:** Central error handler; Mongoose validation errors mapped to JSON.
- **Pagination:** Supported on product list, user list, order list, admin orders, admin invoices (with meta where applicable).

## License

ISC
