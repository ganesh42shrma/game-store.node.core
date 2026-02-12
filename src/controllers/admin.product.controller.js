const { parse } = require("csv-parse/sync");
const productService = require("../services/product.service");

/**
 * List all products (including inactive). Same query params as GET /api/products (page, limit, sort, platform, genre, etc.).
 * Optional query isActive=true|false to filter by active status.
 */
async function listProducts(req, res, next) {
    try {
        const products = await productService.getAllProducts(req.query, { includeInactive: true });
        res.success(products);
    } catch (error) {
        next(error);
    }
}

/**
 * Bulk upload products from CSV or JSON file.
 * Expects multipart/form-data with field name "file".
 * CSV: first row = headers (title, description, price, platform, genre, stock, etc.).
 * JSON: array of product objects or { "products": [...] }.
 */
async function bulkUploadProducts(req, res, next) {
    try {
        if (!req.file || !req.file.buffer) {
            return res.sendError("No file provided. Use multipart/form-data with field name 'file' (CSV or JSON).", 400);
        }

        const buffer = req.file.buffer;
        const mimetype = (req.file.mimetype || "").toLowerCase();
        const filename = (req.file.originalname || "").toLowerCase();
        let rows = [];

        const isJson =
            mimetype === "application/json" ||
            filename.endsWith(".json");
        const isCsv =
            mimetype === "text/csv" ||
            mimetype === "text/plain" ||
            filename.endsWith(".csv");

        if (isJson) {
            const text = buffer.toString("utf8");
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                return res.sendError("Invalid JSON: " + (e.message || "parse error"), 400);
            }
            rows = Array.isArray(data) ? data : data.products;
            if (!Array.isArray(rows)) {
                return res.sendError("JSON must be an array of products or an object with 'products' array.", 400);
            }
        } else if (isCsv) {
            const text = buffer.toString("utf8");
            try {
                const records = parse(text, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                    relax_column_count: true,
                });
                rows = records;
            } catch (e) {
                return res.sendError("Invalid CSV: " + (e.message || "parse error"), 400);
            }
        } else {
            return res.sendError("File must be CSV or JSON (by extension or Content-Type).", 400);
        }

        if (rows.length === 0) {
            return res.sendError("File contains no rows to import.", 400);
        }

        const result = await productService.bulkCreateProducts(rows);

        res.success({
            created: result.created,
            failed: result.failed,
            total: rows.length,
            products: result.products,
            errors: result.errors,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    listProducts,
    bulkUploadProducts,
};
