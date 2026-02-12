"use strict";

const LlmUsage = require("../models/llmUsage.model");

const DEFAULT_DAYS_RANGE = 30;

function defaultTimeRange(from, to) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end);
  if (!from && !to) {
    start.setDate(start.getDate() - DEFAULT_DAYS_RANGE);
  }
  return { start, end };
}

function getDateFormat(groupBy) {
  switch (groupBy) {
    case "week":
      return "%Y-W%V";
    case "month":
      return "%Y-%m";
    default:
      return "%Y-%m-%d";
  }
}

/**
 * Save a single LLM usage record (call from agent callback).
 */
async function recordUsage(data) {
  const {
    agentType,
    provider,
    model = null,
    inputTokens = 0,
    outputTokens = 0,
    totalTokens = null,
    userId = null,
  } = data;
  if (!agentType || !provider) return null;
  const total = totalTokens ?? (inputTokens + outputTokens);
  const doc = await LlmUsage.create({
    agentType,
    provider: provider.toLowerCase(),
    model,
    inputTokens,
    outputTokens,
    totalTokens: total,
    userId: userId || undefined,
  });
  return doc;
}

/**
 * LLM overview: total requests, total tokens (input/output/total), by agent and provider.
 */
async function getOverview(from, to) {
  const { start, end } = defaultTimeRange(from, to);
  const match = { createdAt: { $gte: start, $lte: end } };

  const [totalRequests, totalTokensAgg, byAgent, byProvider] = await Promise.all([
    LlmUsage.countDocuments(match),
    LlmUsage.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          inputTokens: { $sum: "$inputTokens" },
          outputTokens: { $sum: "$outputTokens" },
          totalTokens: { $sum: "$totalTokens" },
        },
      },
      { $project: { _id: 0 } },
    ]),
    LlmUsage.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$agentType",
          requests: { $sum: 1 },
          inputTokens: { $sum: "$inputTokens" },
          outputTokens: { $sum: "$outputTokens" },
          totalTokens: { $sum: "$totalTokens" },
        },
      },
      { $project: { agentType: "$_id", requests: 1, inputTokens: 1, outputTokens: 1, totalTokens: 1, _id: 0 } },
    ]),
    LlmUsage.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$provider",
          requests: { $sum: 1 },
          inputTokens: { $sum: "$inputTokens" },
          outputTokens: { $sum: "$outputTokens" },
          totalTokens: { $sum: "$totalTokens" },
        },
      },
      { $project: { provider: "$_id", requests: 1, inputTokens: 1, outputTokens: 1, totalTokens: 1, _id: 0 } },
    ]),
  ]);

  const tokens = totalTokensAgg[0] || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  return {
    totalRequests,
    totalInputTokens: tokens.inputTokens ?? 0,
    totalOutputTokens: tokens.outputTokens ?? 0,
    totalTokens: tokens.totalTokens ?? 0,
    byAgent: byAgent.map((r) => ({ ...r, agentType: r.agentType ?? "unknown" })),
    byProvider: byProvider.map((r) => ({ ...r, provider: r.provider ?? "unknown" })),
  };
}

/**
 * Token usage per period (day/week/month).
 */
async function getUsageByPeriod(from, to, groupBy) {
  const { start, end } = defaultTimeRange(from, to);
  const format = getDateFormat(groupBy);
  const result = await LlmUsage.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { $dateToString: { date: "$createdAt", format } },
        requests: { $sum: 1 },
        inputTokens: { $sum: "$inputTokens" },
        outputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: "$_id",
        requests: 1,
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 1,
        _id: 0,
      },
    },
  ]);
  return result;
}

module.exports = {
  recordUsage,
  getOverview,
  getUsageByPeriod,
};
