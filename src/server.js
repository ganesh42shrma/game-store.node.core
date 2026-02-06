const app = require('./app');
const { loadEnv } = require("./config/env");
const { connectDB } = require("./config/db");
//load environment variables and connect to DB
loadEnv();
connectDB();

const PORT = process.env.PORT || 5000;

//boot server and listen on port
app.listen(PORT, () => {
    console.log(`game-store.node.core server running on PORT:${PORT}`);
})