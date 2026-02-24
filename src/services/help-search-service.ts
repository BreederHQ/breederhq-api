// src/services/help-search-service.ts
// RAG pipeline: semantic retrieval + Claude Haiku generation for the help system.
// Handles: vector search, keyword fallback, prompt construction, streaming, rate limiting.

import prisma from "../prisma.js";
import { getAnthropicClient } from "./anthropic-client.js";
import { embedQuery } from "./voyage-client.js";
import { checkEntitlement } from "./subscription/entitlement-service.js";

// ---------- Types ----------

export interface HelpChunk {
  slug: string;
  title: string;
  module: string;
  chunkText: string;
  score: number;
}

export interface ArticleMeta {
  slug: string;
  title: string;
  module: string;
  tags: string[];
  summary: string | null;
}

export interface RateLimitState {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // UTC midnight timestamp (seconds)
}

// ---------- In-memory burst throttle ----------
// Tracks timestamps of recent queries per user to enforce burst limit.
// Map<userId, timestamp[]> — timestamps are pruned on each check.

const burstMap = new Map<string, number[]>();
const BURST_WINDOW_MS = 60_000; // 1 minute rolling window
const BURST_MAX = Number(process.env.HELP_BURST_LIMIT ?? "3");

function checkBurst(userId: string): boolean {
  const now = Date.now();
  const timestamps = (burstMap.get(userId) ?? []).filter(
    (t) => now - t < BURST_WINDOW_MS
  );
  if (timestamps.length >= BURST_MAX) return false;
  timestamps.push(now);
  burstMap.set(userId, timestamps);
  return true;
}

// ---------- Daily rate limit ----------

/**
 * Returns rate limit state for a user.
 * Limit comes from ProductEntitlement.limitValue for AI_ASSISTANT (admin-configurable).
 */
export async function getRateLimitState(
  userId: string,
  tenantId: number
): Promise<RateLimitState> {
  // Get configured daily limit from entitlement
  const entitlement = await checkEntitlement(tenantId, "AI_ASSISTANT");
  const limit = entitlement.limitValue ?? 20; // default 20 if limitValue is null

  // Count queries today
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const count = await prisma.helpQueryLog.count({
    where: {
      userId,
      createdAt: { gte: todayStart },
    },
  });

  // UTC midnight reset timestamp
  const resetAt = new Date();
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  resetAt.setUTCHours(0, 0, 0, 0);

  return {
    allowed: count < limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: Math.floor(resetAt.getTime() / 1000),
  };
}

// ---------- Semantic search ----------

/**
 * Search help articles using vector similarity (cosine distance via pgvector).
 * Falls back to keyword search if Voyage AI is unavailable.
 */
export async function searchArticles(
  query: string,
  opts: { module?: string; limit?: number } = {}
): Promise<HelpChunk[]> {
  const limit = opts.limit ?? 5;

  try {
    const embedding = await embedQuery(query);
    const vectorStr = `[${embedding.join(",")}]`;

    // Raw SQL for pgvector cosine similarity search with optional module filter
    const moduleFilter = opts.module
      ? `AND module = '${opts.module.replace(/'/g, "''")}'`
      : "";

    const rows = await prisma.$queryRawUnsafe<
      Array<{ slug: string; title: string; module: string; chunkText: string; score: number }>
    >(
      `SELECT slug, title, module, "chunkText",
              1 - (embedding <=> '${vectorStr}'::vector) AS score
       FROM "public"."HelpArticleEmbedding"
       WHERE 1=1 ${moduleFilter}
       ORDER BY embedding <=> '${vectorStr}'::vector
       LIMIT ${limit}`
    );

    return rows;
  } catch (err) {
    console.error("[help-search] Vector search failed, falling back to keyword:", err);
    return searchArticlesKeyword(query, opts);
  }
}

/**
 * Keyword search fallback using PostgreSQL full-text ILIKE.
 * Used when Voyage AI is unavailable or for simple queries.
 */
