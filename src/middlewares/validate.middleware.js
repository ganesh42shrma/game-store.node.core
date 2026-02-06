const validate = (schema, property = "body") => {
    return (req, res, next) => {
        try {
            req[property] = schema.parse(req[property]);
            next();
        } catch (error) {
            const issues = error.issues;
            const errors = Array.isArray(issues)
                ? issues.map((e) => ({
                    field: (e.path || []).join("."),
                    message: e.message,
                }))
                : [{ field: "validation", message: error.message || "Validation failed" }];
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors,
            });
        }
    };
};

module.exports = validate;