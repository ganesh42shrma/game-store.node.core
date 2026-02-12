const Product = require("../models/product.model");
const productAggregations = require("../aggregations/product.aggregations");
const { createProductSchema } = require("../validators/product.schema");

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//get all products
// options.includeInactive: if true, do not filter by isActive (for admin: show all products)
async function getAllProducts(queryParams, options = {}) {
    const {
        platform,
        genre,
        minPrice,
        maxPrice,
        search,
        q,
        tag,
        tags,
        fields,
        sort,
        page = 1,
        limit = 10,
        isActive,
    } = queryParams;

    const filter = {};
    if (!options.includeInactive) {
        filter.isActive = true;
    } else if (isActive !== undefined && isActive !== "") {
        const active = isActive === "true" || isActive === true;
        filter.isActive = active;
    }
    if (platform) {
        filter.platform = platform;
    }
    if (genre) {
        filter.genre = genre;
    }
    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    const tagValues = tag ? [tag] : Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : [];
    if (tagValues.length > 0) {
        filter.tags = tagValues.length === 1 ? tagValues[0] : { $in: tagValues };
    }
    const searchTerm = search || q;
    if (searchTerm && typeof searchTerm === "string" && searchTerm.trim()) {
        const escaped = escapeRegex(searchTerm.trim());
        const regex = new RegExp(escaped, "i");
        filter.$or = [
            { title: regex },
            { description: regex },
            { shortDescription: regex },
            { genre: regex },
            { tags: regex },
        ];
    }

    let query = Product.find(filter);
    if (fields) {
        const projection = fields.split(",").join(" ");
        query = query.select(projection);
    }
    if (sort) {
        const sortBy = sort.split(",").join(" ") + " _id";
        query = query.sort(sortBy);
    } else {
        query = query.sort("-createdAt _id");
    }
    const skip = (Number(page) - 1) * Number(limit);
    query = query.skip(skip).limit(Number(limit));
    return query;
};

//get all distinct tags across products (for admin autocomplete / suggestions when creating or editing products)
async function getAllTags() {
    return productAggregations.getAllDistinctTags();
}

//get related products by shared tags (for product details page "similar games")
async function getRelatedProducts(productId, limit = 6) {
    return productAggregations.getRelatedByTags(productId, limit);
}

//get one product item
async function getProductById(productId) {
    return Product.findById(productId);
};

// find a product by title (case-insensitive, partial match). Returns first match or null. For agent: check if game exists.
async function findProductByTitle(title) {
    if (!title || typeof title !== "string" || !title.trim()) return null;
    const escaped = escapeRegex(title.trim());
    const regex = new RegExp(escaped, "i");
    return Product.findOne({ title: regex }).lean();
}

//create product 
async function createProduct(productData) {
    return Product.create(productData);
}

const PLATFORMS = ["PC", "PS5", "XBOX", "SWITCH"];

function normalizeBulkRow(row, index) {
    const toNum = (v) => (v !== "" && v != null && !Number.isNaN(Number(v)) ? Number(v) : undefined);
    const toBool = (v) => v === true || v === "true" || v === "1" || v === 1;
    const toArr = (v) =>
        Array.isArray(v) ? v : typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const platform = typeof row.platform === "string" ? row.platform.trim().toUpperCase() : row.platform;
    return {
        title: row.title != null ? String(row.title).trim() : undefined,
        description: row.description != null ? String(row.description).trim() : undefined,
        shortDescription: row.shortDescription != null ? String(row.shortDescription).trim() : "",
        price: toNum(row.price),
        isOnSale: row.isOnSale != null ? toBool(row.isOnSale) : false,
        discountedPrice: row.discountedPrice != null && row.discountedPrice !== "" ? toNum(row.discountedPrice) : null,
        platform: PLATFORMS.includes(platform) ? platform : undefined,
        genre: row.genre != null ? String(row.genre).trim() : undefined,
        stock: row.stock != null ? Math.max(0, Math.floor(Number(row.stock)) || 0) : 0,
        isActive: row.isActive != null ? toBool(row.isActive) : true,
        tags: toArr(row.tags || []),
        youtubeLinks: toArr(row.youtubeLinks || []),
        _bulkIndex: index,
    };
}

/**
 * Bulk create products from an array of row objects (e.g. from CSV or JSON).
 * Each row is normalized and validated; valid rows are created, invalid ones are reported.
 * @param {Array<object>} rows - Array of product-like objects (strings/numbers from CSV or JSON)
 * @returns {{ created: number, failed: number, products: Array, errors: Array<{ index: number, message: string }> }}
 */
async function bulkCreateProducts(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return { created: 0, failed: 0, products: [], errors: [{ index: -1, message: "No rows provided" }] };
    }
    const products = [];
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        if (raw == null || typeof raw !== "object") {
            errors.push({ index: i + 1, message: "Invalid row: must be an object" });
            continue;
        }
        const normalized = normalizeBulkRow(raw, i + 1);
        const parsed = createProductSchema.safeParse(normalized);
        if (!parsed.success) {
            const issues = parsed.error?.issues || [];
            const message = issues.length
                ? issues.map((i) => i.message).join("; ")
                : parsed.error?.message || "Validation failed";
            errors.push({ index: i + 1, message, title: normalized.title });
            continue;
        }
        try {
            const created = await Product.create(parsed.data);
            products.push(created);
        } catch (err) {
            errors.push({
                index: i + 1,
                message: err.message || "Failed to create product",
                title: normalized.title,
            });
        }
    }
    return {
        created: products.length,
        failed: errors.length,
        products,
        errors,
    };
}

//update product
async function updateProduct(id, updateData) {
    return Product.findByIdAndUpdate(id, updateData, {
        new: true, // return updated product,
        runValidators: true, //schema validation on updates
    })
}

//delete product
async function deleteProduct(productId) {
    return Product.findByIdAndDelete(productId);
}

//update product cover image URL
async function updateProductCoverImage(productId, coverImageUrl) {
    return Product.findByIdAndUpdate(
        productId,
        { coverImage: coverImageUrl },
        { new: true, runValidators: true }
    );
}

module.exports = {
    getAllProducts,
    getAllTags,
    getRelatedProducts,
    getProductById,
    findProductByTitle,
    createProduct,
    bulkCreateProducts,
    updateProduct,
    deleteProduct,
    updateProductCoverImage,
};
