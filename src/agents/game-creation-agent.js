const { ChatGroq } = require("@langchain/groq");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { createAgent } = require("langchain");
const { HumanMessage } = require("@langchain/core/messages");
const { createUsageRecordingHandler } = require("../utils/llmUsageRecordingHandler");
const {
  searchWeb,
  searchImages,
  uploadToS3,
  findGameByTitle,
  updateGameProduct,
  createGameProduct,
} = require("./tools/game-creation-tools");
const logger = require("../config/logger");

// Prefer Groq when GROQ_API_KEY is set (500+ t/s, generous free tier); else fall back to Gemini
// Groq models: llama-3.3-70b-versatile (recommended for tool calling), llama-3.1-8b-instant
const groqKey = process.env.GROQ_API_KEY;
const llm = groqKey
  ? new ChatGroq({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      apiKey: groqKey,
      maxTokens: 2048,
      temperature: 0,
    })
  : new ChatGoogleGenerativeAI({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      apiKey: process.env.GOOGLE_API_KEY,
      maxOutputTokens: 2048,
      temperature: 0,
    });

/**
 * Create the Game Creation agent, optionally with extra tools (e.g. handoff tools for swarm).
 * @param {{ extraTools?: Array<import("@langchain/core/tools").StructuredToolInterface> }} [options] - extraTools: tools to add (e.g. createHandoffTool to hand back to Games Q&A)
 * @returns {ReturnType<typeof createAgent>}
 */
function createGameCreationAgent(options = {}) {
  const { extraTools = [] } = options;
  const tools = [findGameByTitle, searchWeb, searchImages, uploadToS3, updateGameProduct, createGameProduct, ...extraTools];
  return createAgent({
    model: llm,
    tools,
    name: "GameCreation",
    systemPrompt: `You are an admin assistant that adds or enriches games in the store.

CRITICAL: Always do this in order.

STEP 1 – Check if the game exists
- Call find_game_by_title with the game name. This returns either found: false or found: true with productId and which fields are empty (needsCoverImage, needsYoutubeLinks, needsDescription, needsShortDescription).

STEP 2a – If the game EXISTS (found: true)
- Do NOT call create_game_product. You must only UPDATE the existing product.
- If needsCoverImage: call search_images with "[game name] game cover art", then upload_to_s3 with the chosen image URL. Only pass coverImage to update_game_product if upload_to_s3 returned a success URL. If search_images or upload_to_s3 fails (e.g. 403), do not pass coverImage.
- If needsYoutubeLinks: call search_web with "[game name] official trailer youtube", "[game name] Gameranx review", "[game name] IGN review". Only pass youtubeLinks if search_web succeeded and returned results that clearly point to official trailer or Gameranx/IGN. If search_web failed (e.g. 403), do NOT pass youtubeLinks—leave them empty.
- Call update_game_product once with the productId and only the fields you successfully filled. Never pass or update stock.
- Then respond with the productId and what you updated.

STEP 2b – If the game DOES NOT exist (found: false)
- Cover image (required): call search_images with "[game name] game cover art", then upload_to_s3 with the best image URL. Use the URL returned by upload_to_s3 as coverImage. If search_images or upload_to_s3 fails (e.g. 403), still create the product but do not pass a random image URL—the store will use the default cover.
- Use search_web to find description, price, platform (PC/PS5/XBOX/SWITCH), genre. For YouTube links see below.
- Call create_game_product exactly ONCE with title, description, price, platform, genre, coverImage (only if upload_to_s3 succeeded; otherwise omit and default is used), and youtubeLinks only when search_web succeeded and you have real results (see YOUTUBE RULES). Do NOT set stock; it stays 0.
- Then respond with the new productId and title.

YOUTUBE RULES (strict):
- Only add YouTube links that are (1) official game trailer, or (2) Gameranx review, or (3) IGN review. Up to 3 links total.
- Only add youtubeLinks when search_web actually succeeded and returned results that clearly identify such videos (e.g. titles/snippets mentioning "Official Trailer", "Gameranx", "IGN"). If search_web failed (e.g. 403) or returned no usable results, do NOT invent or guess YouTube URLs—leave youtubeLinks empty. Never add famous/meme videos (e.g. Rick Astley, "Me at the zoo") or random gameplay.

RULES:
- Never create a new product if find_game_by_title returned found: true. Only update.
- Never call create_game_product more than once per request.
- Never update or set stock in any tool.
- When search_web or search_images fail (e.g. 403): use the LLM's knowledge only for description, genre, platform, price, shortDescription. Do NOT add youtubeLinks. Do NOT set coverImage unless upload_to_s3 succeeded.`,
  });
}

/** Default agent (no handoff tools). For swarm use, call createGameCreationAgent({ extraTools: [createHandoffTool(...)] }). */
const agent = createGameCreationAgent();

async function runGameCreationAgent(gameName) {
  const provider = process.env.GROQ_API_KEY ? "Groq" : "Gemini";
  const model = process.env.GROQ_API_KEY
    ? (process.env.GROQ_MODEL || "llama-3.3-70b-versatile")
    : (process.env.GEMINI_MODEL || "gemini-2.0-flash");
  logger.info("[game-agent] Agent invoke start", { gameName, provider, model });
  const usageRecorder = new (createUsageRecordingHandler("game-creation"))();
  const result = await agent.invoke(
    { messages: [new HumanMessage(`Add this game to the store: ${gameName}`)] },
    { callbacks: [usageRecorder] }
  );
  const messageCount = result?.messages?.length ?? 0;
  logger.info("[game-agent] Agent invoke complete", { gameName, messageCount });
  return result;
}

module.exports = { agent, createGameCreationAgent, runGameCreationAgent };