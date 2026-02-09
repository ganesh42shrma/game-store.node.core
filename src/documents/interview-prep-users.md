# Interview Prep: Users

**Feature:** User management and profile  
**Base path:** `/api/users`

---

## APIs

| Method | Path | Auth | Roles | Purpose |
|--------|------|------|-------|---------|
| GET | `/api/users` | No | — | List users (paginated, filter by role, isActive; sort, fields) |
| GET | `/api/users/me` | Yes | any | Current user profile (no password) |
| GET | `/api/users/:id` | Yes | admin | Get user by ID |
| POST | `/api/users` | Yes | admin, user | Create user (email, password, name, optional role) |
| POST | `/api/users/me/profile-picture` | Yes | any | Upload profile picture (multipart, field `image`) |
| PATCH | `/api/users/:id` | Yes | admin, user | Update user (all fields optional) |
| DELETE | `/api/users/:id` | Yes | admin | Delete user |

---

## Implementation

**Key files:**

- **Routes:** `src/routes/user.routes.js` — list is public; `me` and profile-picture use `authenticateJWT`; get by id uses `requireRole(["admin"])`; create/update use auth + validate + `requireRole(["admin", "user"])`; delete admin-only.
- **Controller:** `src/controllers/user.controller.js` — getUsers (query params to service), getMe (req.user.id), getUser (params.id), createUser/updateUser/deleteUser (params.id, body); uploadProfilePicture: read req.file, S3 key from uploadService, uploadToS3, then userService.updateUserProfilePicture.
- **Service:** `src/services/user.service.js` — getAllUsers: filter (role, isActive), select -password, optional fields/sort, skip/limit. getUserById: findById, select -password. createUser: bcrypt.hash(password, 10), User.create. updateUser: findByIdAndUpdate with new, runValidators, select -password. updateUserProfilePicture: set profilePicture URL. deleteUser: findByIdAndDelete.
- **Validators:** `src/validators/user.schema.js` — createUserSchema (email, password min 6, name required trimmed, role optional from USER_ROLES); updateUserSchema (all optional: email, password, name, role, isActive, profilePicture URL or "").

**Flow:** List users is unauthenticated for storefront use. All other operations require JWT. Password is always excluded in responses; create returns user without password. Profile picture: Multer stores file in memory, controller uploads to S3 (key like `users/:userId/profile-*.jpg`), then updates user.profilePicture with the returned URL.

---

## Interview Q&A

**Why is GET /api/users public?**  
So the frontend can list users without auth (e.g. for display or search). Sensitive operations (get by id, create, update, delete) are protected; get by id is admin-only so only admins can fetch any user’s full record.

**How is password never sent back?**  
We use `.select("-password")` on all read paths (getAllUsers, getUserById, updateUser, updateUserProfilePicture). createUser returns the created document with password omitted in the controller (`userWithoutPassword`). The model stores hashed password; we never include it in JSON.

**How does profile picture upload work?**  
Client sends multipart/form-data with field name `image`. Multer middleware (memory storage) validates type and size; controller gets req.file.buffer, builds S3 key via uploadService.userProfileImageKey(userId, originalname), uploads with uploadService.uploadToS3, then updates the user’s profilePicture with the public URL. Same Multer config as product image (allowed MIMEs, 5MB max).

**Who can create or update users?**  
Only authenticated users with role admin or user (requireRole(["admin", "user"])). The route doesn’t restrict “user” to only updating self; that could be enforced in controller/service by comparing req.user.id to params.id for non-admin.

**What happens when we delete a user?**  
findByIdAndDelete removes the document. Related data (orders, cart, reviews) may still reference the user ID; the app may rely on soft delete (isActive) elsewhere or handle orphans in other flows.

---

## Key takeaways

- List users is public; get by id is admin-only; create/update/delete require auth and appropriate roles.
- Password always excluded in responses; hashed with bcrypt (salt rounds 10) on create.
- Profile picture: Multer (memory) → S3 upload → user.profilePicture set to URL.
- Validators: name required and trimmed on create; role from USER_ROLES enum.
- updateUser uses findByIdAndUpdate with new: true and runValidators so we return the updated doc and run schema validators.
