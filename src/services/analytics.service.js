const Order = require("../models/order.model");
const User = require("../models/user.model");
const Product = require("../models/product.model");
const Review = require("../models/review.model");

const LOW_STOCK_THRESHOLD = 5;
const DEFAULT_DAYS_RANGE = 30;
const DEFAULT_TOP_PRODUCTS_LIMIT = 10;
const MAX_TOP_PRODUCTS_LIMIT = 50;

function defaultTimeRange(from, to) {
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(end);
    if (!from && !to) {
        start.setDate(start.getDate() - DEFAULT_DAYS_RANGE);
    }
    return { start, end };
}

function getDateFormat(groupBy) {
    switch (groupBy) {
        case "week":
            return "%Y-W%V";
        case "month":
            return "%Y-%m";
        default:
            return "%Y-%m-%d";
    }
}

/**
 * Overview KPIs: revenue, order counts, users, products, low stock, orders by status.
 * If from/to provided, revenue is scoped to paid orders with paidAt in range; order counts to createdAt in range.
 */
async function getOverview(from, to) {
    const hasRange = Boolean(from || to);
    const paidMatch = { paymentStatus: "paid" };
    if (hasRange) {
        paidMatch.paidAt = {};
        if (from) paidMatch.paidAt.$gte = new Date(from);
        if (to) paidMatch.paidAt.$lte = new Date(to);
        if (Object.keys(paidMatch.paidAt).length === 0) delete paidMatch.paidAt;
    }
    const orderMatch = hasRange ? { createdAt: {} } : {};
    if (hasRange) {
        if (from) orderMatch.createdAt.$gte = new Date(from);
        if (to) orderMatch.createdAt.$lte = new Date(to);
    }

    const [revenueResult, totalOrderCount, statusCounts, totalUsers, totalProducts, lowStockCount] =
        await Promise.all([
            Order.aggregate([
                { $match: paidMatch },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
                { $project: { _id: 0, total: 1 } },
            ]).then((r) => (r[0] ? r[0].total : 0)),
            hasRange ? Order.countDocuments(orderMatch) : Order.countDocuments(),
            Order.aggregate([
                ...(hasRange ? [{ $match: orderMatch }] : []),
                { $group: { _id: "$status", count: { $sum: 1 } } },
                { $project: { _id: 0, status: "$_id", count: 1 } },
            ]),
            User.countDocuments({ isActive: true }),
            Product.countDocuments({ isActive: true }),
            Product.countDocuments({ isActive: true, stock: { $lt: LOW_STOCK_THRESHOLD } }),
        ]);

    const ordersByStatus = { pending: 0, completed: 0, cancelled: 0 };
    for (const row of statusCounts) {
        if (row.status && ordersByStatus[row.status] !== undefined) {
            ordersByStatus[row.status] = row.count;
        }
    }
    const totalOrders = totalOrderCount;
    const completedOrders = ordersByStatus.completed || 0;

    return {
        totalRevenue: Math.round((revenueResult || 0) * 100) / 100,
        totalOrders,
        completedOrders,
        totalUsers,
        totalProducts,
        lowStockCount,
        ordersByStatus,
    };
}

/**
 * Revenue and order count per period (day/week/month). Paid orders only; bucket by paidAt (fallback createdAt).
 */
async function getRevenueByPeriod(from, to, groupBy) {
    const { start, end } = defaultTimeRange(from, to);
    const format = getDateFormat(groupBy);
    const result = await Order.aggregate([
        {
            $match: {
                paymentStatus: "paid",
                $expr: {
                    $and: [
                        { $gte: [{ $ifNull: ["$paidAt", "$createdAt"] }, start] },
                        { $lte: [{ $ifNull: ["$paidAt", "$createdAt"] }, end] },
                    ],
                },
            },
        },
        {
            $group: {
                _id: { $dateToString: { date: { $ifNull: ["$paidAt", "$createdAt"] }, format } },
                revenue: { $sum: "$totalAmount" },
                orderCount: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
        { $project: { date: "$_id", revenue: { $round: ["$revenue", 2] }, orderCount: 1, _id: 0 } },
    ]);
    return result;
}

/**
 * Order count per period (all statuses). Bucket by createdAt.
 */
async function getOrdersByPeriod(from, to, groupBy) {
    const { start, end } = defaultTimeRange(from, to);
    const format = getDateFormat(groupBy);
    const result = await Order.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
            $group: {
                _id: { $dateToString: { date: "$createdAt", format } },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
        { $project: { date: "$_id", count: 1, _id: 0 } },
    ]);
    return result;
}

/**
 * Top products by revenue (from paid order line items). Optional from/to on paidAt (or createdAt).
 */
async function getTopProducts(from, to, limit = DEFAULT_TOP_PRODUCTS_LIMIT) {
    const cap = Math.min(Math.max(1, Number(limit) || DEFAULT_TOP_PRODUCTS_LIMIT), MAX_TOP_PRODUCTS_LIMIT);
    const match = { paymentStatus: "paid" };
    if (from || to) {
        const start = from ? new Date(from) : new Date(0);
        const end = to ? new Date(to) : new Date("9999");
        match.$expr = {
            $and: [
                { $gte: [{ $ifNull: ["$paidAt", "$createdAt"] }, start] },
                { $lte: [{ $ifNull: ["$paidAt", "$createdAt"] }, end] },
            ],
        };
    }
    const pipeline = [
        { $match: match },
        { $unwind: "$items" },
        { $addFields: { lineRevenue: { $multiply: ["$items.quantity", "$items.price"] } } },
        {
            $group: {
                _id: "$items.product",
                quantitySold: { $sum: "$items.quantity" },
                revenue: { $sum: "$lineRevenue" },
            },
        },
        { $sort: { revenue: -1 } },
        { $limit: cap },
        {
            $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "product",
                pipeline: [{ $project: { title: 1, platform: 1 } }],
            },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0,
                productId: { $toString: "$_id" },
                title: "$product.title",
                platform: "$product.platform",
                quantitySold: 1,
                revenue: { $round: ["$revenue", 2] },
            },
        },
    ];
    const result = await Order.aggregate(pipeline);
    return result;
}

