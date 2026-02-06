/**
 * Seed a single admin user. Run from project root: node scripts/seed-admin.js
 * Uses .env for MONGODB_URI.
 */
require("dotenv").config();
const { connectDB } = require("../config/db");
const User = require("../models/user.model");
const bcrypt = require("bcrypt");

const ADMIN_EMAIL = "admin@gamestore.com";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Admin User";

async function seedAdmin() {
    await connectDB();
    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
        console.log("Admin user already exists:", ADMIN_EMAIL);
        process.exit(0);
        return;
    }
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: "admin",
    });
    console.log("Admin user created:");
    console.log("  Email:", ADMIN_EMAIL);
    console.log("  Password:", ADMIN_PASSWORD);
    process.exit(0);
}

seedAdmin().catch((err) => {
    console.error(err);
    process.exit(1);
});
