const express = require("express");
const invoiceController = require("../controllers/invoice.controller");
const adminOrderController = require("../controllers/admin.order.controller");
const authenticateJWT = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { requireRole } = require("../middlewares/rbac.middleware");
const {
    invoiceIdParamSchema,
    listInvoicesQuerySchema,
    updateInvoiceSchema,
} = require("../validators/invoice.schema");
const {
    orderIdParamSchema,
    updateOrderStatusSchema,
    listOrdersAdminQuerySchema,
} = require("../validators/order.schema");

const router = express.Router();

router.use(authenticateJWT);
router.use(requireRole(["admin"]));

router.get(
    "/orders",
    validate(listOrdersAdminQuerySchema, "query"),
    adminOrderController.listOrders
);
router.patch(
    "/orders/:id",
    validate(orderIdParamSchema, "params"),
    validate(updateOrderStatusSchema),
    adminOrderController.updateOrderStatus
);
router.get(
    "/invoices",
    validate(listInvoicesQuerySchema, "query"),
    invoiceController.listInvoices
);
router.get(
    "/invoices/:id",
    validate(invoiceIdParamSchema, "params"),
    invoiceController.getInvoiceAdmin
);
router.patch(
    "/invoices/:id",
    validate(invoiceIdParamSchema, "params"),
    validate(updateInvoiceSchema),
    invoiceController.updateInvoice
);

module.exports = router;
