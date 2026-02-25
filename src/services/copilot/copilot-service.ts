// src/services/copilot/copilot-service.ts
// Agentic loop orchestrator for the AI Copilot.
// Non-streaming tool rounds with SSE event emission via async generator.

import type {
  MessageParam,
  ContentBlockParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages.js";
import { getAnthropicClient } from "../anthropic-client.js";
import { getRateLimitState, searchArticles } from "../help-search-service.js";
import { COPILOT_TOOLS } from "./copilot-tools.js";
import {
  toolHandlers,
  truncateResult,
  generateToolSummary,
} from "./copilot-handlers.js";
import prisma from "../../prisma.js";

// ── Config ────────────────────────────────────────────────────────────────

const COPILOT_MODEL = process.env.COPILOT_MODEL ?? "claude-haiku-4-5-20251001";
const MAX_TOKENS = Number(process.env.COPILOT_MAX_TOKENS ?? "2048");
const MAX_TOOL_ROUNDS = Number(process.env.COPILOT_MAX_TOOL_ROUNDS ?? "5");

// ── Burst throttle (separate map from help-assistant) ─────────────────────

const burstMap = new Map<string, number[]>();
const BURST_WINDOW_MS = 60_000;
const BURST_MAX = Number(process.env.COPILOT_BURST_LIMIT ?? "3");

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

// ── System Prompt ─────────────────────────────────────────────────────────

const COPILOT_SYSTEM_BASE = `You are BHQ Copilot — the AI breeding management assistant built into BreederHQ, a comprehensive animal breeding management platform.

## Your Capabilities
You have access to tools that query the breeder's actual data — animals, breeding plans, offspring, contacts, waitlist, and finances. You also have access to BreederHQ help articles for platform how-to questions.

## When to Use Tools
- DATA QUESTIONS ("How many dogs do I have?", "Show my active breeding plans") → Use data query tools
- HOW-TO QUESTIONS ("How do I create a breeding plan?") → Use search_help_articles
- GENERAL OVERVIEW ("Give me a summary of my operation") → Use get_farm_overview
- FOLLOW-UP DETAILS ("Tell me more about that plan") → Use the appropriate detail tool with the ID from previous results
- GENERAL KNOWLEDGE (breed traits, gestation periods) → Answer directly without tools

## Response Style
- Be concise and actionable — use bullet points and bold key values
- Format numbers readably: **12 animals**, **$1,250.00 outstanding**
- Use markdown for structure: headers, lists, bold
- Financial amounts from tools are in CENTS — always divide by 100 and format as currency
- Format dates readably: **March 15, 2026** (not ISO timestamps)
- When listing items, include the most important details inline
- If no results are found, suggest alternative queries or filters

## Species Terminology
Adapt language based on the species context:
| Species | Young | Female Parent | Male Parent | Group |
|---------|-------|---------------|-------------|-------|
| DOG | puppies | dam | sire | litter |
| CAT | kittens | queen | tom/stud | litter |
| HORSE | foals | mare | stallion | foal crop |
| GOAT | kids | doe | buck | kidding |
| RABBIT | kits | doe | buck | litter |
| SHEEP | lambs | ewe | ram | lambing |
| CATTLE | calves | cow/dam | bull/sire | calf crop |
| PIG | piglets | sow | boar | litter |
| ALPACA | cria | hembra/dam | macho/herdsire | cria |
| LLAMA | cria | hembra/dam | macho/herdsire | cria |

## Important Rules
- NEVER invent or guess data — only report what tools return
- If a tool returns an error, explain what happened and suggest alternatives
- When referencing animals or plans by name, also mention their ID for precision
- Keep responses focused — synthesize tool results into readable prose, don't dump raw JSON
- If the user's question is ambiguous, ask a clarifying question rather than guessing
- You can call multiple tools to answer complex cross-domain questions`;

// ── SSE helper ────────────────────────────────────────────────────────────

function sse(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ── Entity context pre-fetch ──────────────────────────────────────────────

async function fetchEntitySummary(
  tenantId: number,
  entityType: string,
  entityId: string
): Promise<string | null> {
  const id = Number(entityId);
  if (isNaN(id)) return null;

  switch (entityType) {
    case "breeding_plan": {
      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: {
          id: true, name: true, status: true,
          expectedBirthDate: true, birthDateActual: true,
          dam: { select: { id: true, name: true } },
          sire: { select: { id: true, name: true } },
        },
      });
      if (!plan) return null;
      const damName = plan.dam?.name ?? `#${plan.dam?.id ?? "?"}`;
      const sireName = plan.sire?.name ?? `#${plan.sire?.id ?? "?"}`;
      const dueDate = plan.expectedBirthDate
        ? `, expected birth: ${(plan.expectedBirthDate as Date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
        : "";
      return `The user is viewing breeding plan **${plan.name ?? `#${plan.id}`}** — ${damName} × ${sireName} (status: ${plan.status}${dueDate})`;
    }
    case "animal": {
      const animal = await prisma.animal.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: {
          id: true, name: true, nickname: true,
          species: true, breed: true, sex: true, status: true,
        },
      });
      if (!animal) return null;
      const animalName = animal.name || animal.nickname || `#${animal.id}`;
      return `The user is viewing animal **${animalName}** — ${animal.species ?? ""} ${animal.breed ?? ""} (${animal.sex ?? "?"}, status: ${animal.status})`;
    }
    case "contact": {
      const contact = await prisma.contact.findFirst({
        where: { id, tenantId },
        select: { id: true, first_name: true, last_name: true, email: true },
      });
      if (!contact) return null;
      const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || `#${contact.id}`;
      return `The user is viewing contact **${contactName}**${contact.email ? ` (${contact.email})` : ""}`;
    }
    default:
      return null;
  }
}

