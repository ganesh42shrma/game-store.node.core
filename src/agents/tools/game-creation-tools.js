const { tool } = require("langchain");
const z = require("zod");
const axios = require("axios");
const { getS3Client, getBucket, getPublicBaseUrl } = require("../../config/s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const productService = require("../../services/product.service");
const { DEFAULT_COVER_IMAGE_URL } = require("../../models/product.model");
const logger = require("../../config/logger");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

// YouTube video IDs to never save (meme/viral/non-game). Filter these out so we never persist them even if the LLM returns them.
const BLOCKED_YOUTUBE_IDS = new Set([
  "dQw4w9WgXcQ",   // Rickroll
  "jNQXAC9IVRw",   // "Me at the zoo"
  "9bZkp7q19f0",   // Gangnam Style
  "kJQP7kiw5Fk",   // Despacito
  "RgKAFK5djSk",   // See You Again
  "OPf0YbXqDm0",   // Uptown Funk
  "hT_nvWreIhg",   // Counting Stars
  "09R8_2nJtjg",   // Maroon 5 Sugar
  "CevxZvSJLk8",   // Katy Perry Roar
  "YQHsXMglC9A",   // Adele Hello
]);

function extractYoutubeVideoId(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (/youtube\.com/i.test(u.hostname) && u.searchParams.has("v")) return u.searchParams.get("v");
  } catch (_) {}
  return null;
}

function filterYoutubeLinks(links) {
  if (!Array.isArray(links)) return [];
  const filtered = links
    .filter((url) => {
      const id = extractYoutubeVideoId(url);
      if (!id) return false;
      if (BLOCKED_YOUTUBE_IDS.has(id)) {
        logger.warn("[game-agent] Blocked known non-game YouTube video", { videoId: id, url: url.slice(0, 60) });
        return false;
      }
      return true;
    })
    .slice(0, 3);
  return filtered;
}

/**
 * Search the web for text (game info, price, trailers, etc.).
 * Uses Google Custom Search JSON API (no searchType = web search).
 */
const searchWeb = tool(
  async ({ query }) => {
    logger.info("[game-agent] Tool search_web called", { query });
    const key = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CSE_ID;
    if (!key || !cx) {
      logger.warn("[game-agent] Tool search_web skipped: GOOGLE_API_KEY or GOOGLE_CSE_ID not set");
      return JSON.stringify({ error: "GOOGLE_API_KEY or GOOGLE_CSE_ID not set" });
    }
    try {
      const { data } = await axios.get("https://www.googleapis.com/customsearch/v1", {
        params: { key, cx, q: query, num: 5 },
        timeout: 10000,
      });
      const items = (data.items || []).map((item) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
      }));
      logger.info("[game-agent] Tool search_web completed", { query, resultCount: items.length });
      return JSON.stringify(items, null, 2);
    } catch (err) {
      logger.error("[game-agent] Tool search_web failed", { query, error: err.message });
      return JSON.stringify({ error: err.message || "Search failed" });
    }
  },
  {
    name: "search_web",
    description: "Search the web for game info. For YouTube links use separate queries: '[game name] official trailer youtube', '[game name] Gameranx review', '[game name] IGN review'. Only use YouTube URLs that are official trailer or Gameranx/IGN reviews—never random gameplay or other channels.",
    schema: z.object({
      query: z.string().describe("Search query (e.g. 'Elden Ring game price PC', 'Hades official trailer youtube', 'Hades IGN review')"),
    }),
  }
);

/**
 * Search for images (e.g. game cover art) via Google Custom Search with searchType=image.
 */