export async function searchArticlesKeyword(
  query: string,
  opts: { module?: string; limit?: number } = {}
): Promise<HelpChunk[]> {
  const limit = opts.limit ?? 5;
  const term = `%${query.replace(/[%_]/g, "\\$&")}%`;

  const rows = await prisma.helpArticleEmbedding.findMany({
    where: {
      ...(opts.module ? { module: opts.module } : {}),
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { chunkText: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { slug: true, title: true, module: true, chunkText: true },
    take: limit,
  });

  return rows.map((r: { slug: string; title: string; module: string; chunkText: string }) => ({ ...r, score: 0 }));
}

// ---------- Article browsing ----------

export async function listArticles(opts: {
  module?: string;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<{ articles: ArticleMeta[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
  const skip = (page - 1) * limit;

  const where = {
    chunkIndex: 0, // Only first chunk per article for metadata
    ...(opts.module ? { module: opts.module } : {}),
    ...(opts.q
      ? {
          OR: [
            { title: { contains: opts.q, mode: "insensitive" as const } },
            { summary: { contains: opts.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.helpArticleEmbedding.findMany({
      where,
      select: { slug: true, title: true, module: true, tags: true, summary: true },
      orderBy: { module: "asc" },
      skip,
      take: limit,
    }),
    prisma.helpArticleEmbedding.count({ where }),
  ]);

  return { articles: rows, total };
}

export async function getArticle(slug: string): Promise<{
  slug: string;
  title: string;
  module: string;
  tags: string[];
  summary: string | null;
  content: string;
} | null> {
  // Get all chunks for this slug, ordered, then reassemble content
  const chunks = await prisma.helpArticleEmbedding.findMany({
    where: { slug },
    orderBy: { chunkIndex: "asc" },
    select: { slug: true, title: true, module: true, tags: true, summary: true, chunkText: true },
  });

  if (chunks.length === 0) return null;

  const first = chunks[0];
  return {
    slug: first.slug,
    title: first.title,
    module: first.module,
    tags: first.tags,
    summary: first.summary ?? null,
    content: chunks.map((c: { chunkText: string }) => c.chunkText).join("\n\n"),
  };
}

// ---------- AI response generation ----------

const SYSTEM_PROMPT = `You are BHQ Assistant, the built-in help guide for BreederHQ — a comprehensive animal breeding management platform.

RULES:
- ONLY answer questions about BreederHQ platform features and workflows
- Ground ALL answers in the provided CONTEXT documents below
- If the context does not contain enough information, say: "I don't have detailed information about that in my current knowledge base. Try browsing the Help Center articles or contact our support team."
- NEVER invent features, settings, or workflows that are not mentioned in the context
- Use markdown formatting for clarity (numbered steps, bold key terms, code for field names)
- Keep answers focused and concise — prefer 3-5 steps over lengthy paragraphs
- Adapt language to the user's species context when provided
- Always cite sources using article slugs at the end of your response in format: [Source: slug-name]
- If asked anything unrelated to BreederHQ, politely decline and redirect to platform help`;

/**
 * Stream a Claude Haiku AI response with RAG context over SSE.
 * The caller (route handler) is responsible for writing SSE to reply.raw.
 *
 * @yields SSE-formatted strings ready to write to reply.raw
 */
export async function* streamHelpResponse(opts: {
  query: string;
  userId: string;
  tenantId: number;
  module?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}): AsyncGenerator<string> {
  const { query, userId, tenantId, module, conversationHistory = [] } = opts;

  // 1. Burst throttle check
  if (!checkBurst(userId)) {
    yield `data: ${JSON.stringify({ type: "error", message: "Too many requests. Please wait a moment.", code: "RATE_LIMITED" })}\n\n`;
    return;
  }

  // 2. Daily rate limit check
  const rateLimit = await getRateLimitState(userId, tenantId);
  if (!rateLimit.allowed) {
    yield `data: ${JSON.stringify({
      type: "error",
      message: `You've reached your daily limit of ${rateLimit.limit} questions. Resets at midnight UTC.`,
      code: "RATE_LIMITED",
    })}\n\n`;
    return;
  }

  // 3. Retrieve relevant context via RAG
  const chunks = await searchArticles(query, { module, limit: 5 });
  const contextBlock = chunks.length > 0
    ? chunks
        .map((c, i) => `[${i + 1}] ${c.title} (${c.slug})\n${c.chunkText}`)
        .join("\n\n---\n\n")
    : "No specific articles found. Answer based on general BreederHQ knowledge if possible.";

  // 4. Build messages for Claude
  const systemWithContext = `${SYSTEM_PROMPT}\n\nCONTEXT:\n${contextBlock}${
    module ? `\n\nUSER CONTEXT: Currently viewing module: ${module}` : ""
  }`;

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...conversationHistory.slice(-6), // Last 3 exchanges for context
    { role: "user", content: query },
  ];

  // 5. Stream Claude response
  const startMs = Date.now();
  let fullResponse = "";
  const sourceSlugs = [...new Set(chunks.map((c) => c.slug))];
  let queryLogId: number | null = null;

  try {
    const anthropic = getAnthropicClient();
    const stream = await anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemWithContext,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const text = event.delta.text;
        fullResponse += text;
        yield `data: ${JSON.stringify({ type: "chunk", text })}\n\n`;
      }
    }

    const finalMsg = await stream.finalMessage();
    const tokenCount = finalMsg.usage?.input_tokens + finalMsg.usage?.output_tokens;
    const latencyMs = Date.now() - startMs;

    // 6. Log query for analytics and rate limiting
    const log = await prisma.helpQueryLog.create({
      data: {
        userId,
        tenantId,
        query,
        response: fullResponse,
        sourceSlugs,
        modelUsed: "claude-haiku-4-5-20251001",
        tokenCount,
        latencyMs,
      },
    });
    queryLogId = log.id;
  } catch (err) {
    console.error("[help-search] Claude streaming error:", err);
    yield `data: ${JSON.stringify({ type: "error", message: "AI assistant is temporarily unavailable. Browse the Help Center articles instead.", code: "AI_UNAVAILABLE" })}\n\n`;
    return;
  }

  // 7. Send sources and done events
  yield `data: ${JSON.stringify({ type: "sources", slugs: sourceSlugs, queryLogId })}\n\n`;
  yield `data: ${JSON.stringify({ type: "done" })}\n\n`;
}
