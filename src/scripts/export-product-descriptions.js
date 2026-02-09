/**
 * Fetch all products from the DB and save _id, title, and description to a JSON file.
 * Use this to get a snapshot of current game names and descriptions before adding
 * short descriptions and tags (e.g. edit the export or use a separate data file).
 *
 * Run from project root: node src/scripts/export-product-descriptions.js
 * Uses .env for MONGODB_URI.
 * Output: src/scripts/data/product-export.json
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { connectDB } = require("../config/db");
const Product = require("../models/product.model");

const DATA_DIR = path.join(__dirname, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "product-export.json");

async function main() {
    await connectDB();

    const products = await Product.find({})
        .select("_id title description")
        .lean();

    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const payload = products.map((p) => ({
        _id: p._id.toString(),
        title: p.title,
        description: p.description || "",
    }));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf8");
    console.log("Exported", payload.length, "products to", OUTPUT_FILE);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
