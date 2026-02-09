/**
 * Read short descriptions and tags from data/short-descriptions-and-tags.json (keyed by game title)
 * and update each matching product in the DB.
 *
 * Run from project root: node src/scripts/apply-short-descriptions-and-tags.js
 * Uses .env for MONGODB_URI.
 *
 * Optional: run export-product-descriptions.js first to snapshot current products; then edit
 * short-descriptions-and-tags.json (or generate it) and run this script to apply.
 */
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { connectDB } = require("../config/db");
const Product = require("../models/product.model");

const DATA_FILE = path.join(__dirname, "data", "short-descriptions-and-tags.json");

async function main() {
    if (!fs.existsSync(DATA_FILE)) {
        console.error("Data file not found:", DATA_FILE);
        console.error("Create it (e.g. from product-export.json) with keys = product title, value = { shortDescription, tags }.");
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    await connectDB();

    const products = await Product.find({}).lean();
    console.log("Loaded", products.length, "products. Data file has", Object.keys(data).length, "entries.");

    let updated = 0;
    let skipped = 0;

    for (const p of products) {
        const entry = data[p.title];
        if (!entry) {
            console.log("Skip (no data):", p.title);
            skipped++;
            continue;
        }

        const shortDescription = typeof entry.shortDescription === "string" ? entry.shortDescription.trim() : "";
        const tags = Array.isArray(entry.tags) ? entry.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : [];

        if (shortDescription.length > 300) {
            console.warn("Warn: shortDescription for", p.title, "exceeds 300 chars; truncating.");
        }

        const result = await Product.findByIdAndUpdate(
            p._id,
            {
                shortDescription: shortDescription.slice(0, 300),
                tags: tags.slice(0, 20),
            },
            { new: true, runValidators: true }
        );

        if (result) {
            console.log("OK:", p.title, "| shortDesc:", result.shortDescription?.length || 0, "chars | tags:", result.tags?.length || 0);
            updated++;
        } else {
            console.error("Update failed:", p.title);
        }
    }

    console.log("Done. Updated:", updated, "Skipped:", skipped);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
