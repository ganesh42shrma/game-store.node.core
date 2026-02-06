const Product = require("../models/product.model");

//get all products
async function getAllProducts(queryParams) {
    const {
        platform,
        genre,
        minPrice,
        maxPrice,
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
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductCoverImage,
};
