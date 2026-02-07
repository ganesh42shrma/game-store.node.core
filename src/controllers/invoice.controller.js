const invoiceService = require("../services/invoice.service");

async function getInvoiceByOrderId(req, res, next) {
    try {
        const orderId = req.params.id;
        const invoice = await invoiceService.getInvoiceByOrderId(
            orderId,
            req.user.id
        );
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found for this order",
            });
        }
        res.status(200).json({
            success: true,
            data: invoice,
        });
    } catch (error) {
        next(error);
    }
}

async function getInvoice(req, res, next) {
    try {
        const invoice = await invoiceService.getInvoiceById(
            req.params.id,
            req.user.id,
            false
        );
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found",
            });
        }
        res.status(200).json({
            success: true,
            data: invoice,
        });
    } catch (error) {
        next(error);
    }
}

async function listInvoices(req, res, next) {
    try {
        const result = await invoiceService.listInvoices(req.query);
        res.status(200).json({
            success: true,
            data: result.invoices,
            meta: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                totalPages: result.totalPages,
            },
        });
    } catch (error) {
        next(error);
    }
}

async function getInvoiceAdmin(req, res, next) {
    try {
        const invoice = await invoiceService.getInvoiceById(
            req.params.id,
            req.user.id,
            true
        );
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found",
            });
        }
        res.status(200).json({
            success: true,
            data: invoice,
        });
    } catch (error) {
        next(error);
    }
}

async function updateInvoice(req, res, next) {
    try {
        const invoice = await invoiceService.updateInvoice(
            req.params.id,
            req.body
        );
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found",
            });
        }
        res.status(200).json({
            success: true,
            data: invoice,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getInvoiceByOrderId,
    getInvoice,
    listInvoices,
    getInvoiceAdmin,
    updateInvoice,
};
