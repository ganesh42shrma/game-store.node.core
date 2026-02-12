"use strict";

const { tool } = require("langchain");
const z = require("zod");
const Product = require("../../models/product.model");
const productService = require("../../services/product.service");
const reviewService = require("../../services/review.service");
const userMemoryService = require("../../services/userMemory.service");
const productAlertService = require("../../services/productAlert.service");
const addressService = require("../../services/address.service");
const cartService = require("../../services/cart.service");
const orderService = require("../../services/order.service");
const paymentService = require("../../services/payment.service");
const invoiceService = require("../../services/invoice.service");
const { getReviewSummary } = require("../../utils/reviewSummary");
const logger = require("../../config/logger");

const { ALERT_TRIGGER_TYPES } = require("../../models/userProductAlert.model");
const { PAYMENT_METHOD } = require("../../models/payment.model");

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

/** Levenshtein distance. */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** Similarity 0–1: higher = better match. Handles typos. */
function stringSimilarity(a, b) {
  const x = String(a || "").toLowerCase().trim();
  const y = String(b || "").toLowerCase().trim();
  if (x === y) return 1;
  const maxLen = Math.max(x.length, y.length, 1);
  return 1 - levenshtein(x, y) / maxLen;
}

/** Resolve product_id: if 24-char hex use as ObjectId; else search by title. Uses fuzzy match if exact search fails. */
async function resolveProductId(productIdOrName) {
  if (!productIdOrName || typeof productIdOrName !== "string") {
    logger.warn("[games-qa] resolveProductId: invalid input", { productIdOrName, type: typeof productIdOrName });
    return null;
  }
  const s = String(productIdOrName).trim();
  if (OBJECT_ID_REGEX.test(s)) {
    const product = await Product.findById(s).lean();
    const resolved = product ? product._id.toString() : null;
    logger.info("[games-qa] resolveProductId: by ObjectId", { input: s, resolved, found: !!product });
    return resolved;
  }
  logger.info("[games-qa] resolveProductId: searching by name", { input: s });
  let products = await productService.getAllProducts(
    { search: s, limit: 1, page: 1 },
    { includeInactive: false }
  );
  let list = Array.isArray(products) ? products : [];
  let first = list[0];

  if (!first && s.length >= 3) {
    const firstWord = s.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 2) {
      products = await productService.getAllProducts(
        { search: firstWord, limit: 30, page: 1 },
        { includeInactive: false }
      );
      list = Array.isArray(products) ? products : [];
      let best = null;
      let bestScore = 0.6;
      for (const p of list) {
        const title = p.title || p.name || "";
        const score = stringSimilarity(s, title);
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      first = best;
      if (first) logger.info("[games-qa] resolveProductId: fuzzy match", { input: s, matchTitle: first.title, score: bestScore });
    }
  }

  const resolved = first ? (first._id?.toString?.() || first.id) : null;
  logger.info("[games-qa] resolveProductId: result", { input: s, resolved, matchTitle: first?.title, found: !!first });
  return resolved;
}

const PLATFORMS = ["PC", "PS5", "XBOX", "SWITCH"];

const SORT_WHITELIST = /^-?(price|rating|createdAt|title|stock)$/;
const SORT_ALIASES = {
  "most expensive": "-price",
  "highest price": "-price",
  "price desc": "-price",
  "price descending": "-price",
  "least expensive": "price",
  "lowest price": "price",
  "price asc": "price",
  "price ascending": "price",
  "highest rated": "-rating",
  "rating desc": "-rating",
  "lowest rated": "rating",
  "rating asc": "rating",
  "newest": "-createdAt",
  "newest first": "-createdAt",
  "oldest": "createdAt",
  "oldest first": "createdAt",
  "createdAt desc": "-createdAt",
  "createdAt asc": "createdAt",
  "name": "title",
  "title asc": "title",
  "a-z": "title",
  "title desc": "-title",
  "z-a": "-title",
  "most stock": "-stock",
  "least stock": "stock",
};

