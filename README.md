# Game Store API

REST API backend for a game e-commerce application. Built with Node.js and Express. Supports authentication, role-based access, product catalog, cart, and orders.

## Tech stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** MongoDB (Mongoose)
- **Cache / rate limiting:** Redis (optional; in-memory fallback)
- **Validation:** Zod
- **Auth:** JWT, bcrypt
- **Logging:** Winston

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Redis (optional; rate limiting uses in-memory store when Redis is not configured)

## Installation

```bash
git clone <repository-url>
cd game-store.node.core
npm install
```

## Environment variables

Create a `.env` file in the project root:

| Variable      | Required | Description                    |
|---------------|----------|--------------------------------|
| MONGODB_URI   | Yes      | MongoDB connection string      |
| JWT_SECRET    | Yes      | Secret used to sign JWTs        |
| PORT          | No       | Server port (default: 5000)    |
| JWT_EXPIRES_IN| No       | Token expiry (default: 7d)      |
| LOG_LEVEL     | No       | Winston level (default: info)  |
| REDIS_URI     | No       | Redis URL for rate limiting    |

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

| Command            | Description                                      |
|--------------------|--------------------------------------------------|
| `npm start`        | Start the server                                 |
| `npm run dev`      | Start with nodemon                               |
| `npm run seed:admin` | Create an admin user (see below)              |
| `npm run test:api` | Run API smoke tests (server must be running)     |

### Seeding an admin user

Creates a single admin user if none exists. Default credentials:

- **Email:** admin@gamestore.com  
- **Password:** admin123  

```bash
npm run seed:admin
```

### Testing the API

With the server running in another terminal:

```bash
npm run test:api
```

Uses `http://localhost:5000` by default. Override with:

```bash
BASE_URL=http://localhost:3000 npm run test:api
```

## API overview

- **Health:** `GET /health`
- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`
- **Products:** `GET/POST /api/products`, `GET/PATCH/DELETE /api/products/:id`
- **Users:** `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`
- **Cart:** `GET /api/cart`, `POST /api/cart/items`, `PATCH/DELETE /api/cart/items/:productId`, `DELETE /api/cart`
- **Orders:** `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`

Protected routes require the header: `Authorization: Bearer <token>`.

Full request/response details, query parameters, and schemas: **[src/documents/API.md](src/documents/API.md)**.

## Project structure

```
src/
  app.js              # Express app, middleware, error handler
  server.js           # Entry point, DB connect, listen
  config/             # DB, env, logger, Redis
  controllers/        # Route handlers
  middlewares/        # Auth, RBAC, validation, rate limit, request logger
  models/             # Mongoose models
  routes/             # Route definitions
  services/           # Business logic
  validators/         # Zod schemas
  documents/          # API reference (API.md)
  scripts/            # Seed and test scripts
```

## Features

- **Authentication:** JWT-based; register and login with email/password.
- **Authorization:** Role-based access (user, admin, manager) via middleware.
- **Validation:** Request bodies validated with Zod; consistent error responses.
- **Rate limiting:** Per-IP limits on `/api`; stricter limits on auth endpoints. Uses Redis when `REDIS_URI` is set.
- **Logging:** Winston with request/response logging middleware.
- **Error handling:** Central error handler; Mongoose validation errors mapped to JSON.
- **Pagination:** Supported on product list, user list, and order list (orders include `meta`).

## License

ISC
