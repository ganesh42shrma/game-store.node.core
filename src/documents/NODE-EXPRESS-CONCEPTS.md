# Node and Express Concepts — As Used in This Project

This document summarizes Node.js and Express concepts (and related libraries) as they appear in the Game Store API. Use it as a revision sheet for “how we did X in this project.”

---

## Express

### App setup

- **File:** `src/app.js`
- **Pattern:** Create app with `express()`, then attach middleware in order: CORS (custom OPTIONS + `cors()`), `express.json()`, `express.urlencoded({ extended: true })`, request logger, then route handler for `/health`, then `/api` with rate limit + routes. Finally 404 fallback and global error handler.
- **Important:** Middleware order matters. Body parsers must run before routes that read `req.body`; error handler must be last.

### Routing

- **File:** `src/routes/index.js`
- **Pattern:** One `Router` per feature (auth, products, users, cart, orders, etc.). Main router mounts them under paths like `/auth`, `/products`, `/cart`. The app mounts this single router at `/api`, so all API routes are under `/api/*`.
- **Example:** `router.use("/cart", cartRoutes)` → GET `/api/cart` is defined in `cart.routes.js`.

### Middleware chain

- **Pattern:** For a protected route: `authenticateJWT` → optional `requireRole([...])` → optional `validate(schema, "body"|"params"|"query")` → controller. Each middleware either calls `next()` or sends a response and does not call `next()`.
- **Error-handling middleware:** Four arguments `(err, req, res, next)`. In `app.js` it checks `err.name === "ValidationError"` (Mongoose) and returns 400 with `errors`; otherwise returns `err.statusCode` or 500 with `message`. Must be registered after all routes.

### CORS

- **File:** `src/app.js`
- **Pattern:** Origin allowlist from `CORS_ORIGIN` (comma-separated). Helper `isOriginAllowed(origin)` normalizes and checks. OPTIONS requests are handled first: if origin allowed, set `Access-Control-Allow-*` and return 204. Then `cors({ origin: function, credentials: true, methods, allowedHeaders })` so actual requests get the right origin. In dev, `http://localhost:5174` is added if not in env.

### Streaming / long-lived response (SSE)

- **File:** `src/controllers/events.controller.js`
- **Pattern:** For Server-Sent Events we never call `res.end()`. Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, optionally `X-Accel-Buffering: no`. Call `res.flushHeaders()`, then use `res.write("data: ...\n\n")` for each event. Subscribe to an in-memory broadcaster that calls this write callback on new events. On `req.on("close")`, unsubscribe so we don’t write to a closed socket.

---

## Authentication and authorization

### JWT

- **File:** `src/middlewares/auth.middleware.js`
- **Pattern:** Read `Authorization` header; if it doesn’t start with `"Bearer "`, return 401. Otherwise take the token string and `jwt.verify(token, process.env.JWT_SECRET)`. From decoded payload get `userId` (e.g. `decoded.sub` or `decoded.id`). Load user with `User.findById(userId)`; if not found or `!user.isActive`, return 401. Set `req.user = { id, email, role }` and call `next()`. On `TokenExpiredError` or invalid token, return 401.

### RBAC (role-based access control)

- **File:** `src/middlewares/rbac.middleware.js`
- **Pattern:** `requireRole(allowedRoles)` returns a middleware. It expects `req.user` (set by auth). If `req.user.role` is not in `allowedRoles`, respond with 403 and do not call `next()`. Used after `authenticateJWT` on admin/manager routes (e.g. product CRUD, admin analytics).

---

## Validation

- **Files:** `src/validators/*.schema.js` (Zod), `src/middlewares/validate.middleware.js`
- **Pattern:** Define Zod schemas (e.g. `loginSchema`, `createOrderSchema`). Middleware: `validate(schema, property)` where `property` is `"body"`, `"params"`, or `"query"`. It runs `schema.parse(req[property])` and assigns the result back to `req[property]`. On failure, Zod throws; we catch and return 400 with `{ success: false, message: "Validation failed", errors: [{ field, message }] }` (errors built from `error.issues`).

