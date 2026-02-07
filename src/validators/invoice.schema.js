const { z } = require("zod");
const { INVOICE_STATUS } = require("../models/invoice.model");

const objectIdRegex = /^[a-f0-9]{24}$/i;

const invoiceIdParamSchema = z.object({
    id: z.string().regex(objectIdRegex, "Invalid invoice ID"),
});

const listInvoicesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    userId: z.string().regex(objectIdRegex).optional(),
    orderId: z.string().regex(objectIdRegex).optional(),
    status: z.enum(INVOICE_STATUS).optional(),
});

const updateInvoiceSchema = z.object({
    status: z.enum(INVOICE_STATUS).optional(),
    notes: z.string().optional(),
});

module.exports = {
    invoiceIdParamSchema,
    listInvoicesQuerySchema,
    updateInvoiceSchema,
};
