/**
 * Fetch all products and output each product's cover image (S3) link.
 * Run: node src/scripts/list-product-cover-images.js
 * Env: API_BASE_URL (optional, default http://localhost:5000)
 */
require("dotenv").config();

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

async function main() {
    let page = 1;
    const limit = 50;
    const all = [];

    do {
        const res = await fetch(
            `${API_BASE_URL}/api/products?page=${page}&limit=${limit}`
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
            console.error("Failed to fetch products:", json.message || res.statusText);
            process.exit(1);
        }
        if (!json.data.length) break;
        all.push(...json.data);
        if (json.data.length < limit) break;
        page++;
    } while (true);

    console.log("Product cover image (S3) links\n");
    console.log("Title | Cover Image URL");
    console.log("-".repeat(80));

    const urls = [];
    for (const p of all) {
        const url = p.coverImage || "(none)";
        urls.push(url);
        console.log(`${p.title} | ${url}`);
    }

    console.log("\n--- All cover image URLs (one per line) ---");
    urls.forEach((u) => console.log(u));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
