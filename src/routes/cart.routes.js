const express = require("express");
const cartController = require("../controllers/cart.controller");
const authenticateJWT = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { addCartItemSchema, updateCartItemSchema } = require("../validators/cart.schema");

const router = express.Router();

router.use(authenticateJWT);

router.get("/", cartController.getCart);
router.post("/items", validate(addCartItemSchema), cartController.addItem);
router.patch("/items/:productId", validate(updateCartItemSchema), cartController.updateItem);
router.delete("/items/:productId", cartController.removeItem);
router.delete("/", cartController.clearCart);

module.exports = router;