/** Normalize LLM platform input to store enum or undefined. */
function normalizePlatform(val) {
  if (val === undefined || val === null || val === "") return undefined;
  const s = String(val).trim().toUpperCase();
  if (PLATFORMS.includes(s)) return s;
  if (s === "PLAYSTATION" || s === "PLAYSTATION 5" || s === "PS4" || s === "PLAYSTATION 4") return "PS5";
  if (s === "XBOX ONE" || s === "XBOX SERIES" || s === "MICROSOFT") return "XBOX";
  if (s === "NINTENDO" || s === "NINTENDO SWITCH") return "SWITCH";
  return undefined;
}

/** Normalize sort input to a whitelisted MongoDB sort string or undefined. */
function normalizeSort(val) {
  if (val === undefined || val === null || val === "") return undefined;
  const s = String(val).trim().toLowerCase();
  if (SORT_ALIASES[s] !== undefined) return SORT_ALIASES[s];
  if (SORT_WHITELIST.test(s)) return s;
  const withMinus = s.startsWith("-") ? s : `-${s}`;
  if (SORT_WHITELIST.test(withMinus)) return withMinus;
  return undefined;
}

/**
 * List games (active only). For search, filters, and "what's on sale" etc.
 * Returns minimal fields; no PII.
 */
const listProducts = tool(
  async ({ search, platform, genre, onSaleOnly, limit, sort }) => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    const normalizedPlatform = normalizePlatform(platform);
    const normalizedSort = normalizeSort(sort);
    logger.info("[games-qa] Tool list_products called", { ts, search, platform: normalizedPlatform, genre, onSaleOnly, limit, sort: normalizedSort });
    try {
      const query = {
        page: 1,
        limit: Math.min(20, Math.max(1, Number(limit) || 10)),
        sort: normalizedSort ?? "-createdAt",
      };
      if (search && typeof search === "string" && search.trim()) query.search = search.trim();
      if (normalizedPlatform) query.platform = normalizedPlatform;
      if (genre && typeof genre === "string" && genre.trim()) query.genre = genre.trim();
      if (onSaleOnly === true) query.isOnSale = "true";
      const products = await productService.getAllProducts(query, { includeInactive: false });
      const list = (Array.isArray(products) ? products : []).map((p) => {
        const doc = p.toJSON ? p.toJSON() : p;
        return {
          id: doc._id?.toString(),
          title: doc.title,
          price: doc.price,
          discountedPrice: doc.discountedPrice,
          isOnSale: doc.isOnSale,
          stock: doc.stock,
          platform: doc.platform,
          genre: doc.genre,
          rating: doc.rating,
          reviewCount: doc.reviewCount,
        };
      });
      const durationMs = Date.now() - toolStart;
      logger.info("[games-qa] Tool list_products completed", { ts: new Date().toISOString(), durationMs, count: list.length });
      return JSON.stringify({ products: list, count: list.length });
    } catch (err) {
      logger.error("[games-qa] Tool list_products failed", { ts: new Date().toISOString(), durationMs: Date.now() - toolStart, error: err.message });
      return JSON.stringify({ error: err.message || "List failed" });
    }
  },
  {
    name: "list_products",
    description: "List games. Filter: platform, genre, onSale. Sort: -price, -rating.",
    schema: z.object({
      search: z.string().optional(),
      platform: z.string().optional(),
      genre: z.string().optional(),
      onSaleOnly: z.boolean().optional(),
      limit: z.number().int().optional().default(10).transform((n) => Math.min(20, Math.max(1, Number(n) || 10))),
      sort: z.string().optional(),
    }),
  }
);

/**
 * Get one game by ID. Use when the user asks about a specific game (price, stock, on sale, details).
 * Returns product id for frontend link (GET /api/products/:id).
 */
