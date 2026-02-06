/**
 * Update product youtubeLinks via API (IGN and Gameranx videos).
 * Skips Metroid Dread (already done).
 * Run: node src/scripts/update-product-youtube-links.js
 * Env: API_BASE_URL, JWT_TOKEN (or set below)
 */
require("dotenv").config();

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";
const JWT =
    process.env.JWT_TOKEN ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTg1OGQ2NjQ1NDI1MDY0Mzc0MjAzODUiLCJlbWFpbCI6ImFkbWluQGdhbWVzdG9yZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzAzODM0NjEsImV4cCI6MTc3MDk4ODI2MX0.uVcHZ3lDJo4RW_czQmJLIV5WXTBD6s_OLTfMOsKst8o";

const SKIP_TITLES = new Set(["Metroid Dread"]);

const YOUTUBE_LINKS = {
    "Elden Ring": [
        "https://www.youtube.com/watch?v=y4Q9130iMyA",
        "https://www.youtube.com/watch?v=InhfVKgYwdc",
    ],
    "Cyberpunk 2077": [
        "https://www.youtube.com/watch?v=z1rUP17fayA",
        "https://www.youtube.com/watch?v=_tLn0BjUDR8",
    ],
    "God of War Ragnarok": ["https://www.youtube.com/watch?v=SJm2uhQXbXE"],
    "The Legend of Zelda: Tears of the Kingdom": [
        "https://www.youtube.com/watch?v=l2P5PgL1LfI",
    ],
    "Super Mario Odyssey": ["https://www.youtube.com/watch?v=alV4psOH9U4"],
    "Halo Infinite": ["https://www.youtube.com/watch?v=X4IOJfAvbUA"],
    "Forza Horizon 5": ["https://www.youtube.com/watch?v=aBQhsMe2noE"],
    "Marvel's Spider-Man 2": ["https://www.youtube.com/watch?v=bB6K70-322U"],
    "Baldur's Gate 3": [
        "https://www.youtube.com/watch?v=JtgoP6uHRe4",
        "https://www.youtube.com/watch?v=GhUXwcYqLdg",
    ],
    "Red Dead Redemption 2": [
        "https://www.youtube.com/watch?v=wKdcRjpTpFk",
    ],
    "The Last of Us Part II": ["https://www.youtube.com/watch?v=GbHfvtxTrk0"],
    "Animal Crossing: New Horizons": [
        "https://www.youtube.com/watch?v=w6zOGtp9rvM",
    ],
    "Grand Theft Auto V": [
        "https://www.youtube.com/watch?v=2CiI4LBSAhI",
    ],
    "EA Sports FC 24": [
        "https://www.youtube.com/watch?v=l93e7DHCDN0",
    ],
    "Call of Duty: Modern Warfare III": [
        "https://www.youtube.com/watch?v=kRMtG4aGcRc",
    ],
    "Diablo IV": ["https://www.youtube.com/watch?v=6ZTeEGhqh-k"],
    "Hogwarts Legacy": [
        "https://www.youtube.com/watch?v=4vBOp8Fagyo",
    ],
    "Resident Evil 4 Remake": [
        "https://www.youtube.com/watch?v=2zcACo62avY",
    ],
    "Starfield": [
        "https://www.youtube.com/watch?v=esDj-nrS10I",
    ],
    "Final Fantasy XVI": [
        "https://www.youtube.com/watch?v=-qk4TDTo0-E",
    ],
    "Mario Kart 8 Deluxe": [
        "https://www.youtube.com/watch?v=-o6HeaVNFLE",
    ],
    "Sekiro: Shadows Die Twice": [
        "https://www.youtube.com/watch?v=SWIgpuVA2-U",
    ],
    "Horizon Forbidden West": [
        "https://www.youtube.com/watch?v=M0dA2Eb10oo",
    ],
    "Sea of Thieves": [
        "https://www.youtube.com/watch?v=U8UyIQfdnH8",
    ],
    "Stardew Valley": [
        "https://www.youtube.com/watch?v=ddTHeAQhlws",
    ],
    "Monster Hunter Rise": [
        "https://www.youtube.com/watch?v=pKSnm3DBBUM",
    ],
    "Dead Space Remake": [
        "https://www.youtube.com/watch?v=yT882yrfSEc",
    ],
    "Ratchet & Clank: Rift Apart": [
        "https://www.youtube.com/watch?v=nwQIxR-g4Is",
    ],
    "Hollow Knight": [
        "https://www.youtube.com/watch?v=3eQIqzGz11k",
    ],
};

async function main() {
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JWT}`,
    };

    let page = 1;
    const limit = 30;
    let all = [];

    do {
        const res = await fetch(
            `${API_BASE_URL}/api/products?page=${page}&limit=${limit}`,
            { headers }
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
            console.error("Failed to fetch products:", json.message || res.statusText);
            process.exit(1);
        }
        if (!json.data.length) break;
        all = all.concat(json.data);
        if (json.data.length < limit) break;
        page++;
    } while (true);

    console.log("Fetched", all.length, "products. Updating youtubeLinks (skipping Metroid Dread)...");

    let updated = 0;
    for (const product of all) {
        if (SKIP_TITLES.has(product.title)) {
            console.log("SKIP:", product.title);
            continue;
        }
        const links = YOUTUBE_LINKS[product.title];
        if (!links || links.length === 0) continue;
        const res = await fetch(`${API_BASE_URL}/api/products/${product._id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ youtubeLinks: links }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
            console.log("OK:", product.title, "(" + links.length + " links)");
            updated++;
        } else {
            console.error("FAIL:", product.title, res.status, json.message || "");
        }
    }

    console.log("Done. Updated", updated, "products.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
