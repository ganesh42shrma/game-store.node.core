const { z } = require("zod");

const objectIdRegex = /^[a-f0-9]{24}$/i;

const createAddressSchema = z.object({
    label: z.string().trim().optional(),
    line1: z.string().min(1, "Address line 1 is required").trim(),
    line2: z.string().trim().optional(),
    city: z.string().min(1, "City is required").trim(),
    state: z.string().min(1, "State is required").trim(),
    pincode: z.string().min(1, "Pincode is required").trim(),
    country: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    isDefault: z.boolean().optional(),
});

const updateAddressSchema = z.object({
    label: z.string().trim().optional(),
    line1: z.string().min(1).trim().optional(),
    line2: z.string().trim().optional(),
    city: z.string().min(1).trim().optional(),
    state: z.string().min(1).trim().optional(),
    pincode: z.string().min(1).trim().optional(),
    country: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    isDefault: z.boolean().optional(),
});

const addressIdParamSchema = z.object({
    id: z.string().regex(objectIdRegex, "Invalid address ID"),
});

module.exports = {
    createAddressSchema,
    updateAddressSchema,
    addressIdParamSchema,
};