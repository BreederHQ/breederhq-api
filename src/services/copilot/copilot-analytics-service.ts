// src/services/copilot/copilot-analytics-service.ts
// Nightly AI-powered quality analysis of Copilot query logs.
// Generates CopilotQualityReport: satisfaction metrics + AI failure-pattern analysis.
//
// NOTE: Queries filter by HelpQueryLog.mode='copilot' which is added in migration
// 20260226222745_add_mode_to_help_query_log.sql. Until that migration is applied
// the mode column won't exist and these queries will fail at runtime but are
// correct once db:dev:sync is run.

import prisma from "../../prisma.js";
import { getAnthropicClient } from "../anthropic-client.js";

// ── Config ────────────────────────────────────────────────────────────────

const ANALYSIS_MODEL = process.env.COPILOT_ANALYSIS_MODEL ?? "claude-haiku-4-5-20251001";
const SAMPLE_SIZE = Number(process.env.COPILOT_QUALITY_SAMPLE_SIZE ?? "50");
const MAX_ANALYSIS_TOKENS = 1500;

// ── Types ─────────────────────────────────────────────────────────────────

export type FailurePattern = {
  pattern: string;
  count: number;
  examples: string[];
};

export type QueryTopic = {
  topic: string;
  count: number;
};

export type CopilotQualityReportData = {
  reportDate: string; // YYYY-MM-DD
  periodStart: Date;
  periodEnd: Date;
  totalQueries: number;
  ratedCount: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  satisfactionRate: number | null;
  topQueryTopics: QueryTopic[];
  failurePatterns: FailurePattern[];
  aiAnalysis: string;
  queriesSampled: Array<{ query: string; response: string; rating: number | null }>;
  modelUsed: string;
  tokenCount: number;
};

export type CopilotAnalyticsStats = {
  summary: {
    totalQueries: number;
    queriesToday: number;
    queriesLast7d: number;
    queriesLast30d: number;
    totalTokens: number;
    estimatedCostUsd: number;
    avgLatencyMs: number;
    thumbsUp: number;
    thumbsDown: number;
    unrated: number;
    satisfactionRate: number | null;
  };
  topQuestions: Array<{ query: string; count: number; avgFeedback: number | null }>;
  byTenant: Array<{ tenantId: number; tenantName: string; queryCount: number; tokenCount: number }>;
  dailyVolume: Array<{ date: string; count: number }>;
  latestReport: CopilotQualityReportData | null;
  recentReports: Array<{
    id: number;
    reportDate: string;
    satisfactionRate: number | null;
    totalQueries: number;
    thumbsDownCount: number;
    generatedAt: string;
    aiAnalysis: string | null;
  }>;
};

// ── Analytics Stats (for admin panel) ─────────────────────────────────────

/**
 * Compute live analytics stats for the AI Copilot.
 * All queries use $queryRaw to filter by mode='copilot' since the
 * Prisma client is not regenerated until after db:dev:sync is run.
 */
