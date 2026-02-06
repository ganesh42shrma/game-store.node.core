const crypto = require('crypto');

// Generate 32 random bytes and convert to a hex string
const secret = crypto.randomBytes(32).toString('hex');
console.log(`Generated Secret: ${secret}`);


// node src/utils/generateSecret.js