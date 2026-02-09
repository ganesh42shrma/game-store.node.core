/**
 * Fetch all products, generate shortDescription and tags for each, then update in DB.
 * - shortDescription: truncated from description (max 300 chars, break at word boundary).
 * - tags: derived from genre, platform, and keyword extraction from description.
 *
 * Run from project root: node src/scripts/update-product-short-descriptions-and-tags.js
 * Uses .env for MONGODB_URI.
 */
require("dotenv").config();
const { connectDB } = require("../config/db");
const Product = require("../models/product.model");

const MAX_SHORT_DESC = 300;

function truncateToShortDescription(description) {
    if (!description || typeof description !== "string") return "";
    const trimmed = description.trim();
    if (trimmed.length <= MAX_SHORT_DESC) return trimmed;
    const slice = trimmed.slice(0, MAX_SHORT_DESC);
    const lastSpace = slice.lastIndexOf(" ");
    return lastSpace > MAX_SHORT_DESC / 2 ? slice.slice(0, lastSpace) : slice;
}

const DESCRIPTION_KEYWORDS = [
    { pattern: /\bopen[- ]?world\b/i, tag: "open-world" },
    { pattern: /\bmultiplayer\b/i, tag: "multiplayer" },
    { pattern: /\bco[- ]?op\b|\bcooperative\b/i, tag: "co-op" },
    { pattern: /\bonline\b/i, tag: "online" },
    { pattern: /\bsingle[- ]?player\b|\bsolo\b/i, tag: "singleplayer" },
    { pattern: /\bstory[- ]?driven\b|\bnarrative\b|\bcinematic\b/i, tag: "story-driven" },
    { pattern: /\bhorror\b|\bsurvival horror\b/i, tag: "horror" },
    { pattern: /\bracing\b|\bdriving\b/i, tag: "racing" },
    { pattern: /\bsimulation\b|\bsim\b/i, tag: "simulation" },
    { pattern: /\bplatformer\b|\bplatforming\b/i, tag: "platformer" },
    { pattern: /\bmetroidvania\b/i, tag: "metroidvania" },
    { pattern: /\bturn[- ]?based\b/i, tag: "turn-based" },
    { pattern: /\baction[- ]?rpg\b|\baction rpg\b/i, tag: "action-rpg" },
    { pattern: /\bfantasy\b/i, tag: "fantasy" },
    { pattern: /\bsci[- ]?fi\b|\bscience fiction\b/i, tag: "sci-fi" },
    { pattern: /\bremake\b|\breimagined\b/i, tag: "remake" },
];

function extractTagsFromDescription(description) {
    if (!description || typeof description !== "string") return [];
    const tags = [];
    for (const { pattern, tag } of DESCRIPTION_KEYWORDS) {
        if (pattern.test(description)) tags.push(tag);
    }
    return [...new Set(tags)];
}

function genreToTags(genre) {
    if (!genre || typeof genre !== "string") return [];
    return genre
        .split(/[\s,/-]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0 && s.length <= 50);
}

function buildTags(product) {
    const tags = new Set();
    const platform = (product.platform || "").toString().toLowerCase();
    if (platform) tags.add(platform);
    genreToTags(product.genre).forEach((t) => tags.add(t));
    extractTagsFromDescription(product.description || "").forEach((t) => tags.add(t));
    return [...tags].slice(0, 20);
}

async function main() {
    await connectDB();

    const products = await Product.find({}).lean();
    console.log("Found", products.length, "products. Generating shortDescription and tags...");

    let updated = 0;
    for (const p of products) {
        const shortDescription = truncateToShortDescription(p.description);
        const tags = buildTags(p);

        const result = await Product.findByIdAndUpdate(
            p._id,
            { shortDescription, tags },
            { new: true, runValidators: true }
        );
        if (result) {
            console.log("OK:", p.title, "| shortDesc:", shortDescription.length, "chars | tags:", result.tags?.length || 0);
            updated++;
        } else {
            console.error("Skip (not found):", p.title);
        }
    }

    console.log("Done. Updated", updated, "products.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
