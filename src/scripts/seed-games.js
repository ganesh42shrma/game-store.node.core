/**
 * Delete all products, orders, and carts; then seed 30 real games.
 * Run from project root: node src/scripts/seed-games.js
 */
require("dotenv").config();
const { connectDB } = require("../config/db");
const Product = require("../models/product.model");
const Order = require("../models/order.model");
const Cart = require("../models/cart.model");

const GAMES = [
    { title: "Elden Ring", description: "Open-world action RPG from FromSoftware. Forge your path through the Lands Between.", price: 59.99, platform: "PC", genre: "Action RPG", stock: 120 },
    { title: "Cyberpunk 2077", description: "Open-world RPG in Night City. Play as V and chase the key to immortality.", price: 49.99, platform: "PC", genre: "RPG", stock: 85 },
    { title: "God of War Ragnarok", description: "Kratos and Atreus face the Norse apocalypse in this action-adventure sequel.", price: 69.99, platform: "PS5", genre: "Action", stock: 95 },
    { title: "The Legend of Zelda: Tears of the Kingdom", description: "Link explores the skies and the depths of Hyrule in this epic sequel.", price: 69.99, platform: "SWITCH", genre: "Adventure", stock: 110 },
    { title: "Super Mario Odyssey", description: "Mario travels the world in his airship to rescue Peach and defeat Bowser.", price: 59.99, platform: "SWITCH", genre: "Platformer", stock: 80 },
    { title: "Halo Infinite", description: "Master Chief returns in this sci-fi FPS. Campaign and free-to-play multiplayer.", price: 59.99, platform: "XBOX", genre: "Shooter", stock: 70 },
    { title: "Forza Horizon 5", description: "Open-world racing across Mexico. Hundreds of cars and dynamic seasons.", price: 59.99, platform: "XBOX", genre: "Racing", stock: 65 },
    { title: "Marvel's Spider-Man 2", description: "Play as Peter Parker and Miles Morales in an expanded New York.", price: 69.99, platform: "PS5", genre: "Action", stock: 90 },
    { title: "Baldur's Gate 3", description: "CRPG from Larian. Dungeons & Dragons adventure with deep choices and turn-based combat.", price: 59.99, platform: "PC", genre: "RPG", stock: 100 },
    { title: "Red Dead Redemption 2", description: "Epic Western tale of Arthur Morgan and the Van der Linde gang.", price: 59.99, platform: "PC", genre: "Action Adventure", stock: 75 },
    { title: "The Last of Us Part II", description: "Ellie's journey of vengeance in a post-apocalyptic America.", price: 69.99, platform: "PS5", genre: "Action Adventure", stock: 60 },
    { title: "Animal Crossing: New Horizons", description: "Build your island paradise, decorate, and meet villagers.", price: 59.99, platform: "SWITCH", genre: "Simulation", stock: 130 },
    { title: "Grand Theft Auto V", description: "Explore Los Santos in this open-world action game. Story and Online.", price: 29.99, platform: "PC", genre: "Action", stock: 200 },
    { title: "EA Sports FC 24", description: "Football simulation with HyperMotion and authentic leagues and clubs.", price: 69.99, platform: "PS5", genre: "Sports", stock: 88 },
    { title: "Call of Duty: Modern Warfare III", description: "Return to the fight with a new campaign and multiplayer.", price: 69.99, platform: "XBOX", genre: "Shooter", stock: 72 },
    { title: "Diablo IV", description: "Action RPG in Sanctuary. Choose your class and battle Lilith's forces.", price: 69.99, platform: "PC", genre: "Action RPG", stock: 95 },
    { title: "Hogwarts Legacy", description: "Open-world RPG set in the wizarding world. Attend Hogwarts in the 1800s.", price: 59.99, platform: "PC", genre: "Action RPG", stock: 78 },
    { title: "Resident Evil 4 Remake", description: "Reimagined survival horror. Leon S. Kennedy rescues the President's daughter.", price: 59.99, platform: "PS5", genre: "Horror", stock: 55 },
    { title: "Metroid Dread", description: "Samus returns in this side-scrolling action adventure on a hostile planet.", price: 59.99, platform: "SWITCH", genre: "Action Adventure", stock: 62 },
    { title: "Starfield", description: "Bethesda's space RPG. Explore the Settled Systems and forge your destiny.", price: 69.99, platform: "XBOX", genre: "RPG", stock: 82 },
    { title: "Final Fantasy XVI", description: "Action RPG in the world of Valisthea. Eikons and political intrigue.", price: 69.99, platform: "PS5", genre: "RPG", stock: 68 },
    { title: "Mario Kart 8 Deluxe", description: "Race with Mario and friends. Includes all DLC courses and Battle Mode.", price: 59.99, platform: "SWITCH", genre: "Racing", stock: 150 },
    { title: "Sekiro: Shadows Die Twice", description: "FromSoftware's action game set in feudal Japan. Sword combat and stealth.", price: 59.99, platform: "PC", genre: "Action", stock: 58 },
    { title: "Horizon Forbidden West", description: "Aloy explores the Forbidden West in this open-world action RPG.", price: 59.99, platform: "PS5", genre: "Action RPG", stock: 74 },
    { title: "Sea of Thieves", description: "Shared-world pirate adventure. Sail, fight, and hunt for treasure.", price: 39.99, platform: "XBOX", genre: "Adventure", stock: 90 },
    { title: "Stardew Valley", description: "Farm, mine, fish, and befriend the town in this beloved indie simulation.", price: 14.99, platform: "PC", genre: "Simulation", stock: 180 },
    { title: "Monster Hunter Rise", description: "Hunt massive monsters in this action RPG. Wirebugs and new locales.", price: 39.99, platform: "SWITCH", genre: "Action RPG", stock: 66 },
    { title: "Dead Space Remake", description: "Reimagined survival horror aboard the USG Ishimura in deep space.", price: 59.99, platform: "PC", genre: "Horror", stock: 52 },
    { title: "Ratchet & Clank: Rift Apart", description: "Dimension-hopping action platformer. Play as Ratchet and Rivet.", price: 69.99, platform: "PS5", genre: "Platformer", stock: 48 },
    { title: "Hollow Knight", description: "Metroidvania in a haunting insect kingdom. Explore, fight, and discover secrets.", price: 14.99, platform: "PC", genre: "Platformer", stock: 220 },
];

async function seedGames() {
    await connectDB();

    const orderResult = await Order.deleteMany({});
    const cartResult = await Cart.deleteMany({});
    const productResult = await Product.deleteMany({});

    console.log("Deleted:", orderResult.deletedCount, "orders,", cartResult.deletedCount, "carts,", productResult.deletedCount, "products.");

    const inserted = await Product.insertMany(GAMES);
    console.log("Inserted", inserted.length, "games.");

    process.exit(0);
}

seedGames().catch((err) => {
    console.error(err);
    process.exit(1);
});
