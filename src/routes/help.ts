// src/routes/help.ts
// Help system API: article browsing, semantic search, AI chat (SSE), and preferences.

import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";

// Admin token auth for CI/CD indexing (same ADMIN_TOKEN used by invites.ts)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
function isAdminTokenRequest(req: FastifyRequest): boolean {
  if (!ADMIN_TOKEN) return false;
  const hdr = req.headers["authorization"] || req.headers["x-admin-token"];
  const got = typeof hdr === "string" && hdr.startsWith("Bearer ") ? hdr.slice(7) : (hdr as string | undefined);
  return got === ADMIN_TOKEN;
}
import { requireEntitlement } from "../middleware/quota-enforcement.js";
import {
  listArticles,
  getArticle,
  searchArticles,
  searchArticlesKeyword,
  streamHelpResponse,
  getRateLimitState,
} from "../services/help-search-service.js";
import { streamCopilotResponse } from "../services/copilot/index.js";
import { embedTexts, EMBEDDING_DIMS } from "../services/voyage-client.js";
import { createHash } from "node:crypto";

// ---------- Chunking ----------

const CHUNK_SIZE = 800; // ~800 token target; rough approximation by word count
const CHUNK_OVERLAP = 100;

function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  if (words.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + CHUNK_SIZE, words.length);
    chunks.push(words.slice(start, end).join(" "));
    // Stop once we've consumed to the end of the text.
    // Without this break, start = end - CHUNK_OVERLAP stays < words.length
    // and the loop repeats the final chunk infinitely.
    if (end >= words.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

// ---------- Routes ----------

export default async function helpRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // ─────────────────────────────────────────────────────────────────────────
  // GET /help/articles — browse articles with optional module filter + keyword search
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/help/articles", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const q = req.query as Record<string, string>;
    const result = await listArticles({
      module: q.module,
      q: q.q,
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 25,
    });

    return reply.send(result);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /help/articles/:slug — get full article content
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/help/articles/:slug", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const { slug } = req.params as { slug: string };
    const article = await getArticle(slug);
    if (!article) return reply.code(404).send({ error: "Article not found" });

    return reply.send(article);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /help/search — semantic search (vector) with keyword fallback
  // ─────────────────────────────────────────────────────────────────────────
  app.post("/help/search", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const { query, module: mod, limit } = req.body as {
      query?: string;
      module?: string;
      limit?: number;
    };

    if (!query?.trim()) {
      return reply.code(400).send({ error: "query is required" });
    }

    const results = await searchArticles(query.trim(), { module: mod, limit });
    return reply.send({ results });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /help/rate-limit — get current AI rate limit state for the user
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/help/rate-limit", { preHandler: [requireEntitlement("AI_ASSISTANT")] }, async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });
    const tenantId = (req as any).tenantId as number;
    if (!tenantId) return reply.code(403).send({ error: "tenant required" });

    const rateLimit = await getRateLimitState(userId, tenantId);
    return reply.send(rateLimit);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /help/chat — AI chat with SSE streaming (Pro/Enterprise only)
  // Middleware: requireEntitlement('AI_ASSISTANT') enforces tier gating.
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    "/help/chat",
    { preHandler: [requireEntitlement("AI_ASSISTANT")] },
    async (req, reply) => {
      const userId = getActorId(req);
      if (!userId) return reply.code(401).send({ error: "unauthorized" });

      const tenantId = (req as any).tenantId as number;
      if (!tenantId) return reply.code(403).send({ error: "tenant required" });

      const { query, module: mod, conversationHistory } = req.body as {
        query?: string;
        module?: string;
        conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
      };

      if (!query?.trim()) {
        return reply.code(400).send({ error: "query is required" });
      }

      // Get rate limit state for response headers
      const rateLimit = await getRateLimitState(userId, tenantId);

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.resetAt),
      });

      // Stream response chunks
      for await (const sseChunk of streamHelpResponse({
        query: query.trim(),
        userId,
        tenantId,
        module: mod,
        conversationHistory,
      })) {
        reply.raw.write(sseChunk);
      }

      reply.raw.end();
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /help/copilot/chat — AI Copilot with tool use + agentic loop (SSE)
  // Requires COPILOT entitlement (Pro: 15/day, Enterprise: 50/day).
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    "/help/copilot/chat",
    { preHandler: [requireEntitlement("COPILOT" as any)] },
    async (req, reply) => {
      const userId = getActorId(req);
      if (!userId) return reply.code(401).send({ error: "unauthorized" });

      const tenantId = (req as any).tenantId as number;
      if (!tenantId) return reply.code(403).send({ error: "tenant required" });

      const { query, module: mod, entityType, entityId, conversationHistory } = req.body as {
        query?: string;
        module?: string;
        entityType?: string;
        entityId?: string;
        conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
      };

      if (!query?.trim()) {
        return reply.code(400).send({ error: "query is required" });
      }

      // Get rate limit state for response headers
      const rateLimit = await getRateLimitState(userId, tenantId, "COPILOT");

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.resetAt),
      });

      // Stream copilot response with tool use
      for await (const sseChunk of streamCopilotResponse({
        query: query.trim(),
        userId,
        tenantId,
        module: mod,
        entityType,
        entityId,
        conversationHistory,
      })) {
        reply.raw.write(sseChunk);
      }

      reply.raw.end();
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /help/feedback — submit thumbs up/down on an AI response
  // ─────────────────────────────────────────────────────────────────────────
  app.post("/help/feedback", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const { queryLogId, rating, text } = req.body as {
      queryLogId?: number;
      rating?: number;
      text?: string;
    };

    if (!queryLogId || (rating !== 1 && rating !== -1)) {
      return reply.code(400).send({ error: "queryLogId and rating (1 or -1) required" });
    }

    // Verify ownership before updating
    const log = await prisma.helpQueryLog.findFirst({
      where: { id: queryLogId, userId },
    });
    if (!log) return reply.code(404).send({ error: "Query log not found" });

    await prisma.helpQueryLog.update({
      where: { id: queryLogId },
      data: {
        feedbackRating: rating,
        feedbackText: text ?? null,
      },
    });

    return reply.code(204).send();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Conversation persistence — CRUD for AI chat conversations
  // Uses raw SQL because HelpConversation model requires migration to be applied.
  // ─────────────────────────────────────────────────────────────────────────

  /** List conversations (paginated, most recent first). */
  app.get("/help/conversations", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const tenantId = (req as any).tenantId as number;
    const { page = "1", limit = "10", mode } = req.query as {
      page?: string; limit?: string; mode?: string;
    };
    const pg = Math.max(1, Number(page));
    const lim = Math.min(50, Math.max(1, Number(limit)));
    const offset = (pg - 1) * lim;

    const modeFilter = mode ? `AND "mode" = $3` : "";
    const params: unknown[] = [userId, tenantId];
    if (mode) params.push(mode);

    const countSql = `SELECT COUNT(*)::int AS count FROM "public"."HelpConversation" WHERE "userId" = $1 AND "tenantId" = $2 ${modeFilter}`;
    const listSql = `SELECT "id", "title", "mode", "createdAt", "updatedAt"
      FROM "public"."HelpConversation"
      WHERE "userId" = $1 AND "tenantId" = $2 ${modeFilter}
      ORDER BY "updatedAt" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const listParams = [...params, lim, offset];

    const [rows, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ id: number; title: string; mode: string; createdAt: Date; updatedAt: Date }>>(
        listSql, ...listParams
      ),
      prisma.$queryRawUnsafe<[{ count: number }]>(countSql, ...params),
    ]);

    return reply.send({
      conversations: rows,
      total: countResult[0]?.count ?? 0,
      page: pg,
      limit: lim,
    });
  });

  /** Create a new conversation. */
  app.post("/help/conversations", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const tenantId = (req as any).tenantId as number;
    const { title, mode = "copilot", messages: msgs = [] } = req.body as {
      title?: string;
      mode?: string;
      messages?: unknown[];
    };

    const finalTitle = title?.trim() || "New conversation";
    const now = new Date();

    const rows = await prisma.$queryRawUnsafe<[{ id: number }]>(
      `INSERT INTO "public"."HelpConversation" ("userId", "tenantId", "title", "mode", "messages", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
       RETURNING "id"`,
      userId, tenantId, finalTitle, mode, JSON.stringify(msgs), now
    );

    return reply.code(201).send({ id: rows[0].id, title: finalTitle, mode });
  });

  /** Get a conversation with messages. */
  app.get("/help/conversations/:id", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const tenantId = (req as any).tenantId as number;
    const convId = Number((req.params as { id: string }).id);
    if (isNaN(convId)) return reply.code(400).send({ error: "invalid id" });

    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: number; title: string; mode: string; messages: unknown; createdAt: Date; updatedAt: Date }>
    >(
      `SELECT "id", "title", "mode", "messages", "createdAt", "updatedAt"
       FROM "public"."HelpConversation"
       WHERE "id" = $1 AND "userId" = $2 AND "tenantId" = $3`,
      convId, userId, tenantId
    );

    if (rows.length === 0) return reply.code(404).send({ error: "not found" });
    return reply.send(rows[0]);
  });

  /** Update conversation (title and/or messages). */
  app.patch("/help/conversations/:id", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const tenantId = (req as any).tenantId as number;
    const convId = Number((req.params as { id: string }).id);
    if (isNaN(convId)) return reply.code(400).send({ error: "invalid id" });

    const { title, messages: msgs } = req.body as {
      title?: string;
      messages?: unknown[];
    };

    if (!title && !msgs) {
      return reply.code(400).send({ error: "title or messages required" });
    }

    // Verify ownership
    const existing = await prisma.$queryRawUnsafe<[{ id: number }]>(
      `SELECT "id" FROM "public"."HelpConversation" WHERE "id" = $1 AND "userId" = $2 AND "tenantId" = $3`,
      convId, userId, tenantId
    );
    if (!existing?.length) return reply.code(404).send({ error: "not found" });

    const sets: string[] = [`"updatedAt" = $4`];
    const params: unknown[] = [convId, userId, tenantId, new Date()];

    if (title) {
      params.push(title.trim());
      sets.push(`"title" = $${params.length}`);
    }
    if (msgs) {
      params.push(JSON.stringify(msgs));
      sets.push(`"messages" = $${params.length}::jsonb`);
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "public"."HelpConversation" SET ${sets.join(", ")} WHERE "id" = $1 AND "userId" = $2 AND "tenantId" = $3`,
      ...params
    );

    return reply.code(204).send();
  });

  /** Delete a conversation. */
  app.delete("/help/conversations/:id", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const tenantId = (req as any).tenantId as number;
    const convId = Number((req.params as { id: string }).id);
    if (isNaN(convId)) return reply.code(400).send({ error: "invalid id" });

    await prisma.$queryRawUnsafe(
      `DELETE FROM "public"."HelpConversation" WHERE "id" = $1 AND "userId" = $2 AND "tenantId" = $3`,
      convId, userId, tenantId
    );

    return reply.code(204).send();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /help/preferences — get user help preferences (tour completion state)
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/help/preferences", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const prefs = await prisma.userHelpPreference.findUnique({
      where: { userId },
      select: { toursCompleted: true, toursDismissed: true },
    });

    return reply.send({
      toursCompleted: prefs?.toursCompleted ?? [],
      toursDismissed: prefs?.toursDismissed ?? [],
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /help/preferences — mark a tour completed or dismissed
  // ─────────────────────────────────────────────────────────────────────────
  app.patch("/help/preferences", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const { tourCompleted, tourDismissed } = req.body as {
      tourCompleted?: string;
      tourDismissed?: string;
    };

    if (!tourCompleted && !tourDismissed) {
      return reply.code(400).send({ error: "tourCompleted or tourDismissed required" });
    }

    const existing = await prisma.userHelpPreference.findUnique({
      where: { userId },
    });

    const updatedCompleted = tourCompleted
      ? [...new Set([...(existing?.toursCompleted ?? []), tourCompleted])]
      : existing?.toursCompleted ?? [];

    const updatedDismissed = tourDismissed
      ? [...new Set([...(existing?.toursDismissed ?? []), tourDismissed])]
      : existing?.toursDismissed ?? [];

    await prisma.userHelpPreference.upsert({
      where: { userId },
      create: {
        userId,
        toursCompleted: updatedCompleted,
        toursDismissed: updatedDismissed,
      },
      update: {
        toursCompleted: updatedCompleted,
        toursDismissed: updatedDismissed,
      },
    });

    return reply.code(204).send();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /help/admin/stats — AI assistant usage analytics (super-admin only)
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/help/admin/stats", async (req, reply) => {
    if (!isAdminTokenRequest(req)) {
      const userId = getActorId(req);
      if (!userId) return reply.code(401).send({ error: "unauthorized" });
      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
      if (!actor?.isSuperAdmin) return reply.code(403).send({ error: "forbidden" });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7d = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    const last30d = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
    const last14d = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);

    const [totalAgg, todayCount, last7dCount, last30dCount, thumbsUp, thumbsDown, unrated] = await Promise.all([
      prisma.helpQueryLog.aggregate({ _count: { id: true }, _sum: { tokenCount: true }, _avg: { latencyMs: true } }),
      prisma.helpQueryLog.count({ where: { createdAt: { gte: today } } }),
      prisma.helpQueryLog.count({ where: { createdAt: { gte: last7d } } }),
      prisma.helpQueryLog.count({ where: { createdAt: { gte: last30d } } }),
      prisma.helpQueryLog.count({ where: { feedbackRating: 1 } }),
      prisma.helpQueryLog.count({ where: { feedbackRating: -1 } }),
      prisma.helpQueryLog.count({ where: { feedbackRating: null } }),
    ]);

    const totalTokens = totalAgg._sum.tokenCount ?? 0;
    // Blended cost estimate: ~80% input ($0.80/1M) + ~20% output ($4.00/1M) = ~$1.44/1M tokens
    const estimatedCostUsd = (totalTokens * 1.44) / 1_000_000;

    // Top questions last 30d (grouped by exact query text)
    const topQuestionsRaw = await prisma.helpQueryLog.groupBy({
      by: ["query"],
      _count: { id: true },
      _avg: { feedbackRating: true },
      where: { createdAt: { gte: last30d } },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    // Usage by tenant last 30d (with tenant name join via raw SQL)
    const byTenant = await prisma.$queryRaw<Array<{ tenantId: number; tenantName: string; queryCount: number; tokenCount: number }>>`
      SELECT q."tenantId", COALESCE(t.name, 'Unknown') as "tenantName",
        COUNT(q.id)::int as "queryCount",
        COALESCE(SUM(q."tokenCount"), 0)::int as "tokenCount"
      FROM "HelpQueryLog" q
      LEFT JOIN "Tenant" t ON t.id = q."tenantId"
      WHERE q."createdAt" >= ${last30d}
      GROUP BY q."tenantId", t.name
      ORDER BY "queryCount" DESC
      LIMIT 20
    `;

    // Daily volume last 14 days
    const dailyVolume = await prisma.$queryRaw<Array<{ date: string; count: number }>>`
      SELECT TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD') as date, COUNT(*)::int as count
      FROM "HelpQueryLog"
      WHERE "createdAt" >= ${last14d}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    return reply.send({
      summary: {
        totalQueries: totalAgg._count.id,
        queriesToday: todayCount,
        queriesLast7d: last7dCount,
        queriesLast30d: last30dCount,
        totalTokens,
        estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
        avgLatencyMs: Math.round(totalAgg._avg.latencyMs ?? 0),
        thumbsUp,
        thumbsDown,
        unrated,
      },
      topQuestions: topQuestionsRaw.map((r) => ({
        query: r.query,
        count: r._count.id,
        avgFeedback: r._avg.feedbackRating != null ? Math.round(r._avg.feedbackRating * 10) / 10 : null,
      })),
      byTenant,
      dailyVolume,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /help/index — index help articles (super-admin only)
  // Accepts pre-parsed article data from CI/CD pipeline.
  // ─────────────────────────────────────────────────────────────────────────
  app.post("/help/index", async (req, reply) => {
    // Super-admin only endpoint — accepts either ADMIN_TOKEN header (CI/CD) or super-admin session
    if (!isAdminTokenRequest(req)) {
      const userId = getActorId(req);
      if (!userId) return reply.code(401).send({ error: "unauthorized" });
      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: { isSuperAdmin: true },
      });
      if (!actor?.isSuperAdmin) return reply.code(403).send({ error: "forbidden" });
    }
    const { articles, force = false } = req.body as {
      articles: Array<{
        slug: string;
        title: string;
        module: string;
        tags?: string[];
        summary?: string;
        content: string;
      }>;
      force?: boolean;
    };

    if (!Array.isArray(articles) || articles.length === 0) {
      return reply.code(400).send({ error: "articles array required" });
    }

    let indexed = 0;
    let skipped = 0;
    let totalChunks = 0;

    // ── Pass 1: compute hashes, skip unchanged, build work list ──
    type WorkItem = {
      article: typeof articles[0];
      contentHash: string;
      chunks: string[];
      embeddingOffset: number; // index into flat allChunks array
    };
    const workItems: WorkItem[] = [];
    const allChunks: string[] = [];

    for (const article of articles) {
      const contentHash = createHash("sha256")
        .update(article.content)
        .digest("hex")
        .slice(0, 16);

      if (!force) {
        // @@ignore on HelpArticleEmbedding (Unsupported vector col) → must use raw SQL
        const existingRows = await prisma.$queryRaw<Array<{ contentHash: string }>>`
          SELECT "contentHash" FROM "public"."HelpArticleEmbedding"
          WHERE slug = ${article.slug} AND "chunkIndex" = 0
          LIMIT 1`;
        if (existingRows[0]?.contentHash === contentHash) {
          skipped++;
          continue;
        }
      }

      const chunks = chunkText(article.content);
      workItems.push({ article, contentHash, chunks, embeddingOffset: allChunks.length });
      allChunks.push(...chunks);
    }

    totalChunks = allChunks.length;

    // ── Pass 2: embed all chunks in a SINGLE Voyage API call ──
    // Batching avoids per-article rate limit hits (free tier: 3 RPM).
    // Voyage allows up to 128 inputs per request; typical index runs are <50 chunks.
    const allEmbeddings = allChunks.length > 0 ? await embedTexts(allChunks) : [];

    // ── Pass 3: delete old rows and insert new ones ──
    for (const { article, contentHash, chunks, embeddingOffset } of workItems) {
      // @@ignore on HelpArticleEmbedding (Unsupported vector col) → must use raw SQL
      await prisma.$executeRaw`DELETE FROM "public"."HelpArticleEmbedding" WHERE slug = ${article.slug}`;

      for (let i = 0; i < chunks.length; i++) {
        // Raw insert for pgvector column (Prisma doesn't support vector type natively)
        const vectorStr = `[${allEmbeddings[embeddingOffset + i].join(",")}]`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO "public"."HelpArticleEmbedding"
             (slug, "chunkIndex", title, module, tags, summary, "chunkText", embedding, "contentHash", "updatedAt")
           VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8::vector, $9, NOW())`,
          article.slug,
          i,
          article.title,
          article.module,
          `{${(article.tags ?? []).map((t) => `"${t}"`).join(",")}}`,
          article.summary ?? null,
          chunks[i],
          vectorStr,
          contentHash
        );
      }

      indexed++;
    }

    return reply.send({
      indexed,
      skipped,
      totalChunks,
      message: `Indexed ${indexed} articles (${skipped} skipped, ${totalChunks} chunks total)`,
    });
  });
}
