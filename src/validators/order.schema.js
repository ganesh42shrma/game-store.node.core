const { z } = require("zod");

// Create order from cart - no body required; optional empty object for future (e.g. addressId)
const createOrderSchema = z.object({}).optional();

module.exports = {
    createOrderSchema,
};
