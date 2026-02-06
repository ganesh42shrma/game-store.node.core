/**
 * Vercel serverless entry. Export the Express app so Vercel can run it.
 * All routes are rewritten to this handler via vercel.json.
 */
require("dotenv").config();
const { connectDB } = require("../src/config/db");
const app = require("../src/app");

connectDB();

module.exports = app;
