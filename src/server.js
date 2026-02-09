const { loadEnv } = require("./config/env");
const { connectDB } = require("./config/db");

// Load env first so CORS_ORIGIN etc. are available when app runs
loadEnv();

const app = require("./app");
connectDB();

const PORT = process.env.PORT || 5000;

//boot server and listen on port
app.listen(PORT, () => {
    console.log(`game-store.node.core server running on PORT:${PORT}`);
})