/**
 * Steam-style review summary label from positive count and total count.
 * "Positive" = rating >= 4 (out of 5).
 */
const MIN_REVIEWS_FOR_LABEL = 5;

const LABELS = [
    { minPercent: 95, label: "Overwhelmingly Positive" },
    { minPercent: 80, label: "Very Positive" },
    { minPercent: 65, label: "Positive" },
    { minPercent: 50, label: "Mostly Positive" },
    { minPercent: 40, label: "Mixed" },
    { minPercent: 25, label: "Mostly Negative" },
    { minPercent: 15, label: "Negative" },
    { minPercent: 5, label: "Very Negative" },
    { minPercent: 0, label: "Overwhelmingly Negative" },
];

function getReviewSummary(reviewCount, positiveCount) {
    const total = Number(reviewCount) || 0;
    const positive = Number(positiveCount) || 0;
    if (total < MIN_REVIEWS_FOR_LABEL) {
        return {
            label: total === 0 ? "No reviews yet" : "Need more reviews",
            percentPositive: total > 0 ? Math.round((positive / total) * 100) : null,
            reviewCount: total,
        };
    }
    const percentPositive = Math.round((positive / total) * 100);
    const label = LABELS.find((b) => percentPositive >= b.minPercent)?.label || "Overwhelmingly Negative";
    return {
        label,
        percentPositive,
        reviewCount: total,
    };
}

module.exports = { getReviewSummary, MIN_REVIEWS_FOR_LABEL };