const getProduct = tool(
  async ({ productId }) => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    logger.info("[games-qa] Tool product called", { ts, productId, inputType: OBJECT_ID_REGEX.test(String(productId || "")) ? "ObjectId" : "name" });
    try {
      const resolvedId = await resolveProductId(productId);
      if (!resolvedId) {
        logger.warn("[games-qa] Tool product: no product found for input", { productId });
        return JSON.stringify({ error: "Product not found. Use product id from list_products or the exact game name.", productIdOrName: productId });
      }
      const product = await productService.getProductById(resolvedId);
      if (!product) {
        return JSON.stringify({ error: "Product not found", productId: resolvedId });
      }
      const doc = product.toJSON ? product.toJSON() : product;
      const summary = getReviewSummary(doc.reviewCount ?? 0, doc.positiveCount ?? 0);
      const out = {
        id: doc._id?.toString(),
        title: doc.title,
        description: doc.description,
        shortDescription: doc.shortDescription,
        price: doc.price,
        discountedPrice: doc.discountedPrice,
        isOnSale: doc.isOnSale,
        stock: doc.stock,
        platform: doc.platform,
        genre: doc.genre,
        rating: doc.rating,
        reviewCount: doc.reviewCount,
        reviewSummary: summary,
        tags: doc.tags,
      };
      const durationMs = Date.now() - toolStart;
      logger.info("[games-qa] Tool product completed", { ts: new Date().toISOString(), durationMs, productId: resolvedId, title: out.title });
      return JSON.stringify(out, null, 2);
    } catch (err) {
      logger.error("[games-qa] Tool product failed", { ts: new Date().toISOString(), durationMs: Date.now() - toolStart, productId, error: err.message, stack: err.stack });
      return JSON.stringify({ error: err.message || "Get product failed" });
    }
  },
  {
    name: "product",
    description: "Game by id or name (e.g. GTA V). Price, stock, sale.",
    schema: z.object({
      productId: z.string(),
    }),
  }
);

/**
 * Get reviews for a game. Returns only public review data (name, rating, comment); no PII (no email, no user id).
 */
const getProductReviews = tool(
  async ({ productId, limit }) => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    logger.info("[games-qa] Tool reviews called", { ts, productId, limit, inputType: OBJECT_ID_REGEX.test(String(productId || "")) ? "ObjectId" : "name" });
    try {
      const resolvedId = await resolveProductId(productId);
      if (!resolvedId) {
        logger.warn("[games-qa] Tool reviews: no product found for input", { productId });
        return JSON.stringify({ error: "Product not found. Use product id from list_products or the exact game name.", productIdOrName: productId });
      }
      const product = await productService.getProductById(resolvedId);
      if (!product) {
        return JSON.stringify({ error: "Product not found", productId: resolvedId });
      }
      const { reviews, total } = await reviewService.getReviewsForProduct(resolvedId, {
        page: 1,
        limit: Math.min(20, Math.max(1, Number(limit) || 10)),
        sort: "-createdAt",
      });
      const safe = (reviews || []).map((r) => ({
        rating: r.rating,
        comment: r.comment,
        reviewerName: r.user?.name ?? "Anonymous",
      }));
      const durationMs = Date.now() - toolStart;
      logger.info("[games-qa] Tool reviews completed", { ts: new Date().toISOString(), durationMs, productId: resolvedId, total });
      return JSON.stringify({ productId: resolvedId, productTitle: product.title, reviews: safe, total }, null, 2);
    } catch (err) {
      logger.error("[games-qa] Tool reviews failed", { ts: new Date().toISOString(), durationMs: Date.now() - toolStart, productId, error: err.message, stack: err.stack });
      return JSON.stringify({ error: err.message || "Get reviews failed" });
    }
  },
  {
    name: "reviews",
    description: "Reviews for game. productId = id or name.",
    schema: z.object({
      productId: z.string(),
      limit: z.number().int().optional().default(10).transform((n) => Math.min(20, Math.max(1, Number(n) || 10))),
    }),
  }
);

/**
 * Get stored preferences and optional summary for the current user.
 * Use the user_id provided in the conversation context (Current user ID: ...).
 */
const get_user_preferences = tool(
  async ({ user_id }) => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    logger.info("[games-qa] Tool prefs called", { ts, user_id });
    try {
      const data = await userMemoryService.getUserMemory(user_id);
      if (!data) {
        return JSON.stringify({ preferences: {}, message: "No stored preferences for this user." });
      }
      const durationMs = Date.now() - toolStart;
      logger.info("[games-qa] Tool prefs completed", { ts: new Date().toISOString(), durationMs, user_id });
      return JSON.stringify({ preferences: data.preferences || {}, lastChatAt: data.lastChatAt }, null, 2);
    } catch (err) {
      logger.error("[games-qa] Tool prefs failed", { ts: new Date().toISOString(), user_id, error: err.message });
      return JSON.stringify({ error: err.message || "Get preferences failed" });
    }
  },
  {
    name: "prefs",
    description: "Get user prefs.",
    schema: z.object({
      user_id: z.string(),
    }),
  }
);

