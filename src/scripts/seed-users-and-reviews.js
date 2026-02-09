/**
 * Seed 20 generic users (admin-created) with real names and have them post mixed reviews for each game.
 * Rate-limited: delays between requests to stay under API (100/min) and auth (5/min) limits.
 *
 * Run: ADMIN_TOKEN=<jwt> node src/scripts/seed-users-and-reviews.js
 * Requires: server running, admin token, at least one product in DB.
 * Env: BASE_URL (default http://localhost:5000), ADMIN_TOKEN
 */

const BASE = process.env.BASE_URL || "http://localhost:5000";
const ADMIN_TOKEN =
    process.env.ADMIN_TOKEN ||
    (process.argv[2] && process.argv[2] !== "--" ? process.argv[2] : null);

const USER_PASSWORD = "SeedPass1!";

// Real people-style names for the 20 seed users
const NAMES = [
    "James Wilson",
    "Emma Thompson",
    "Michael Chen",
    "Sophia Martinez",
    "David Kim",
    "Olivia Brown",
    "Daniel Garcia",
    "Isabella Lee",
    "Matthew Davis",
    "Charlotte Johnson",
    "Andrew Taylor",
    "Amelia Anderson",
    "Christopher White",
    "Mia Thomas",
    "Joseph Harris",
    "Harper Clark",
    "William Lewis",
    "Evelyn Walker",
    "Benjamin Hall",
    "Abigail Young",
];

// Delays to stay under rate limits: API 100/min, auth 5/min
const DELAY_AFTER_USER_CREATE_MS = 1500;
const DELAY_BETWEEN_USERS_MS = 13000;   // 13s between logins (< 5/min)
const DELAY_BETWEEN_REVIEWS_MS = 700;   // ~86 req/min per user

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
const COMMENTS = {
    positive: [
        "Absolutely love it. Worth every penny.",
        "One of the best games I've played this year.",
        "Incredible experience. Highly recommend.",
        "Addictive and polished. Can't put it down.",
        "Exceeded my expectations. 10/10.",
        "Great value for money. Lots of content.",
        "Fantastic gameplay and story. Must-play.",
    ],
    mixed: [
        "Good but has some bugs. Fun overall.",
        "Decent game. Could use more polish.",
        "Solid experience. Not perfect but enjoyable.",
        "Has its moments. Average overall.",
        "Okay game. Nothing special.",
    ],
    negative: [
        "Disappointing. Not what I expected.",
        "Too many issues. Would not recommend.",
        "Boring and repetitive. Skip it.",
        "Waste of money. Regret buying.",
        "Broken on my system. Refunded.",
    ],
};

