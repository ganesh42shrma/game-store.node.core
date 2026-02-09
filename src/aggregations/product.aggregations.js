/**
 * Product-related MongoDB aggregations. Keeps pipeline logic out of the service layer.
 */
const mongoose = require("mongoose");
const Product = require("../models/product.model");

/**
 * All distinct tag values across products (sorted). Used for tag filter suggestions and autocomplete.
 */
async function getAllDistinctTags() {
    const result = await Product.aggregate([
        { $match: { tags: { $exists: true, $ne: [] } } },
        { $unwind: "$tags" },
        { $group: { _id: "$tags" } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, tag: "$_id" } },
    ]);
    return result.map((r) => r.tag);
}

/**
 * Products that share at least one tag with the given product, ranked by number of matching tags.
 * Excludes the current product and inactive products.
 * @param {string} productId - Current product _id
 * @param {number} limit - Max results (1–20)
 * @returns {Promise<Array>} Related product documents (plain objects)
 */
async function getRelatedByTags(productId, limit = 6) {
    const product = await Product.findById(productId).select("tags").lean();
    if (!product || !Array.isArray(product.tags) || product.tags.length === 0) {
        return [];
    }
    const tagList = product.tags;
    const idObj = mongoose.isValidObjectId(productId) ? new mongoose.Types.ObjectId(productId) : productId;
    const cappedLimit = Math.max(1, Math.min(Number(limit) || 6, 20));

    const related = await Product.aggregate([
        {
            $match: {
                _id: { $ne: idObj },
                isActive: true,
                tags: { $in: tagList },
            },
        },
        {
            $addFields: {
                matchCount: { $size: { $setIntersection: ["$tags", tagList] } },
            },
        },
        { $sort: { matchCount: -1, _id: 1 } },
        { $limit: cappedLimit },
        { $project: { matchCount: 0 } },
    ]);
    return related;
}

module.exports = {
    getAllDistinctTags,
    getRelatedByTags,
};