// ── Main agentic loop ─────────────────────────────────────────────────────

export interface CopilotChatOpts {
  query: string;
  userId: string;
  tenantId: number;
  module?: string;
  entityType?: string;
  entityId?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

/**
 * Stream a Copilot AI response over SSE.
 * Uses an agentic loop with non-streaming tool rounds.
 * The caller (route handler) writes yielded strings to reply.raw.
 */
export async function* streamCopilotResponse(
  opts: CopilotChatOpts
): AsyncGenerator<string> {
  const {
    query,
    userId,
    tenantId,
    module,
    entityType,
    entityId,
    conversationHistory = [],
  } = opts;

  // 1. Burst throttle
  if (!checkBurst(userId)) {
    yield sse({
      type: "error",
      message: "Too many requests. Please wait a moment.",
      code: "RATE_LIMITED",
    });
    return;
  }

  // 2. Daily rate limit (parameterized for COPILOT entitlement)
  const rateLimit = await getRateLimitState(userId, tenantId, "COPILOT");
  if (!rateLimit.allowed) {
    yield sse({
      type: "error",
      message: `You've reached your daily limit of ${rateLimit.limit} Copilot queries. Resets at midnight UTC.`,
      code: "RATE_LIMITED",
    });
    return;
  }

  // 3. Build system prompt with optional RAG + module context
  let systemPrompt = COPILOT_SYSTEM_BASE;

  if (module) {
    systemPrompt += `\n\nUSER CONTEXT: The user is currently viewing the **${module}** module.`;
  }

  // Lightweight RAG pre-fetch to enhance system prompt
  try {
    const ragChunks = await searchArticles(query, { module, limit: 3 });
    if (ragChunks.length > 0) {
      const ragContext = ragChunks
        .map((c) => `- ${c.title}: ${c.chunkText.slice(0, 200)}`)
        .join("\n");
      systemPrompt += `\n\nRELEVANT HELP ARTICLES (use search_help_articles tool for full content if needed):\n${ragContext}`;
    }
  } catch {
    // RAG failure is non-fatal — copilot can still use tools
  }

  // 3b. Entity context pre-fetch (when user is viewing a specific record)
  if (entityType && entityId) {
    try {
      const entitySummary = await fetchEntitySummary(tenantId, entityType, entityId);
      if (entitySummary) {
        systemPrompt += `\n\nCURRENT CONTEXT: ${entitySummary}`;
      }
    } catch {
      // Entity fetch failure is non-fatal
    }
  }

  // 4. Build messages from conversation history + current query
  const messages: MessageParam[] = [
    ...conversationHistory.slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: query },
  ];