/**
 * Sales (revenue and order count) by product platform. Paid orders only; optional from/to.
 */
async function getSalesByPlatform(from, to) {
    const match = { paymentStatus: "paid" };
    if (from || to) {
        const start = from ? new Date(from) : new Date(0);
        const end = to ? new Date(to) : new Date("9999");
        match.$expr = {
            $and: [
                { $gte: [{ $ifNull: ["$paidAt", "$createdAt"] }, start] },
                { $lte: [{ $ifNull: ["$paidAt", "$createdAt"] }, end] },
            ],
        };
    }
    const pipeline = [
        { $match: match },
        { $unwind: "$items" },
        { $addFields: { lineRevenue: { $multiply: ["$items.quantity", "$items.price"] } } },
        {
            $lookup: {
                from: "products",
                localField: "items.product",
                foreignField: "_id",
                as: "prod",
                pipeline: [{ $project: { platform: 1 } }],
            },
        },
        { $unwind: { path: "$prod", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: "$prod.platform",
                revenue: { $sum: "$lineRevenue" },
                orderCount: { $sum: 1 },
            },
        },
        { $sort: { revenue: -1 } },
        { $project: { _id: 0, platform: "$_id", revenue: { $round: ["$revenue", 2] }, orderCount: 1 } },
    ];
    const result = await Order.aggregate(pipeline);
    return result.map((r) => ({ platform: r.platform ?? "Unknown", revenue: r.revenue, orderCount: r.orderCount }));
}

/**
 * Sales (revenue and order count) by product genre. Paid orders only; optional from/to.
 */
async function getSalesByGenre(from, to) {
    const match = { paymentStatus: "paid" };
    if (from || to) {
        const start = from ? new Date(from) : new Date(0);
        const end = to ? new Date(to) : new Date("9999");
        match.$expr = {
            $and: [
                { $gte: [{ $ifNull: ["$paidAt", "$createdAt"] }, start] },
                { $lte: [{ $ifNull: ["$paidAt", "$createdAt"] }, end] },
            ],
        };
    }
    const pipeline = [
        { $match: match },
        { $unwind: "$items" },
        { $addFields: { lineRevenue: { $multiply: ["$items.quantity", "$items.price"] } } },
        {
            $lookup: {
                from: "products",
                localField: "items.product",
                foreignField: "_id",
                as: "prod",
                pipeline: [{ $project: { genre: 1 } }],
            },
        },
        { $unwind: { path: "$prod", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: "$prod.genre",
                revenue: { $sum: "$lineRevenue" },
                orderCount: { $sum: 1 },
            },
        },
        { $sort: { revenue: -1 } },
        { $project: { _id: 0, genre: "$_id", revenue: { $round: ["$revenue", 2] }, orderCount: 1 } },
    ];
    const result = await Order.aggregate(pipeline);
    return result.map((r) => ({ genre: r.genre ?? "Unknown", revenue: r.revenue, orderCount: r.orderCount }));
}

/**
 * Total review count and store-wide average rating.
 */
async function getReviewMetrics() {
    const [totalReviews, avgResult] = await Promise.all([
        Review.countDocuments(),
        Review.aggregate([{ $group: { _id: null, avg: { $avg: "$rating" } } }, { $project: { _id: 0, avg: { $round: ["$avg", 2] } } }]),
    ]);
    const averageRating = avgResult[0]?.avg ?? 0;
    return { totalReviews, averageRating };
}

/**
 * User registrations per period (day/week/month). Bucket by createdAt.
 */
async function getUserGrowth(from, to, groupBy) {
    const { start, end } = defaultTimeRange(from, to);
    const format = getDateFormat(groupBy);
    const result = await User.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: { $dateToString: { date: "$createdAt", format } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { date: "$_id", count: 1, _id: 0 } },
    ]);
    return result;
}

module.exports = {
    getOverview,
    getRevenueByPeriod,
    getOrdersByPeriod,
    getTopProducts,
    getSalesByPlatform,
    getSalesByGenre,
    getReviewMetrics,
    getUserGrowth,
};
