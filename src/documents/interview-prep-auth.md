# Interview Prep: Auth

**Feature:** Authentication (register, login)  
**Base path:** `/api/auth`

---

## APIs

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/register` | No | Register with name, email, password; returns user + JWT |
| POST | `/api/auth/login` | No | Login with email, password; returns user + JWT |

Both auth routes use a **stricter rate limit**: 5 requests per minute per IP (vs 100/min globally on `/api`).

---

## Implementation

**Key files:**

- **Routes:** `src/routes/auth.routes.js` — rate limit (5/min), validate body, then controller.
- **Controller:** `src/controllers/auth.controller.js` — extracts body, calls auth service; returns 201 (register) or 200 (login), 409 (email exists), 401 (invalid credentials).
- **Service:** `src/services/auth.service.js` — register: check existing email (case-insensitive), create user via userService (password hashed there), then `signTokenAndUser`. Login: find user by email, bcrypt compare, check isActive, then `signTokenAndUser`. JWT payload: `sub` (userId), email, role; signed with `JWT_SECRET`, `expiresIn` from env (default 7d).
- **Validators:** `src/validators/auth.schema.js` — Zod: register (email, password min 6, name non-empty trimmed); login (email, password non-empty).

**Flow:** Request → auth rate limit → Zod validate → controller → service. Register: duplicate email → 409. Login: no user / wrong password / inactive → 401. Success: same shape `{ user: { id, email, name, role }, token, expiresIn }`.

---

## Interview Q&A

**How does login work?**  
Client sends POST with email and password. We look up user by email (lowercased), compare password with bcrypt, ensure user is active. If all pass, we build a JWT with `sub` (user id), email, role, sign with `JWT_SECRET` and return user (no password) plus token and expiresIn. Client stores the token and sends it in `Authorization: Bearer <token>` on protected routes.

**Why rate limit auth routes specifically?**  
To reduce brute-force and credential stuffing. We use 5 req/min per IP on register/login; the rest of the API has a higher limit. Same middleware, different options.

**How is the token validated on protected routes?**  
The auth middleware reads `Authorization`, extracts the Bearer token, verifies it with `jwt.verify(token, JWT_SECRET)`, loads the user from DB to ensure they exist and are active, then sets `req.user = { id, email, role }`. If any step fails, we return 401.

**What does register return on duplicate email?**  
The service returns `{ conflict: true }`; the controller responds with 409 and message "Email already registered". We don’t leak whether the email exists elsewhere.

**Where is the password hashed?**  
In the user service when creating the user (used by register and by admin user creation). We use bcrypt; the plain password is never stored.

---

## Key takeaways

- JWT in `Authorization: Bearer <token>`; payload includes `sub` (userId), email, role.
- Passwords hashed with bcrypt; never returned in API responses.
- Auth routes have stricter rate limit (5/min per IP).
- Email stored and looked up lowercased for case-insensitive login.
- Inactive users get 401 on login; auth middleware also rejects them on protected routes.
- Register validates name (required, trimmed); 409 for duplicate email.
