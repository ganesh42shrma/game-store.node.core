const Razorpay = require("razorpay");

const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

if(!key_id || !key_secret) {
    console.warn("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set or invalid.");
    module.exports = null;
} else {
    module.exports = new Razorpay({
        key_id,
        key_secret
    });
}