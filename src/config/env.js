const dotenv = require("dotenv");

function loadEnv() {
    const result = dotenv.config();

    if (result.error) {
        console.warn(" No .env file found, relying on process.env");
    }
}

module.exports = { loadEnv };