export async function getCopilotAnalyticsStats(): Promise<CopilotAnalyticsStats> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last7d = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  const last30d = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  const last14d = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);

  const [aggregate, topQuestionsRaw, byTenant, dailyVolume] = await Promise.all([
    // Aggregate metrics in a single raw query
    prisma.$queryRaw<Array<{
      totalQueries: bigint;
      queriesToday: bigint;
      queriesLast7d: bigint;
      queriesLast30d: bigint;
      totalTokens: bigint;
      avgLatencyMs: number;
      thumbsUp: bigint;
      thumbsDown: bigint;
      unrated: bigint;
    }>>`
      SELECT
        COUNT(*)                                                     AS "totalQueries",
        COUNT(*) FILTER (WHERE "createdAt" >= ${today})             AS "queriesToday",
        COUNT(*) FILTER (WHERE "createdAt" >= ${last7d})            AS "queriesLast7d",
        COUNT(*) FILTER (WHERE "createdAt" >= ${last30d})           AS "queriesLast30d",
        COALESCE(SUM("tokenCount"), 0)                              AS "totalTokens",
        COALESCE(AVG("latencyMs"), 0)                               AS "avgLatencyMs",
        COUNT(*) FILTER (WHERE "feedbackRating" = 1)                AS "thumbsUp",
        COUNT(*) FILTER (WHERE "feedbackRating" = -1)               AS "thumbsDown",
        COUNT(*) FILTER (WHERE "feedbackRating" IS NULL)            AS "unrated"
      FROM "public"."HelpQueryLog"
      WHERE "mode" = 'copilot'
    `,

    // Top questions last 30d
    prisma.$queryRaw<Array<{ query: string; count: bigint; avgFeedback: number | null }>>`
      SELECT "query", COUNT(*)::int AS count, AVG("feedbackRating")::float AS "avgFeedback"
      FROM "public"."HelpQueryLog"
      WHERE "mode" = 'copilot' AND "createdAt" >= ${last30d}
      GROUP BY "query"
      ORDER BY count DESC
      LIMIT 20
    `,

    // Usage by tenant
    prisma.$queryRaw<Array<{ tenantId: number; tenantName: string; queryCount: number; tokenCount: number }>>`
      SELECT q."tenantId", COALESCE(t.name, 'Unknown') AS "tenantName",
        COUNT(q.id)::int AS "queryCount",
        COALESCE(SUM(q."tokenCount"), 0)::int AS "tokenCount"
      FROM "public"."HelpQueryLog" q
      LEFT JOIN "public"."Tenant" t ON t.id = q."tenantId"
      WHERE q."mode" = 'copilot' AND q."createdAt" >= ${last30d}
      GROUP BY q."tenantId", t.name
      ORDER BY "queryCount" DESC
      LIMIT 20
    `,

    // Daily volume last 14 days
    prisma.$queryRaw<Array<{ date: string; count: number }>>`
      SELECT TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
      FROM "public"."HelpQueryLog"
      WHERE "mode" = 'copilot' AND "createdAt" >= ${last14d}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
  ]);

  const agg = aggregate[0] ?? {
    totalQueries: 0n, queriesToday: 0n, queriesLast7d: 0n, queriesLast30d: 0n,
    totalTokens: 0n, avgLatencyMs: 0, thumbsUp: 0n, thumbsDown: 0n, unrated: 0n,
  };

  const totalQueriesN = Number(agg.totalQueries);
  const totalTokensN = Number(agg.totalTokens);
  const thumbsUp = Number(agg.thumbsUp);
  const thumbsDown = Number(agg.thumbsDown);
  const unrated = Number(agg.unrated);
  const ratedCount = thumbsUp + thumbsDown;
  const satisfactionRate = ratedCount > 0 ? Math.round((thumbsUp / ratedCount) * 100) / 100 : null;

  // Copilot cost estimate: blended ~80% input ($0.80/1M) + ~20% output ($4.00/1M) for haiku ≈ $1.44/1M
  const estimatedCostUsd = (totalTokensN * 1.44) / 1_000_000;

  // Fetch the latest quality report
  const latestReportRaw = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM "public"."CopilotQualityReport"
    ORDER BY "reportDate" DESC
    LIMIT 1
  `;

  const recentReportsRaw = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT "id", "reportDate", "satisfactionRate", "totalQueries",
      "thumbsDownCount", "generatedAt", "aiAnalysis"
    FROM "public"."CopilotQualityReport"
    ORDER BY "reportDate" DESC
    LIMIT 10
  `;

  const toReportDetail = (r: Record<string, unknown> | undefined): CopilotQualityReportData | null => {
    if (!r) return null;
    return {
      reportDate: r.reportDate instanceof Date
        ? r.reportDate.toISOString().slice(0, 10)
        : String(r.reportDate ?? "").slice(0, 10),
      periodStart: r.periodStart as Date,
      periodEnd: r.periodEnd as Date,
      totalQueries: Number(r.totalQueries ?? 0),
      ratedCount: Number(r.ratedCount ?? 0),
      thumbsUpCount: Number(r.thumbsUpCount ?? 0),
      thumbsDownCount: Number(r.thumbsDownCount ?? 0),
      satisfactionRate: r.satisfactionRate != null ? Number(r.satisfactionRate) : null,
      topQueryTopics: Array.isArray(r.topQueryTopics) ? (r.topQueryTopics as QueryTopic[]) : [],
      failurePatterns: Array.isArray(r.failurePatterns) ? (r.failurePatterns as FailurePattern[]) : [],
      aiAnalysis: String(r.aiAnalysis ?? ""),
      queriesSampled: Array.isArray(r.queriesSampled)
        ? r.queriesSampled as Array<{ query: string; response: string; rating: number | null }>
        : [],
      modelUsed: String(r.modelUsed ?? ""),
      tokenCount: Number(r.tokenCount ?? 0),
    };
  };

  return {
    summary: {
      totalQueries: totalQueriesN,
      queriesToday: Number(agg.queriesToday),
      queriesLast7d: Number(agg.queriesLast7d),
      queriesLast30d: Number(agg.queriesLast30d),
      totalTokens: totalTokensN,
      estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
      avgLatencyMs: Math.round(Number(agg.avgLatencyMs)),
      thumbsUp,
      thumbsDown,
      unrated,
      satisfactionRate,
    },
    topQuestions: topQuestionsRaw.map((r) => ({
      query: r.query,
      count: Number(r.count),
      avgFeedback: r.avgFeedback != null ? Math.round(r.avgFeedback * 10) / 10 : null,
    })),
    byTenant,
    dailyVolume,
    latestReport: toReportDetail(latestReportRaw[0]),
    recentReports: recentReportsRaw.map((r) => ({
      id: Number(r.id),
      reportDate: r.reportDate instanceof Date
        ? r.reportDate.toISOString().slice(0, 10)
        : String(r.reportDate ?? "").slice(0, 10),
      satisfactionRate: r.satisfactionRate != null ? Number(r.satisfactionRate) : null,
      totalQueries: Number(r.totalQueries ?? 0),
      thumbsDownCount: Number(r.thumbsDownCount ?? 0),
      generatedAt: r.generatedAt instanceof Date
        ? r.generatedAt.toISOString()
        : String(r.generatedAt ?? ""),
      aiAnalysis: r.aiAnalysis != null ? String(r.aiAnalysis) : null,
    })),
  };
}

// ── Quality Report Generator ───────────────────────────────────────────────

/**
 * Generate a daily quality report for the previous 24-hour window.
 * Samples up to SAMPLE_SIZE low-rated (and unrated) queries and asks
 * Claude to identify failure patterns and provide actionable analysis.
 *
 * Idempotent: upserts by reportDate, so re-running overwrites the day's report.
 */
export async function generateDailyCopilotQualityReport(
  targetDate?: Date
): Promise<CopilotQualityReportData> {
  const refDate = targetDate ?? new Date();
  const reportDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 1);
  const periodStart = reportDate;
  const periodEnd = new Date(reportDate.getTime() + 24 * 60 * 60 * 1000 - 1);
  const reportDateStr = reportDate.toISOString().slice(0, 10);

  // ── 1. Pull metrics for the day via raw SQL (mode='copilot' filter) ───────

  const metricsRaw = await prisma.$queryRaw<Array<{
    totalCount: bigint;
    thumbsUp: bigint;
    thumbsDown: bigint;
  }>>`
    SELECT
      COUNT(*) AS "totalCount",
      COUNT(*) FILTER (WHERE "feedbackRating" = 1) AS "thumbsUp",
      COUNT(*) FILTER (WHERE "feedbackRating" = -1) AS "thumbsDown"
    FROM "public"."HelpQueryLog"
    WHERE "mode" = 'copilot'
      AND "createdAt" >= ${periodStart}
      AND "createdAt" <= ${periodEnd}
  `;

  const m = metricsRaw[0] ?? { totalCount: 0n, thumbsUp: 0n, thumbsDown: 0n };
  const totalCount = Number(m.totalCount);
  const thumbsUp = Number(m.thumbsUp);
  const thumbsDown = Number(m.thumbsDown);
  const ratedCount = thumbsUp + thumbsDown;
  const satisfactionRate = ratedCount > 0 ? thumbsUp / ratedCount : null;

  // ── 2. Sample queries to analyze ────────────────────────────────────────
  // Priority: thumbs-down first, then unrated, up to SAMPLE_SIZE

  const thumbsDownLimit = Math.ceil(SAMPLE_SIZE * 0.6);
  const thumbsDownSamples = await prisma.$queryRaw<Array<{ query: string; response: string; feedbackRating: number | null }>>`
    SELECT "query", "response", "feedbackRating"
    FROM "public"."HelpQueryLog"
    WHERE "mode" = 'copilot'
      AND "feedbackRating" = -1
      AND "createdAt" >= ${periodStart}
      AND "createdAt" <= ${periodEnd}
    ORDER BY "createdAt" DESC
    LIMIT ${thumbsDownLimit}
  `;

  const unratedLimit = SAMPLE_SIZE - thumbsDownSamples.length;
  const unratedSamples = await prisma.$queryRaw<Array<{ query: string; response: string; feedbackRating: number | null }>>`
    SELECT "query", "response", "feedbackRating"
    FROM "public"."HelpQueryLog"
    WHERE "mode" = 'copilot'
      AND "feedbackRating" IS NULL
      AND "createdAt" >= ${periodStart}
      AND "createdAt" <= ${periodEnd}
    ORDER BY "createdAt" DESC
    LIMIT ${unratedLimit}
  `;

  const queriesSampled = [...thumbsDownSamples, ...unratedSamples].map((q) => ({
    query: q.query,
    response: (q.response ?? "").slice(0, 600),
    rating: q.feedbackRating,
  }));

  // ── 3. AI analysis ───────────────────────────────────────────────────────

  let aiAnalysis = "(No queries to analyze for this period)";
  let topQueryTopics: QueryTopic[] = [];
  let failurePatterns: FailurePattern[] = [];
  let tokenCount = 0;

  if (queriesSampled.length > 0) {
    const analysisPrompt = buildAnalysisPrompt({
      reportDateStr, totalCount, thumbsUp, thumbsDown, ratedCount, satisfactionRate, queriesSampled,
    });

    try {
      const anthropic = getAnthropicClient();
      const result = await anthropic.messages.create({
        model: ANALYSIS_MODEL,
        max_tokens: MAX_ANALYSIS_TOKENS,
        messages: [{ role: "user", content: analysisPrompt }],
      });

      tokenCount = (result.usage?.input_tokens ?? 0) + (result.usage?.output_tokens ?? 0);
      const rawText = result.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");

      const parsed = parseAnalysisResponse(rawText);
      aiAnalysis = parsed.narrative;
      topQueryTopics = parsed.topics;
      failurePatterns = parsed.patterns;
    } catch (err) {
      console.error("[copilot-analytics] AI analysis failed:", err);
      aiAnalysis = "(AI analysis failed — check logs for details)";
    }
  }

  // ── 4. Upsert the report ─────────────────────────────────────────────────

  const now = new Date();
  await prisma.$queryRaw`
    INSERT INTO "public"."CopilotQualityReport" (
      "reportDate", "generatedAt", "periodStart", "periodEnd",
      "totalQueries", "ratedCount", "thumbsUpCount", "thumbsDownCount",
      "satisfactionRate", "topQueryTopics", "failurePatterns",
      "aiAnalysis", "queriesSampled", "modelUsed", "tokenCount",
      "createdAt", "updatedAt"
    ) VALUES (
      ${reportDateStr}::date, ${now}, ${periodStart}, ${periodEnd},
      ${totalCount}, ${ratedCount}, ${thumbsUp}, ${thumbsDown},
      ${satisfactionRate}, ${JSON.stringify(topQueryTopics)}::jsonb,
      ${JSON.stringify(failurePatterns)}::jsonb,
      ${aiAnalysis}, ${JSON.stringify(queriesSampled)}::jsonb,
      ${ANALYSIS_MODEL}, ${tokenCount}, ${now}, ${now}
    )
    ON CONFLICT ("reportDate") DO UPDATE SET
      "generatedAt"    = EXCLUDED."generatedAt",
      "periodStart"    = EXCLUDED."periodStart",
      "periodEnd"      = EXCLUDED."periodEnd",
      "totalQueries"   = EXCLUDED."totalQueries",
      "ratedCount"     = EXCLUDED."ratedCount",
      "thumbsUpCount"  = EXCLUDED."thumbsUpCount",
      "thumbsDownCount"= EXCLUDED."thumbsDownCount",
      "satisfactionRate" = EXCLUDED."satisfactionRate",
      "topQueryTopics" = EXCLUDED."topQueryTopics",
      "failurePatterns"= EXCLUDED."failurePatterns",
      "aiAnalysis"     = EXCLUDED."aiAnalysis",
      "queriesSampled" = EXCLUDED."queriesSampled",
      "modelUsed"      = EXCLUDED."modelUsed",
      "tokenCount"     = EXCLUDED."tokenCount",
      "updatedAt"      = EXCLUDED."updatedAt"
  `;

  console.log(
    `[copilot-analytics] Generated quality report for ${reportDateStr}: ` +
    `${totalCount} queries, ${thumbsUp}👍 ${thumbsDown}👎, ` +
    `${queriesSampled.length} sampled, ${tokenCount} analysis tokens`
  );

  return {
    reportDate: reportDateStr,
    periodStart,
    periodEnd,
    totalQueries: totalCount,
    ratedCount,
    thumbsUpCount: thumbsUp,
    thumbsDownCount: thumbsDown,
    satisfactionRate,
    topQueryTopics,
    failurePatterns,
    aiAnalysis,
    queriesSampled,
    modelUsed: ANALYSIS_MODEL,
    tokenCount,
  };
}

// ── Prompt Builder ─────────────────────────────────────────────────────────

function buildAnalysisPrompt(args: {
  reportDateStr: string;
  totalCount: number;
  thumbsUp: number;
  thumbsDown: number;
  ratedCount: number;
  satisfactionRate: number | null;
  queriesSampled: Array<{ query: string; response: string; rating: number | null }>;
}): string {
  const { reportDateStr, totalCount, thumbsUp, thumbsDown, ratedCount, satisfactionRate, queriesSampled } = args;
  const satPct = satisfactionRate != null ? `${Math.round(satisfactionRate * 100)}%` : "N/A (no ratings)";

  const queriesText = queriesSampled
    .slice(0, 40)
    .map((q, i) =>
      `[${i + 1}] Rating: ${q.rating === 1 ? "👍" : q.rating === -1 ? "👎" : "unrated"}\n` +
      `Query: ${q.query.slice(0, 200)}\n` +
      `Response preview: ${q.response.slice(0, 300)}`
    )
    .join("\n\n---\n\n");

  return `You are analyzing AI Copilot query logs for BreederHQ — an animal breeding management platform.

DATE: ${reportDateStr}
METRICS: ${totalCount} total queries · ${thumbsUp}👍 ${thumbsDown}👎 rated · Satisfaction: ${satPct} (${ratedCount} rated)

QUERIES SAMPLED (${queriesSampled.length} low-rated + unrated queries):
${queriesText}

Analyze these queries and respond with ONLY a JSON object in this exact format:
{
  "narrative": "<2-4 paragraph plain-English analysis of what's working, what isn't, and the top 2-3 actionable improvements>",
  "topics": [
    {"topic": "<topic label>", "count": <number>}
  ],
  "patterns": [
    {
      "pattern": "<description of failure pattern>",
      "count": <estimated frequency>,
      "examples": ["<example query 1>", "<example query 2>"]
    }
  ]
}

Rules:
- narrative: Be specific and actionable. Identify WHERE the AI struggled (e.g. "unclear status filters", "too much detail for simple questions", "missed entity context"). Max 4 patterns in the patterns array.
- topics: The 5-8 most common query topics (e.g. "animal health queries", "breeding plan status", "financial overview"). Estimate counts based on the sample.
- patterns: Only include genuine failure patterns visible in the data. If everything looks fine, say so in the narrative and return empty patterns array.
- Return ONLY the JSON. No markdown, no explanation outside the JSON.`;
}

// ── Response Parser ────────────────────────────────────────────────────────

function parseAnalysisResponse(raw: string): {
  narrative: string;
  topics: QueryTopic[];
  patterns: FailurePattern[];
} {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned) as {
      narrative?: string;
      topics?: unknown[];
      patterns?: unknown[];
    };

    const narrative = typeof parsed.narrative === "string" ? parsed.narrative : raw.slice(0, 800);

    const topics: QueryTopic[] = Array.isArray(parsed.topics)
      ? (parsed.topics as Array<{ topic?: unknown; count?: unknown }>)
          .filter((t) => typeof t.topic === "string")
          .map((t) => ({ topic: String(t.topic), count: Number(t.count ?? 0) }))
          .slice(0, 10)
      : [];

    const patterns: FailurePattern[] = Array.isArray(parsed.patterns)
      ? (parsed.patterns as Array<{ pattern?: unknown; count?: unknown; examples?: unknown }>)
          .filter((p) => typeof p.pattern === "string")
          .map((p) => ({
            pattern: String(p.pattern),
            count: Number(p.count ?? 0),
            examples: Array.isArray(p.examples)
              ? (p.examples as unknown[]).map(String).slice(0, 3)
              : [],
          }))
          .slice(0, 6)
      : [];

    return { narrative, topics, patterns };
  } catch {
    return { narrative: raw.slice(0, 800), topics: [], patterns: [] };
  }
}
