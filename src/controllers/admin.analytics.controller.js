const analyticsService = require("../services/analytics.service");

async function getAnalytics(req, res, next) {
    try {
        const { from, to, groupBy, limit } = req.query;
        const [
            overview,
            revenueByPeriod,
            ordersByPeriod,
            topProducts,
            salesByPlatform,
            salesByGenre,
            reviewMetrics,
            userGrowth,
            llmAnalytics,
        ] = await Promise.all([
            analyticsService.getOverview(from, to),
            analyticsService.getRevenueByPeriod(from, to, groupBy),
            analyticsService.getOrdersByPeriod(from, to, groupBy),
            analyticsService.getTopProducts(from, to, limit),
            analyticsService.getSalesByPlatform(from, to),
            analyticsService.getSalesByGenre(from, to),
            analyticsService.getReviewMetrics(),
            analyticsService.getUserGrowth(from, to, groupBy),
            analyticsService.getLLMAnalytics(from, to, groupBy),
        ]);
        res.success({
            overview,
            revenueByPeriod,
            ordersByPeriod,
            topProducts,
            salesByPlatform,
            salesByGenre,
            reviewMetrics,
            userGrowth,
            llmAnalytics,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getAnalytics,
};
