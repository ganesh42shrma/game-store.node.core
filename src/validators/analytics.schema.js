const { z } = require("zod");

const listAnalyticsQuerySchema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    groupBy: z.enum(["day", "week", "month"]).optional().default("day"),
    limit: z.coerce.number().int().min(1).max(50).optional(),
});

module.exports = {
    listAnalyticsQuerySchema,
};