/**
 * Save a single preference for the current user (e.g. budget, favorite_genre, theme).
 */
const save_user_preference = tool(
  async ({ user_id, preference, value }) => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    logger.info("[games-qa] Tool save_pref called", { ts, user_id, preference, value });
    try {
      await userMemoryService.setUserPreference(user_id, preference, value);
      const durationMs = Date.now() - toolStart;
      logger.info("[games-qa] Tool save_pref completed", { ts: new Date().toISOString(), durationMs, user_id, preference });
      return JSON.stringify({ saved: true, preference, value, message: `Saved preference: ${preference} = ${value}` });
    } catch (err) {
      logger.error("[games-qa] Tool save_pref failed", { ts: new Date().toISOString(), user_id, preference, error: err.message });
      return JSON.stringify({ error: err.message || "Save preference failed" });
    }
  },
  {
    name: "save_pref",
    description: "Save pref. preference, value.",
    schema: z.object({
      user_id: z.string(),
      preference: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
  }
);

/**
 * Create a product alert. Use when user says "notify me when X is on sale", "tell me when price drops below $30", "tell me when available".
 */
const create_product_alert = tool(
  async ({ user_id, product_id, trigger_type, price_threshold }) => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    logger.info("[games-qa] Tool create_alert called", { ts, user_id, product_id, trigger_type, price_threshold, inputType: OBJECT_ID_REGEX.test(String(product_id || "")) ? "ObjectId" : "name" });
    try {
      const resolvedId = await resolveProductId(product_id);
      if (!resolvedId) {
        logger.warn("[games-qa] Tool create_alert: no product found for input", { product_id });
        return JSON.stringify({ error: "Product not found. Use product id from list_products or the exact game name.", productIdOrName: product_id });
      }
      const numThreshold = price_threshold != null ? Number(price_threshold) : undefined;
      if ((trigger_type === "price_drop" || trigger_type === "price_below") && (numThreshold == null || isNaN(numThreshold) || numThreshold < 0)) {
        return JSON.stringify({ error: "price_threshold required for price_drop and price_below (e.g. 30 for ₹30)" });
      }
      const { alert, created } = await productAlertService.createAlert({
        userId: user_id,
        productId: resolvedId,
        triggerType: trigger_type,
        priceThreshold: numThreshold,
      });
      const durationMs = Date.now() - toolStart;
      logger.info("[games-qa] Tool create_alert completed", { ts: new Date().toISOString(), durationMs, alertId: alert._id });
      const msg = created
        ? `Alert created: I'll notify you when ${getTriggerDescription(trigger_type, numThreshold)}.`
        : `Alert already exists for this game.`;
      return JSON.stringify({ success: true, alertId: alert._id.toString(), message: msg }, null, 2);
    } catch (err) {
      logger.error("[games-qa] Tool create_alert failed", { ts: new Date().toISOString(), user_id, product_id, error: err.message, stack: err.stack });
      return JSON.stringify({ error: err.message || "Create alert failed" });
    }
  },
  {
    name: "create_alert",
    description: "Create alert. product_id = id or name. trigger_type: on_sale|available|price_drop|price_below. price_threshold for price_drop/price_below.",
    schema: z.object({
      user_id: z.string(),
      product_id: z.string(),
      trigger_type: z.enum(ALERT_TRIGGER_TYPES),
      price_threshold: z.number().optional(),
    }),
  }
);

function getTriggerDescription(triggerType, priceThreshold) {
  switch (triggerType) {
    case "on_sale":
      return "this game goes on sale";
    case "available":
      return "this game is back in stock";
    case "price_drop":
    case "price_below":
      return `the price drops to ₹${priceThreshold ?? "?"} or below`;
    default:
      return "conditions are met";
  }
}

/**
 * List user's active product alerts.
 */