const searchImages = tool(
  async ({ query }) => {
    logger.info("[game-agent] Tool search_images called", { query });
    const key = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CSE_ID;
    if (!key || !cx) {
      logger.warn("[game-agent] Tool search_images skipped: GOOGLE_API_KEY or GOOGLE_CSE_ID not set");
      return JSON.stringify({ error: "GOOGLE_API_KEY or GOOGLE_CSE_ID not set" });
    }
    try {
      const { data } = await axios.get("https://www.googleapis.com/customsearch/v1", {
        params: {
          key,
          cx,
          q: query,
          searchType: "image",
          num: 3,
          imgSize: "MEDIUM",
        },
        timeout: 10000,
      });
      const images = (data.items || []).map((item) => ({
        url: item.link,
        title: item.title,
        source: item.displayLink,
      }));
      logger.info("[game-agent] Tool search_images completed", { query, resultCount: images.length });
      return JSON.stringify(images, null, 2);
    } catch (err) {
      logger.error("[game-agent] Tool search_images failed", { query, error: err.message });
      return JSON.stringify({ error: err.message || "Image search failed" });
    }
  },
  {
    name: "search_images",
    description: "Search the internet for images. Returns array of { url, title, source }. Use for game cover art.",
    schema: z.object({
      query: z.string().describe("Image search query (e.g. 'Elden Ring game cover art')"),
    }),
  }
);

/**
 * Download image from URL and upload to S3. Returns public URL.
 * Uses app S3 config (getBucket(), getPublicBaseUrl()).
 */