---

## Rate limiting

- **File:** `src/middlewares/rateLimit.middleware.js`
- **Pattern:** Factory `rateLimit({ windowMs, max, message })`. Identifier = `req.ip` or `req.socket?.remoteAddress`. Key = `rl:${identifier}:${windowSlot}` where `windowSlot` is floor of current time by `windowMs`. If Redis is available, use `INCR` + `PEXPIRE`; else in-memory `Map` with timeout to clear. Set response headers `X-RateLimit-Limit` and `X-RateLimit-Remaining`. If count > max, respond 429 with message. On Redis error, allow request and call `next()`.

---

## File uploads

- **Multer:** `src/middlewares/upload.middleware.js` — `multer.memoryStorage()`, single file with field name `"image"`, fileFilter for allowed MIME types, limits.fileSize. Middleware wraps `uploadSingleImage` and maps Multer errors to 400 JSON (e.g. LIMIT_FILE_SIZE).
- **S3:** `src/config/s3.js` — `S3Client` from `@aws-sdk/client-s3`, credentials from env; `getBucket()`, `getPublicBaseUrl()` for building URLs. `src/services/upload.service.js` — `PutObjectCommand` to upload buffer; keys like `products/:id/cover-*.jpg` and `users/:id/profile-*.jpg`. Returns public URL. If S3 not configured, throw error with statusCode 503.

---

## Node

### Async

- **Pattern:** Services use `async/await` and return Promises. Controllers are async and call `await service.method()`. In middleware that does async work (e.g. auth’s `User.findById`), use `.then().catch()` and call `next(err)` in catch so the global error handler runs.

### Config / env

- **File:** `src/config/env.js`
- **Pattern:** `dotenv.config()` in `loadEnv()`. Called at startup in `server.js` before requiring app so `process.env` is populated (e.g. CORS_ORIGIN, MONGODB_URI, JWT_SECRET).

### Logging

- **File:** `src/config/logger.js`
- **Pattern:** Winston logger with timestamp and custom format. Level from `LOG_LEVEL` or `"info"`. Single transport: Console (colorized in dev). Used in request logger, rate limiter, and global error handler (`logger.error`).

---

## Database (Mongoose)

### Connection

- **File:** `src/config/db.js`
- **Pattern:** `mongoose.connect(process.env.MONGODB_URI)`. On failure, log and `process.exit(1)`. Called in `server.js` after `loadEnv()`.

### Models and refs

- **Files:** `src/models/*.model.js`
- **Pattern:** Mongoose schemas with refs (e.g. Cart.user → User, Order.user → User, OrderItem.product → Product). Use `populate()` when returning orders with user info or product details. Passwords hashed with bcrypt; never returned in JSON.

### Aggregation

- **File:** `src/aggregations/product.aggregations.js`
- **Pattern:** Keep aggregation pipelines out of controllers. Example: `getAllDistinctTags()` — match products with non-empty tags, `$unwind` tags, `$group` by tag, `$sort`, `$project`. Example: `getRelatedByTags(productId, limit)` — find product’s tags, then aggregate products with `$in` tags, `$addFields` with `$setIntersection` size for ranking, `$sort` by match count, `$limit`.

---

## Other

### Redis

- **File:** `src/config/redis.js`
- **Pattern:** Singleton client via `getRedisClient()`. If `REDIS_URI` not set, return null. Used by rate limiter; if null, rate limiter uses in-memory Map (single-process only).

### Crypto

- **File:** `src/utils/generateSecret.js`
- **Pattern:** `crypto.randomBytes(32).toString("hex")` for generating secrets (e.g. for signing or env setup).

### External APIs

- **SendGrid:** Used in `src/services/mailer.service.js` for sending emails. Scripts (e.g. cart abandonment, sale notifications) use this service. Not part of the main API routes but part of the codebase.