const list_my_alerts = tool(
  async ({ user_id }) => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    logger.info("[games-qa] Tool list_alerts called", { ts, user_id });
    try {
      const alerts = await productAlertService.listUserAlerts(user_id);
      const durationMs = Date.now() - toolStart;
      logger.info("[games-qa] Tool list_alerts completed", { ts: new Date().toISOString(), durationMs, count: alerts.length });
      if (alerts.length === 0) {
        return JSON.stringify({ alerts: [], message: "No active alerts." });
      }
      return JSON.stringify({ alerts, count: alerts.length }, null, 2);
    } catch (err) {
      logger.error("[games-qa] Tool list_alerts failed", { ts: new Date().toISOString(), user_id, error: err.message });
      return JSON.stringify({ error: err.message || "List alerts failed" });
    }
  },
  {
    name: "list_alerts",
    description: "List user alerts.",
    schema: z.object({
      user_id: z.string(),
    }),
  }
);

/**
 * Get user's addresses for checkout. Call before buy_for_me. If empty, tell user to add address.
 */
const get_user_addresses = tool(
  async ({ user_id }) => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    logger.info("[games-qa] Tool get_user_addresses called", { ts, user_id });
    try {
      const addresses = await addressService.getAddressesByUserId(user_id);
      const list = (addresses || []).map((a) => ({
        id: a._id?.toString(),
        label: a.label || "Address",
        city: a.city,
        state: a.state,
        isDefault: a.isDefault,
      }));
      const durationMs = Date.now() - toolStart;
      logger.info("[games-qa] Tool get_user_addresses completed", { ts: new Date().toISOString(), durationMs, count: list.length });
      return JSON.stringify({ addresses: list, count: list.length }, null, 2);
    } catch (err) {
      logger.error("[games-qa] Tool get_user_addresses failed", { ts: new Date().toISOString(), user_id, error: err.message });
      return JSON.stringify({ error: err.message || "Get addresses failed" });
    }
  },
  {
    name: "get_user_addresses",
    description: "List addresses. Empty = tell user add address.",
    schema: z.object({
      user_id: z.string(),
    }),
  }
);

/**
 * Get user's cart contents.
 */
const get_user_cart = tool(
  async ({ user_id }) => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    logger.info("[games-qa] Tool get_user_cart called", { ts, user_id });
    try {
      const cart = await cartService.getCartByUserId(user_id);
      const items = (cart?.items || []).map((i) => ({
        productId: i.product?._id?.toString() || i.productId?.toString(),
        title: i.product?.title,
        quantity: i.quantity,
        price: i.product?.isOnSale && i.product?.discountedPrice != null ? i.product.discountedPrice : i.product?.price,
      }));
      const durationMs = Date.now() - toolStart;
      logger.info("[games-qa] Tool get_user_cart completed", { ts: new Date().toISOString(), durationMs, count: items.length });
      return JSON.stringify({ items, count: items.length }, null, 2);
    } catch (err) {
      logger.error("[games-qa] Tool get_user_cart failed", { ts: new Date().toISOString(), user_id, error: err.message });
      return JSON.stringify({ error: err.message || "Get cart failed" });
    }
  },
  {
    name: "get_user_cart",
    description: "List cart items.",
    schema: z.object({
      user_id: z.string(),
    }),
  }
);

/**
 * Get payment options (Card, UPI, Net Banking).
 */
const get_payment_options = tool(
  async () => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    logger.info("[games-qa] Tool get_payment_options called", { ts });
    const options = PAYMENT_METHOD.map((m) => ({
      value: m,
      label: m === "mock_card" ? "Card" : m === "mock_upi" ? "UPI" : m === "mock_netbanking" ? "Net Banking" : m,
    }));
    const durationMs = Date.now() - toolStart;
    logger.info("[games-qa] Tool get_payment_options completed", { ts: new Date().toISOString(), durationMs });
    return JSON.stringify({ options, methods: PAYMENT_METHOD }, null, 2);
  },
  {
    name: "get_payment_options",
    description: "Payment options: mock_card, mock_upi, mock_netbanking.",
    schema: z.object({}),
  }
);

/**
 * Add product to cart. Agent must confirm before calling.
 */
