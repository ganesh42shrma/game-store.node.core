const express = require("express");
const invoiceController = require("../controllers/invoice.controller");
const adminOrderController = require("../controllers/admin.order.controller");
const adminProductController = require("../controllers/admin.product.controller");
const adminAnalyticsController = require("../controllers/admin.analytics.controller");
const adminGameAgentController = require("../controllers/admin.game-agent.controller");
const authenticateJWT = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { requireRole } = require("../middlewares/rbac.middleware");
const { bulkProductFileUpload } = require("../middlewares/upload.middleware");
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
const { listAnalyticsQuerySchema } = require("../validators/analytics.schema");

const router = express.Router();

router.use(authenticateJWT);
router.use(requireRole(["admin"]));

router.get(
    "/analytics",
    validate(listAnalyticsQuerySchema, "query"),
    adminAnalyticsController.getAnalytics
);
router.get(
    "/orders",
    validate(listOrdersAdminQuerySchema, "query"),
    adminOrderController.listOrders
);
router.get(
    "/orders/:id",
    validate(orderIdParamSchema, "params"),
    adminOrderController.getOrder
);
router.patch(
    "/orders/:id",
    validate(orderIdParamSchema, "params"),
    validate(updateOrderStatusSchema),
    adminOrderController.updateOrderStatus
);
router.get("/products", adminProductController.listProducts);
router.post(
    "/products/bulk",
    bulkProductFileUpload,
    adminProductController.bulkUploadProducts
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
router.post("/products/agent", adminGameAgentController.createGameByAgent);

module.exports = router;