async function request(method, path, body = null, token = null) {
    const url = `${BASE}${path}`;
    const opts = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    if (body != null) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (_) {
        data = { _raw: text };
    }
    return { status: res.status, data };
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
    if (!ADMIN_TOKEN) {
        console.error("Usage: ADMIN_TOKEN=<jwt> node src/scripts/seed-users-and-reviews.js");
        console.error("Or pass token as first arg. Get token by logging in as admin.");
        process.exit(1);
    }

    console.log("Base URL:", BASE);
    console.log("Creating 20 users and assigning mixed reviews...\n");

    // 1. Fetch all products
    const products = [];
    let page = 1;
    const limit = 50;
    while (true) {
        const res = await request("GET", `/api/products?page=${page}&limit=${limit}`, null, ADMIN_TOKEN);
        if (res.status !== 200) {
            console.error("Failed to fetch products:", res.status, res.data);
            process.exit(1);
        }
        const list = res.data?.data ?? res.data ?? [];
        if (!Array.isArray(list) || list.length === 0) break;
        products.push(...list);
        if (list.length < limit) break;
        page++;
    }
    console.log(`Found ${products.length} product(s).`);
    if (products.length === 0) {
        console.error("No products in DB. Run seed:games or add products first.");
        process.exit(1);
    }

    const productIds = products.map((p) => p._id || p.id);
    await sleep(1000);

    // 2. Create 20 users (admin) with real names; delay between creates to avoid rate limit
    const users = [];
    for (let i = 1; i <= 20; i++) {
        const email = `seeduser${i}@test.com`;
        const name = NAMES[i - 1];
        const res = await request(
            "POST",
            "/api/users",
            { email, password: USER_PASSWORD, name, role: "user" },
            ADMIN_TOKEN
        );
        const isDuplicate = res.status === 400 || res.status === 500;
        const dupMessage = isDuplicate && /E11000|already exists|duplicate/i.test(JSON.stringify(res.data));

        if (res.status === 201) {
            const user = res.data?.data ?? res.data;
            users.push({ email, name, id: user?._id || user?.id });
            console.log(`Created user ${i}/20: ${email} (${name})`);
        } else if (dupMessage) {
            users.push({ email, name, id: null });
            console.log(`User ${i}/20 already exists: ${email} → will use name "${name}"`);
        } else {
            console.error(`Failed to create user ${i}:`, res.status, res.data);
        }
        if (i < 20) await sleep(DELAY_AFTER_USER_CREATE_MS);
    }

    // 2b. Rename existing users (fetch id by email, then PATCH)
    for (let u = 0; u < users.length; u++) {
        if (users[u].id) continue;
        let found = false;
        let page = 1;
        while (true) {
            const r = await request("GET", `/api/users?page=${page}&limit=50`, null, ADMIN_TOKEN);
            await sleep(500);
            if (r.status !== 200) break;
            const list = r.data?.data ?? r.data ?? [];
            const match = list.find((x) => (x.email || "").toLowerCase() === users[u].email.toLowerCase());
            if (match) {
                const id = match._id || match.id;
                const patch = await request("PATCH", `/api/users/${id}`, { name: users[u].name }, ADMIN_TOKEN);
                await sleep(500);
                if (patch.status === 200) {
                    users[u].id = id;
                    console.log(`  Renamed ${users[u].email} → ${users[u].name}`);
                }
                found = true;
                break;
            }
            if (list.length < 50) break;
            page++;
        }
    }

    if (users.length === 0) {
        console.error("No users created or found.");
        process.exit(1);
    }
    console.log(`\n${users.length} users ready. Posting reviews...\n`);

    // 3. For each user, login and post reviews for every product (with delays to avoid rate limit)
    let reviewCount = 0;
    for (let u = 0; u < users.length; u++) {
        const { email, name } = users[u];
        await sleep(u === 0 ? 0 : DELAY_BETWEEN_USERS_MS);

        let loginRes = await request("POST", "/api/auth/login", { email, password: USER_PASSWORD });
        if (loginRes.status === 429) {
            console.log(`  Rate limited on login for ${email}, waiting 65s...`);
            await sleep(65000);
            loginRes = await request("POST", "/api/auth/login", { email, password: USER_PASSWORD });
        }
        if (loginRes.status !== 200) {
            console.error(`Login failed for ${email}:`, loginRes.status);
            continue;
        }
        const token = loginRes.data?.data?.token ?? loginRes.data?.token;
        if (!token) {
            console.error(`No token for ${email}`);
            continue;
        }

        const toReview = productIds;
        let posted = 0;
        for (let i = 0; i < toReview.length; i++) {
            if (i > 0) await sleep(DELAY_BETWEEN_REVIEWS_MS);
            const productId = toReview[i];
            const rating = randomInt(1, 5);
            let comment;
            if (rating >= 4) comment = pick(COMMENTS.positive);
            else if (rating <= 2) comment = pick(COMMENTS.negative);
            else comment = pick(COMMENTS.mixed);

            let revRes = await request(
                "POST",
                `/api/products/${productId}/reviews`,
                { rating, comment },
                token
            );
            if (revRes.status === 429) {
                await sleep(65000);
                revRes = await request(
                    "POST",
                    `/api/products/${productId}/reviews`,
                    { rating, comment },
                    token
                );
            }
            if (revRes.status === 200) {
                reviewCount++;
                posted++;
            }
        }
        console.log(`  ${name}: ${posted} reviews`);
    }

    console.log(`\nDone. ${users.length} users, ${reviewCount} reviews posted.`);
    console.log("User password for all seed users:", USER_PASSWORD);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