const add_to_cart = tool(
  async ({ user_id, product_id, quantity }) => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    logger.info("[games-qa] Tool add_to_cart called", { ts, user_id, product_id, quantity: qty });
    try {
      const resolvedId = await resolveProductId(product_id);
      if (!resolvedId) {
        return JSON.stringify({ error: "Product not found. Use product id from list_products or product, or the exact game name.", productIdOrName: product_id });
      }
      const product = await Product.findById(resolvedId).lean();
      if (!product || !product.isActive) {
        return JSON.stringify({ error: "Product not found or inactive", productId: resolvedId });
      }
      const stock = product.stock ?? 0;
      if (stock < qty) {
        return JSON.stringify({ error: "Product is out of stock", productId: resolvedId, productTitle: product.title });
      }
      const cart = await cartService.addItem(user_id, resolvedId, qty);
      const durationMs = Date.now() - toolStart;
      logger.info("[games-qa] Tool add_to_cart completed", { ts: new Date().toISOString(), durationMs, productId: resolvedId });
      return JSON.stringify({
        success: true,
        message: `Added ${product.title} (×${qty}) to your cart.`,
        productId: resolvedId,
        productTitle: product.title,
        quantity: qty,
      }, null, 2);
    } catch (err) {
      logger.error("[games-qa] Tool add_to_cart failed", { ts: new Date().toISOString(), user_id, product_id, error: err.message, stack: err.stack });
      return JSON.stringify({ error: err.message || "Add to cart failed" });
    }
  },
  {
    name: "add_to_cart",
    description: "Add to cart. product_id = id or name. Confirm first.",
    schema: z.object({
      user_id: z.string(),
      product_id: z.string(),
      quantity: z.number().int().optional().default(1).transform((n) => Math.max(1, Math.floor(Number(n) || 1))),
    }),
  }
);

/** Check if user message contains address + payment confirmation. */
function hasAddressAndPaymentConfirmation(userMsg) {
  if (!userMsg || typeof userMsg !== "string") return false;
  const m = String(userMsg).toLowerCase();
  const hasAddress = /\b(default|home|address|1\b|2\b|first|second)\b/.test(m) || OBJECT_ID_REGEX.test(m);
  const hasPayment = /\b(upi|card|netbanking|mock_upi|mock_card|mock_netbanking)\b/.test(m);
  return hasAddress && hasPayment;
}

/**
 * Buy product: create order, payment, confirm. Agent must get address_id, payment_method, checkout_scope from user first.
 */
