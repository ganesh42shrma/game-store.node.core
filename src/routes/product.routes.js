const express = require("express");
const ProductController = require("../controllers/product.controller");
const validate = require("../middlewares/validate.middleware");
const authenticateJWT = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/rbac.middleware");
const { productImageUpload } = require("../middlewares/upload.middleware");
const {
    createProductSchema,
    updateProductSchema,
} = require("../validators/product.schema");

const router = express.Router();

router.get("/", ProductController.getProducts);
router.get("/:id", ProductController.getProduct);

router.post("/", authenticateJWT, validate(createProductSchema), requireRole(["admin", "manager"]), ProductController.createProduct);
router.patch("/:id", authenticateJWT, validate(updateProductSchema), requireRole(["admin", "manager"]), ProductController.updateProduct);
router.delete("/:id", authenticateJWT, requireRole(["admin", "manager"]), ProductController.deleteProduct);

router.post("/:id/image", authenticateJWT, requireRole(["admin", "manager"]), productImageUpload, ProductController.uploadProductImage);

module.exports = router;