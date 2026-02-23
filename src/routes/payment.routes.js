const express = require("express");
const paymentController = require("../controllers/payment.controller");
const authenticateJWT = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
    createPaymentSchema,
    paymentIdParamSchema,
    createRazorpayOrderSchema,
    verifyRazorpaySchema,
} = require("../validators/payment.schema");

const router = express.Router();

router.use(authenticateJWT);

// Note: `createPayment` and `confirmPayment` handlers were removed/commented
// in the controller. Keep only routes that have implemented handlers.
router.get(
    "/:id",
    validate(paymentIdParamSchema, "params"),
    paymentController.getPayment
);
router.post("/razorpay/create-order", validate(createRazorpayOrderSchema), paymentController.createRazorpayOrder);
router.post("/razorpay/verify", validate(verifyRazorpaySchema), paymentController.verifyRazorpayPayment);

module.exports = router;
