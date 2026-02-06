/**
 * Update product descriptions via API using JWT.
 * Run: node src/scripts/update-product-descriptions.js
 * Env: API_BASE_URL (default http://localhost:5000), JWT_TOKEN (or set below)
 */
require("dotenv").config();

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";
const JWT =
    process.env.JWT_TOKEN ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTg1OGQ2NjQ1NDI1MDY0Mzc0MjAzODUiLCJlbWFpbCI6ImFkbWluQGdhbWVzdG9yZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzAzODM0NjEsImV4cCI6MTc3MDk4ODI2MX0.uVcHZ3lDJo4RW_czQmJLIV5WXTBD6s_OLTfMOsKst8o";

const DESCRIPTIONS = {
    "Elden Ring":
        "Enter a vast and mysterious open world crafted by FromSoftware, where challenging combat, deep lore, and exploration come together in an unforgettable action RPG experience. As a Tarnished warrior, you will traverse dangerous landscapes, battle powerful enemies, and uncover hidden secrets across the Lands Between. Customize your build, master diverse weapons and magic, and face legendary bosses in a dark fantasy adventure that rewards skill, curiosity, and perseverance.",
    "Cyberpunk 2077":
        "Step into the neon-lit streets of Night City in this immersive open-world RPG where technology and humanity collide. Play as V, a mercenary seeking fame and survival in a world driven by cybernetic enhancements and corporate power. Shape your story through meaningful choices, customize your character with advanced augmentations, and engage in intense combat, hacking, and exploration while navigating a complex narrative filled with unforgettable characters and moral dilemmas.",
    "God of War Ragnarok":
        "Join Kratos and Atreus on an emotional and action-packed journey through the realms of Norse mythology as Ragnarok approaches. Experience cinematic storytelling combined with brutal combat, deep character development, and breathtaking environments. Discover new abilities, face powerful gods and creatures, and explore richly detailed worlds that expand on the legendary saga. This epic sequel blends emotional storytelling with intense gameplay and unforgettable moments.",
    "The Legend of Zelda: Tears of the Kingdom":
        "Embark on an epic adventure as Link explores both the skies and depths of Hyrule in a vast open world filled with puzzles, secrets, and dynamic challenges. Use creative abilities to build, explore, and solve environmental puzzles in new ways. Encounter unique enemies, uncover ancient mysteries, and experience a rich story that expands the beloved Zelda universe while encouraging freedom, experimentation, and discovery.",
    "Super Mario Odyssey":
        "Travel across imaginative worlds with Mario in a joyful platforming adventure filled with creativity and exploration. Use new abilities, including the companion Cappy, to capture enemies and objects to solve puzzles and overcome obstacles. From vibrant cities to whimsical kingdoms, each level offers unique challenges, collectibles, and surprises. Perfect for players of all ages, this adventure combines classic Mario gameplay with fresh mechanics and stunning design.",
    "Halo Infinite":
        "Master Chief returns in a thrilling sci-fi first-person shooter featuring an expansive campaign and fast-paced multiplayer action. Explore a semi-open world on the Halo ring, battle the Banished, and uncover a compelling story filled with iconic characters and high-stakes combat. Customize your Spartan, experiment with powerful weapons and vehicles, and experience classic Halo gameplay evolved with modern mechanics and stunning visuals.",
    "Forza Horizon 5":
        "Experience the ultimate open-world racing festival set in vibrant and diverse landscapes inspired by Mexico. Drive hundreds of detailed cars across deserts, jungles, cities, and mountains while participating in dynamic races and seasonal events. With realistic driving physics, stunning visuals, and deep customization options, Forza Horizon 5 offers both casual fun and competitive racing experiences for players who love speed, exploration, and automotive culture.",
    "Marvel's Spider-Man 2":
        "Swing through an expanded Marvel's New York as both Peter Parker and Miles Morales in this action-packed superhero adventure. Experience fluid web-slinging traversal, dynamic combat, and a cinematic story featuring iconic villains and emotional character arcs. Switch between heroes, unlock powerful abilities, and explore a vibrant open world filled with side missions and hidden secrets that bring the Spider-Man universe to life.",
    "Baldur's Gate 3":
        "Dive into a deep role-playing experience inspired by the world of Dungeons & Dragons, where your choices shape every outcome. Create your character, assemble a party of unique companions, and explore a richly detailed world filled with danger, intrigue, and branching storylines. Engage in tactical turn-based combat, solve complex moral dilemmas, and uncover secrets that react dynamically to your decisions throughout this expansive fantasy adventure.",
    "Red Dead Redemption 2":
        "Experience an epic Western tale set in a vast and immersive open world during the decline of the outlaw era. Play as Arthur Morgan, a member of the Van der Linde gang, as you navigate loyalty, survival, and redemption. Hunt wildlife, interact with dynamic characters, and explore stunning landscapes while engaging in cinematic missions and emergent gameplay that create one of the most detailed and believable worlds ever created.",
    "The Last of Us Part II":
        "Follow Ellie on a powerful and emotional journey through a post-apocalyptic world filled with danger and difficult choices. Combining stealth, survival, and intense combat, the game delivers a deeply personal story exploring themes of revenge, loss, and humanity. Explore beautifully crafted environments, face intelligent enemies, and experience cinematic storytelling that pushes emotional boundaries and challenges players throughout the adventure.",
    "Animal Crossing: New Horizons":
        "Create your dream island getaway in a relaxing life-simulation experience filled with creativity and charm. Build and customize your home, decorate your island, and interact with a lovable cast of animal villagers. Fish, catch bugs, plant flowers, and design unique spaces while enjoying seasonal events and social features. Perfect for players seeking a calming and creative escape with endless opportunities for personalization.",
    "Grand Theft Auto V":
        "Explore the sprawling city of Los Santos in this iconic open-world action game featuring three unique protagonists with intertwining stories. Engage in thrilling heists, dynamic missions, and countless side activities across a living world filled with satire and detail. Switch between characters seamlessly while experiencing cinematic storytelling, fast-paced action, and a massive online multiplayer component offering endless gameplay possibilities.",
    "EA Sports FC 24":
        "Experience realistic football gameplay with advanced animations, authentic teams, and immersive match presentation. Build your dream squad, compete online, and enjoy multiple game modes designed for both casual players and competitive fans. Enhanced physics and player movements bring matches to life, delivering strategic depth and responsive controls that recreate the excitement of real-world football on the virtual pitch.",
    "Call of Duty: Modern Warfare III":
        "Return to intense modern combat with a gripping campaign and fast-paced multiplayer action. Experience cinematic missions, diverse weapon customization, and competitive online modes that challenge your skills. With refined gunplay mechanics, realistic environments, and tactical gameplay options, Modern Warfare III delivers adrenaline-filled battles whether you prefer solo missions, cooperative play, or competitive multiplayer matches.",
    "Diablo IV":
        "Enter the dark world of Sanctuary in this action RPG filled with demon-slaying combat and deep character customization. Choose from multiple classes, explore a shared open world, and uncover powerful loot as you battle terrifying enemies. With seasonal content, challenging dungeons, and dynamic events, Diablo IV combines classic hack-and-slash gameplay with modern systems designed for long-term progression and replayability.",
    "Hogwarts Legacy":
        "Step into the wizarding world and attend Hogwarts as a student with unique magical abilities. Explore iconic locations, learn spells, brew potions, and uncover secrets hidden within a richly detailed open world set long before the Harry Potter timeline. Customize your character, shape your destiny, and experience magical combat and storytelling that lets you live your own wizarding adventure.",
    "Resident Evil 4 Remake":
        "Experience a modern reimagining of the classic survival horror game with enhanced visuals, refined combat, and atmospheric storytelling. Play as Leon S. Kennedy on a dangerous mission to rescue the president's daughter from a mysterious cult. Solve puzzles, manage limited resources, and survive terrifying encounters while exploring tense environments that blend action and horror seamlessly.",
    "Metroid Dread":
        "Join bounty hunter Samus Aran in a thrilling side-scrolling action adventure combining exploration, platforming, and intense combat. Navigate hostile environments, uncover upgrades, and evade relentless robotic enemies in a suspense-filled journey. With fluid movement, challenging gameplay, and a compelling sci-fi atmosphere, Metroid Dread modernizes the classic Metroid formula while maintaining its signature sense of mystery.",
    "Starfield":
        "Explore the vastness of space in Bethesda's expansive sci-fi RPG featuring planetary exploration, deep customization, and branching narratives. Build your character, pilot spacecraft, and uncover mysteries across multiple star systems. Choose your path as an explorer, fighter, or trader while shaping the story through meaningful decisions in a richly detailed universe filled with factions, quests, and discovery.",
    "Final Fantasy XVI":
        "Enter a dramatic fantasy world where powerful Eikons shape the fate of kingdoms and heroes. Experience real-time action combat combined with cinematic storytelling and emotional character arcs. Follow Clive Rosfield on a journey filled with political intrigue, epic battles, and stunning visuals that redefine the Final Fantasy experience with a darker tone and modern gameplay mechanics.",
    "Mario Kart 8 Deluxe":
        "Race with Mario and friends across colorful tracks filled with creative obstacles and exciting power-ups. Enjoy local multiplayer, online races, and battle modes designed for players of all skill levels. With smooth controls, diverse characters, and fast-paced action, Mario Kart 8 Deluxe delivers endless fun whether you are competing casually with friends or aiming for competitive victories.",
    "Sekiro: Shadows Die Twice":
        "Master precise sword combat in a challenging action adventure set in a mythic version of feudal Japan. Play as a shinobi warrior seeking revenge while exploring interconnected environments filled with dangerous enemies and hidden secrets. Emphasizing timing, skill, and strategic combat, Sekiro offers intense boss battles and a rewarding progression system that pushes players to improve and adapt.",
    "Horizon Forbidden West":
        "Join Aloy on an epic journey through breathtaking landscapes filled with robotic creatures and ancient mysteries. Explore a vast open world featuring deserts, forests, and underwater environments while uncovering the truth behind a dying world. Use advanced weapons, traps, and strategic combat techniques to survive challenging encounters in a visually stunning and story-driven adventure.",
    "Sea of Thieves":
        "Set sail on a shared-world pirate adventure where exploration, teamwork, and emergent gameplay create unique stories every session. Command your ship, search for treasure, battle rival crews, and face mythical sea creatures across a vibrant ocean world. Whether playing solo or with friends, Sea of Thieves offers freedom-driven gameplay that rewards creativity, cooperation, and daring exploration.",
    "Stardew Valley":
        "Escape to a peaceful farming life where you grow crops, raise animals, and build relationships with the local community. Customize your farm, explore caves, participate in seasonal festivals, and uncover secrets hidden throughout the valley. Combining relaxing gameplay with rewarding progression, Stardew Valley provides a charming and endlessly replayable experience for players seeking creativity and calm.",
    "Monster Hunter Rise":
        "Hunt powerful monsters in dynamic environments using strategic combat and unique weapon styles. Work solo or cooperate with friends to track, battle, and craft equipment from defeated creatures. Featuring fast-paced movement systems and deep customization options, Monster Hunter Rise blends action and strategy with rewarding progression that encourages mastering different playstyles and tactics.",
    "Dead Space Remake":
        "Survive the horrors aboard the USG Ishimura in this atmospheric sci-fi survival horror remake. Play as engineer Isaac Clarke as he faces terrifying necromorph creatures while uncovering a mysterious outbreak. Enhanced visuals, immersive sound design, and refined gameplay mechanics create a tense and cinematic experience that modernizes a beloved classic while preserving its terrifying atmosphere.",
    "Ratchet & Clank: Rift Apart":
        "Jump between dimensions in a fast-paced action platformer showcasing creative weapons, vibrant worlds, and seamless transitions between realities. Play as Ratchet and Rivet while battling enemies across visually stunning environments. Combining humor, cinematic storytelling, and innovative gameplay mechanics, Rift Apart delivers an exciting adventure designed to highlight modern gaming technology and imaginative design.",
    "Hollow Knight":
        "Explore a hauntingly beautiful underground kingdom in this atmospheric Metroidvania adventure. Discover hidden pathways, challenging bosses, and deep lore while mastering precise combat and exploration mechanics. With hand-drawn visuals, immersive music, and rewarding progression, Hollow Knight offers a challenging yet captivating journey that encourages curiosity, skill, and discovery.",
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

    console.log("Fetched", all.length, "products. Updating descriptions...");

    let updated = 0;
    for (const product of all) {
        const description = DESCRIPTIONS[product.title];
        if (!description) continue;
        const res = await fetch(`${API_BASE_URL}/api/products/${product._id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ description }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
            console.log("OK:", product.title);
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
