/**
 * Reusable mailer service using SendGrid.
 * Uses SEND_GRID_API_KEY and MAIL_FROM from env.
 * All send methods are fire-and-forget (log errors, don't throw) so API flows aren't broken by email failures.
 */

const sgMail = require("@sendgrid/mail");
const logger = require("../config/logger");
const emailTemplates = require("../templates/email.templates");

const API_KEY = process.env.SEND_GRID_API_KEY;
const FROM = process.env.MAIL_FROM || "noreply@gamestore.com";

function isConfigured() {
    return Boolean(API_KEY && FROM);
}

function setApiKey() {
    if (API_KEY) {
        sgMail.setApiKey(API_KEY);
    }
}

/**
 * Send a single email (HTML or text).
 * @param {{ to: string, subject: string, html?: string, text?: string }} options
 * @returns {Promise<boolean>} true if sent, false otherwise
 */
async function send({ to, subject, html, text }) {
    if (!isConfigured()) {
        logger.warn("Mailer: SEND_GRID_API_KEY or MAIL_FROM not set; skipping email");
        return false;
    }
    setApiKey();
    const msg = {
        to,
        from: { email: FROM, name: "Game Store" },
        subject,
        ...(html && { html }),
        ...(text && { text }),
    };
    try {
        await sgMail.send(msg);
        logger.info(`Mailer: accepted by SendGrid "${subject}" → ${to} (check inbox/spam)`);
        return true;
    } catch (err) {
        const sendGridDetail = err.response
            ? {
                statusCode: err.response.statusCode,
                body: err.response.body,
                headers: err.response.headers && typeof err.response.headers === "object"
                    ? Object.fromEntries(
                        Object.entries(err.response.headers).filter(
                            ([k]) => !/^x-|^content-encoding$/i.test(k)
                        )
                    ) : undefined,
            }
            : undefined;
        logger.error("Mailer: send failed", {
            to,
            subject,
            message: err.message,
            code: err.code,
            sendGrid: sendGridDetail,
        });
        return false;
    }
}

/**
 * Send purchase confirmation with invoice summary.
 * @param {{ to: string, userName: string, invoiceNumber: string, orderId: string, items: Array<{ title: string, quantity: number, price: number, amount?: number }>, subTotal: number, gstRate: number, gstAmount: number, totalAmount: number, issuedAt?: Date }} data
 */
async function sendPurchaseWithInvoice(data) {
    const html = emailTemplates.purchaseWithInvoice(data);
    return send({
        to: data.to,
        subject: `Order confirmed – Invoice ${data.invoiceNumber}`,
        html,
    });
}

/**
 * Send cart abandonment email (items in cart for several hours).
 * @param {{ to: string, userName: string, items: Array<{ title: string, quantity: number, price?: number }>, cartTotal?: number, hoursLeft?: number }} data
 */
async function sendCartAbandonment(data) {
    const html = emailTemplates.cartAbandonment(data);
    return send({
        to: data.to,
        subject: "Complete your purchase – items waiting in your cart",
        html,
    });
}

/**
 * Send game-on-sale notification.
 * @param {{ to: string, userName: string, products: Array<{ title: string, price: number, discountedPrice: number, productId: string }> }} data
 */
async function sendGameOnSale(data) {
    const html = emailTemplates.gameOnSale(data);
    return send({
        to: data.to,
        subject: "Games you might like are on sale",
        html,
    });
}

module.exports = {
    isConfigured,
    send,
    sendPurchaseWithInvoice,
    sendCartAbandonment,
    sendGameOnSale,
};
