const express = require("express");
const userController = require("../controllers/user.controller");
const validate = require("../middlewares/validate.middleware");
const { requireRole } = require("../middlewares/rbac.middleware");
const authenticateJWT = require("../middlewares/auth.middleware");
const { productImageUpload } = require("../middlewares/upload.middleware");
const {
    createUserSchema,
    updateUserSchema,
} = require("../validators/user.schema");

const router = express.Router();

// To restrict by role, add requireRole(["admin", "manager"]) before the controller, e.g.:
// router.get("/", requireRole(["admin"]), userController.getUsers);
router.get("/", userController.getUsers);
router.get("/me", authenticateJWT, userController.getMe);
router.post("/me/profile-picture", authenticateJWT, productImageUpload, userController.uploadProfilePicture);
router.get("/:id", requireRole(["admin"]), userController.getUser);
router.post("/", authenticateJWT, validate(createUserSchema), requireRole(["admin", "user"]), userController.createUser);
router.patch("/:id", authenticateJWT, validate(updateUserSchema), requireRole(["admin", "user"]), userController.updateUser);
router.delete("/:id", authenticateJWT, requireRole(["admin"]), userController.deleteUser);

module.exports = router;