const uploadToS3 = tool(
  async ({ imageUrl, key }) => {
    logger.info("[game-agent] Tool upload_to_s3 called", { imageUrl: imageUrl?.slice?.(0, 80), key });
    const s3 = getS3Client();
    const bucket = getBucket();
    if (!s3 || !bucket) {
      logger.warn("[game-agent] Tool upload_to_s3 skipped: S3 not configured");
      return "Error: S3 is not configured (missing AWS credentials or S3_BUCKET).";
    }
    try {
      const res = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 10000,
        maxContentLength: MAX_IMAGE_BYTES,
        validateStatus: (status) => status === 200,
        headers: {
          "User-Agent": "GameStoreBot/1.0 (https://github.com/game-store; admin image fetch)",
          Accept: "image/*",
        },
      });
      const buffer = Buffer.from(res.data);
      const contentType = (res.headers["content-type"] || "image/jpeg").split(";")[0].trim();
      if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
        logger.warn("[game-agent] Tool upload_to_s3 rejected: unsupported content type", { contentType });
        return `Error: Unsupported content type ${contentType}. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}.`;
      }
      const s3Key = key || `products/covers/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: contentType,
        })
      );
      const baseUrl = getPublicBaseUrl();
      const publicUrl = `${baseUrl}/${s3Key}`;
      logger.info("[game-agent] Tool upload_to_s3 completed", { s3Key, publicUrl: publicUrl.slice(0, 80) });
      return `Uploaded. Public URL: ${publicUrl}`;
    } catch (err) {
      logger.error("[game-agent] Tool upload_to_s3 failed", { imageUrl: imageUrl?.slice?.(0, 80), error: err.message });
      return `Upload failed: ${err.message || err}`;
    }
  },
  {
    name: "upload_to_s3",
    description: "Download image from a public URL and upload to the app S3 bucket. Returns the public image URL to use as coverImage.",
    schema: z.object({
      imageUrl: z.string().url().describe("Public image URL to download"),
      key: z.string().optional().describe("S3 object key (e.g. products/covers/game-name.jpg). Optional."),
    }),
  }
);

/**
 * Find an existing game product by title (case-insensitive). Use this FIRST before creating or updating.
 * Returns whether the game exists, its productId, and which fields are empty (need to be filled).
 */
const findGameByTitle = tool(
  async ({ title }) => {
    logger.info("[game-agent] Tool find_game_by_title called", { title });
    try {
      const product = await productService.findProductByTitle(title);
      if (!product) {
        logger.info("[game-agent] Tool find_game_by_title: no product found", { title });
        return JSON.stringify({ found: false, message: "No product found with this title. You should create it with create_game_product." });
      }
      const productId = product._id.toString();
      const cover = product.coverImage || "";
      const hasCoverImage = !!(cover && cover !== DEFAULT_COVER_IMAGE_URL);
      const youtubeLinks = product.youtubeLinks || [];
      const hasYoutubeLinks = youtubeLinks.length > 0;
      const hasDescription = !!(product.description && product.description.trim().length > 20);
      const hasShortDescription = !!(product.shortDescription && product.shortDescription.trim().length > 0);
      const summary = {
        found: true,
        productId,
        title: product.title,
        needsCoverImage: !hasCoverImage,
        needsYoutubeLinks: !hasYoutubeLinks,
        needsDescription: !hasDescription,
        needsShortDescription: !hasShortDescription,
        message: "Product exists. Use update_game_product to fill only the missing fields (needsCoverImage, needsYoutubeLinks, etc.). Do NOT create a new product.",
      };
      logger.info("[game-agent] Tool find_game_by_title completed", { title, productId, summary });
      return JSON.stringify(summary, null, 2);
    } catch (err) {
      logger.error("[game-agent] Tool find_game_by_title failed", { title, error: err.message });
      return JSON.stringify({ found: false, error: err.message });
    }
  },
  {
    name: "find_game_by_title",
    description: "Check if a game already exists in the store by title (case-insensitive). Call this FIRST. Returns found, productId, and which fields are empty (needsCoverImage, needsYoutubeLinks, needsDescription, needsShortDescription). If found, use update_game_product to fill only empty fields; if not found, use create_game_product once.",
    schema: z.object({
      title: z.string().describe("Game title to search for (e.g. 'Hades', 'Elden Ring')"),
    }),
  }
);

/**
 * Update an existing game product. Only pass fields you want to update (e.g. coverImage, youtubeLinks, description). Never update stock.
 * Use when find_game_by_title returned found: true and some of needsCoverImage, needsYoutubeLinks, needsDescription, needsShortDescription are true.
 */
const updateGameProduct = tool(
  async (input) => {
    const { productId, ...fields } = input;
    logger.info("[game-agent] Tool update_game_product called", { productId, fields: Object.keys(fields) });
    const updateData = {};
    if (fields.coverImage != null) updateData.coverImage = fields.coverImage;
    if (fields.youtubeLinks != null) updateData.youtubeLinks = filterYoutubeLinks(fields.youtubeLinks);
    if (fields.description != null) updateData.description = String(fields.description);
    if (fields.shortDescription != null) updateData.shortDescription = String(fields.shortDescription).slice(0, 300);
    if (fields.price != null) updateData.price = Number(fields.price);
    if (fields.platform != null) updateData.platform = fields.platform;
    if (fields.genre != null) updateData.genre = fields.genre;
    if (fields.tags != null) updateData.tags = Array.isArray(fields.tags) ? fields.tags.slice(0, 20) : [];
    if (fields.isOnSale != null) updateData.isOnSale = Boolean(fields.isOnSale);
    if (fields.discountedPrice != null) updateData.discountedPrice = fields.discountedPrice === null ? null : Number(fields.discountedPrice);
    if (Object.keys(updateData).length === 0) {
      logger.warn("[game-agent] Tool update_game_product: no fields to update", { productId });
      return JSON.stringify({ success: true, productId, message: "No fields to update." });
    }
    try {
      const product = await productService.updateProduct(productId, updateData);
      logger.info("[game-agent] Tool update_game_product completed", { productId, title: product?.title });
      return JSON.stringify({
        success: true,
        productId,
        title: product?.title,
        updated: Object.keys(updateData),
        message: `Updated product "${product?.title}".`,
      });
    } catch (err) {
      logger.error("[game-agent] Tool update_game_product failed", { productId, error: err.message });
      return JSON.stringify({ success: false, productId, error: err.message || "Update failed" });
    }
  },
  {
    name: "update_game_product",
    description: "Update an existing game product. Pass productId and only the fields to fill (coverImage, youtubeLinks, description, shortDescription, price, platform, genre, tags). youtubeLinks: only official game trailer or Gameranx/IGN review URLs. Never pass or update stock.",
    schema: z.object({
      productId: z.string().describe("MongoDB ObjectId of the product to update"),
      coverImage: z.string().url().optional(),
      youtubeLinks: z.array(z.string().url()).max(3).optional().describe("Only official trailer or Gameranx/IGN review YouTube URLs"),
      description: z.string().optional(),
      shortDescription: z.string().max(300).optional(),
      price: z.number().min(0.01).optional(),
      platform: z.enum(["PC", "PS5", "XBOX", "SWITCH"]).optional(),
      genre: z.string().optional(),
      tags: z.array(z.string()).max(20).optional(),
      isOnSale: z.boolean().optional(),
      discountedPrice: z.number().min(0).nullable().optional(),
    }),
  }
);

/**
 * Create a new game product in the database. Do not set stock; it defaults to 0.
 * Call this ONLY when find_game_by_title returned found: false. Never create if the game already exists.
 */
const createGameProduct = tool(
  async (input) => {
    logger.info("[game-agent] Tool create_game_product called", {
      title: input.title,
      platform: input.platform,
      genre: input.genre,
      price: input.price,
    });
    const payload = {
      title: input.title,
      description: input.description,
      shortDescription: input.shortDescription || "",
      price: Number(input.price),
      platform: input.platform,
      genre: input.genre,
      coverImage: input.coverImage && input.coverImage.startsWith("http") ? input.coverImage : DEFAULT_COVER_IMAGE_URL,
      youtubeLinks: filterYoutubeLinks(input.youtubeLinks),
      tags: Array.isArray(input.tags) ? input.tags.slice(0, 20) : [],
      stock: 0,
      isActive: true,
    };
    if (input.isOnSale !== undefined) payload.isOnSale = Boolean(input.isOnSale);
    if (input.discountedPrice != null) payload.discountedPrice = Number(input.discountedPrice);
    try {
      const product = await productService.createProduct(payload);
      const productId = product._id.toString();
      logger.info("[game-agent] Tool create_game_product completed", { productId, title: product.title });
      return JSON.stringify({
        success: true,
        productId,
        title: product.title,
        message: `Product "${product.title}" created. Stock is 0; update it in admin if needed.`,
      });
    } catch (err) {
      logger.error("[game-agent] Tool create_game_product failed", { title: input.title, error: err.message });
      return JSON.stringify({ success: false, error: err.message || "Create failed" });
    }
  },
  {
    name: "create_game_product",
    description: "Create a new game product ONLY when find_game_by_title returned found: false. Pass coverImage only when upload_to_s3 succeeded; otherwise omit to use default. youtubeLinks: only when search_web succeeded with official trailer or Gameranx/IGN results (up to 3). Never set stock; it stays 0. Call at most once per request.",
    schema: z.object({
      title: z.string().describe("Game title"),
      description: z.string().describe("Full game description"),
      shortDescription: z.string().max(300).optional(),
      price: z.number().min(0.01).describe("Price (min 0.01)"),
      platform: z.enum(["PC", "PS5", "XBOX", "SWITCH"]),
      genre: z.string(),
      coverImage: z.string().url().optional().describe("Public URL from upload_to_s3; omit if upload failed (default cover will be used)"),
      youtubeLinks: z.array(z.string().url()).max(3).optional().describe("Only official game trailer or Gameranx/IGN review YouTube URLs"),
      tags: z.array(z.string()).max(20).optional(),
      isOnSale: z.boolean().optional(),
      discountedPrice: z.number().min(0).nullable().optional(),
    }),
  }
);

module.exports = {
  searchWeb,
  searchImages,
  uploadToS3,
  findGameByTitle,
  updateGameProduct,
  createGameProduct,
};