const buy_for_me = tool(
  async ({ user_id, product_id, address_id, payment_method, quantity, checkout_scope, user_confirmation }) => {
    const toolStart = Date.now();
    const ts = new Date().toISOString();
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const scope = checkout_scope === "full_cart" ? "full_cart" : "single";
    logger.info("[games-qa] Tool buy_for_me called", { ts, user_id, product_id, address_id, payment_method, quantity: qty, checkout_scope: scope });
    try {
      if (!hasAddressAndPaymentConfirmation(user_confirmation)) {
        return JSON.stringify({
          error: "User must explicitly confirm address and payment in their message. Ask: 'Which address and payment method would you like to use?' Do not call buy_for_me until user replies with both (e.g. 'default address and UPI').",
          code: "CONFIRMATION_REQUIRED",
        });
      }

      const validMethods = PAYMENT_METHOD;
      if (!validMethods.includes(payment_method)) {
        return JSON.stringify({ error: "Invalid payment method. Use mock_card, mock_upi, or mock_netbanking.", payment_method });
      }

      let resolvedAddressId = address_id;
      if (!resolvedAddressId || String(resolvedAddressId).toLowerCase().trim() === "default") {
        const addresses = await addressService.getAddressesByUserId(user_id);
        const defaultAddr = (addresses || []).find((a) => a.isDefault);
        if (!defaultAddr) {
          return JSON.stringify({ error: "No default address. Call get_user_addresses and ask user to pick an address or set a default.", code: "NO_DEFAULT_ADDRESS" });
        }
        resolvedAddressId = defaultAddr._id?.toString();
        logger.info("[games-qa] buy_for_me: resolved address_id 'default' to", { resolvedAddressId });
      }
      if (!OBJECT_ID_REGEX.test(resolvedAddressId)) {
        return JSON.stringify({ error: "Invalid address_id. Use 24-char hex id from get_user_addresses, or 'default' for default address.", address_id });
      }

      const resolvedId = await resolveProductId(product_id);
      if (!resolvedId) {
        return JSON.stringify({ error: "Product not found. Use product id from list_products or product, or the exact game name.", productIdOrName: product_id });
      }

      let order;
      if (scope === "single") {
        const result = await orderService.createOrderForProduct(user_id, resolvedId, qty, resolvedAddressId);
        if (result.code !== "OK") {
          const msg = result.code === "PRODUCT_NOT_FOUND" ? "Product not found or inactive."
            : result.code === "OUT_OF_STOCK" ? "Product is out of stock."
              : result.code === "ADDRESS_NOT_FOUND" ? "Address not found." : result.code;
          return JSON.stringify({ error: msg, code: result.code });
        }
        order = result.order;
      } else {
        const product = await Product.findById(resolvedId).lean();
        if (!product || !product.isActive) {
          return JSON.stringify({ error: "Product not found or inactive", productId: resolvedId });
        }
        if ((product.stock ?? 0) < qty) {
          return JSON.stringify({ error: "Product is out of stock", productId: resolvedId, productTitle: product.title });
        }
        await cartService.addItem(user_id, resolvedId, qty);
        const result = await orderService.createOrderFromCart(user_id, resolvedAddressId);
        if (result.code !== "OK") {
          const msg = result.code === "EMPTY_CART" ? "Cart is empty."
            : result.code === "ADDRESS_NOT_FOUND" ? "Address not found."
              : result.code === "NO_VALID_ITEMS" ? "No valid products in cart." : result.code;
          return JSON.stringify({ error: msg, code: result.code });
        }
        order = result.order;
      }

      const { payment, code: payCode } = await paymentService.createPaymentForOrder(order._id, user_id, payment_method);
      if (payCode !== "OK" || !payment) {
        return JSON.stringify({ error: "Failed to create payment", code: payCode });
      }

      const { payment: capturedPayment, code: confirmCode } = await paymentService.confirmPayment(payment._id, user_id);
      if (confirmCode !== "OK" && confirmCode !== "ALREADY_CAPTURED") {
        return JSON.stringify({ error: "Payment confirmation failed", code: confirmCode });
      }

      const invoice = await invoiceService.getInvoiceByOrderId(order._id, user_id);
      const invoiceId = invoice?._id?.toString();

      if (scope === "single") {
        await cartService.removeItem(user_id, resolvedId);
      }

      const durationMs = Date.now() - toolStart;
      logger.info("[games-qa] Tool buy_for_me completed", { ts: new Date().toISOString(), durationMs, orderId: order._id, invoiceId });
      return JSON.stringify({
        success: true,
        message: "Purchase complete!",
        orderId: order._id.toString(),
        invoiceId: invoiceId || null,
        productId: resolvedId,
        totalAmount: order.totalAmount,
        status: "completed",
        items: order.items?.map((i) => ({ title: i.title, quantity: i.quantity, price: i.price })) || [],
      }, null, 2);
    } catch (err) {
      logger.error("[games-qa] Tool buy_for_me failed", { ts: new Date().toISOString(), user_id, product_id, error: err.message, stack: err.stack });
      return JSON.stringify({ error: err.message || "Buy failed" });
    }
  },
  {
    name: "buy_for_me",
    description: "Purchase. REQ: user_confirmation = exact phrase from user's last message. Must contain address (default/home/address) AND payment (upi/card/netbanking). Reject if user said only 'buy it' or 'yes'. product_id = id or name. address_id, payment_method, checkout_scope.",
    schema: z.object({
      user_id: z.string(),
      product_id: z.string(),
      address_id: z.string(),
      payment_method: z.enum(PAYMENT_METHOD),
      quantity: z.number().int().optional().default(1).transform((n) => Math.max(1, Math.floor(Number(n) || 1))),
      checkout_scope: z.enum(["single", "full_cart"]).optional().default("single"),
      user_confirmation: z.string(),
    }),
  }
);

module.exports = {
  listProducts,
  getProduct,
  getProductReviews,
  get_user_preferences,
  save_user_preference,
  create_product_alert,
  list_my_alerts,
  get_user_addresses,
  get_user_cart,
  get_payment_options,
  add_to_cart,
  buy_for_me,
};