  // 5. Agentic loop
  const startMs = Date.now();
  let fullResponseText = "";
  const sourceSlugs: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    const anthropic = getAnthropicClient();

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: COPILOT_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: COPILOT_TOOLS,
        messages,
      });

      totalInputTokens += response.usage?.input_tokens ?? 0;
      totalOutputTokens += response.usage?.output_tokens ?? 0;

      const textBlocks = response.content.filter((b) => b.type === "text");
      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use"
      );

      // ── End turn: yield final text as chunk SSEs ──
      if (
        response.stop_reason === "end_turn" ||
        response.stop_reason === "max_tokens"
      ) {
        for (const block of textBlocks) {
          if (block.type === "text") {
            fullResponseText += block.text;
            // Split into ~100 char segments for smooth streaming feel
            const text = block.text;
            let pos = 0;
            while (pos < text.length) {
              const end = Math.min(pos + 100, text.length);
              yield sse({ type: "chunk", text: text.slice(pos, end) });
              pos = end;
            }
          }
        }
        break;
      }

      // ── Tool use: execute handlers and continue loop ──
      if (response.stop_reason === "tool_use") {
        // Yield any intermediate text (e.g., "Let me check that...")
        for (const block of textBlocks) {
          if (block.type === "text" && block.text.trim()) {
            fullResponseText += block.text;
            yield sse({ type: "chunk", text: block.text });
          }
        }

        // Append assistant message with full content to conversation
        messages.push({
          role: "assistant",
          content: response.content as unknown as ContentBlockParam[],
        });

        // Execute each tool call
        const toolResults: ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          if (block.type !== "tool_use") continue;

          const toolName = block.name;
          const toolInput = block.input as Record<string, unknown>;

          yield sse({
            type: "tool_call",
            name: toolName,
            status: "executing",
          });

          const handler = toolHandlers[toolName];
          let resultJson: string;
          let summary: string;

          if (!handler) {
            resultJson = JSON.stringify({
              error: `Unknown tool: ${toolName}`,
            });
            summary = `Error: unknown tool "${toolName}"`;
          } else {
            try {
              const result = await handler(tenantId, toolInput);
              resultJson = truncateResult(result);
              summary = generateToolSummary(toolName, result);

              // Collect source slugs from help article searches
              if (
                toolName === "search_help_articles" &&
                Array.isArray(result)
              ) {
                for (const r of result as Array<{ slug?: string }>) {
                  if (r.slug && !sourceSlugs.includes(r.slug)) {
                    sourceSlugs.push(r.slug);
                  }
                }
              }
            } catch (err) {
              console.error(`[copilot] Tool ${toolName} error:`, err);
              resultJson = JSON.stringify({
                error: `Tool execution failed: ${(err as Error).message}`,
              });
              summary = "Error executing tool";
            }
          }

          yield sse({
            type: "tool_result",
            name: toolName,
            status: "done",
            summary,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: resultJson,
          });
        }

        // Append tool results as user message
        messages.push({
          role: "user",
          content: toolResults as ContentBlockParam[],
        });

        continue;
      }

      // Unexpected stop reason — break out
      break;
    }
  } catch (err) {
    console.error("[copilot] Claude API error:", err);
    yield sse({
      type: "error",
      message:
        "AI Copilot is temporarily unavailable. Please try again later.",
      code: "AI_UNAVAILABLE",
    });
    return;
  }

  // 6. Log query for analytics and rate limiting
  const latencyMs = Date.now() - startMs;
  let queryLogId: number | null = null;

  try {
    const log = await prisma.helpQueryLog.create({
      data: {
        userId,
        tenantId,
        query,
        response: fullResponseText,
        sourceSlugs,
        modelUsed: COPILOT_MODEL,
        tokenCount: totalInputTokens + totalOutputTokens,
        latencyMs,
      },
    });
    queryLogId = log.id;
  } catch (err) {
    console.error("[copilot] Failed to log query:", err);
  }

  // 7. Yield sources and done
  yield sse({ type: "sources", slugs: sourceSlugs, queryLogId });
  yield sse({ type: "done" });
}
