const Product = require("../models/product.model");
const productAggregations = require("../aggregations/product.aggregations");

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//get all products
async function getAllProducts(queryParams) {
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
    } = queryParams;

    const filter = { isActive: true };
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

//create product 
async function createProduct(productData) {
    return Product.create(productData);
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
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductCoverImage,
};
