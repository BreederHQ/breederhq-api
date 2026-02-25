// src/services/copilot/copilot-tools.ts
// Tool definitions for the AI Copilot agentic loop.
// Each tool uses Anthropic SDK Tool type with JSON Schema input_schema.

import type { Tool } from "@anthropic-ai/sdk/resources/messages.js";

/**
 * All 10 copilot tools.
 * The `name` field doubles as the key into the handler map (copilot-handlers.ts).
 */
export const COPILOT_TOOLS: Tool[] = [
  // ── Data Query Tools ──────────────────────────────────────────────────

  {
    name: "search_animals",
    description:
      "Search the breeder's animals by species, breed, name, sex, or status. Returns a list of matching animals with basic info. Use this when the user asks about their animals, herd, kennel, or specific animal counts.",
    input_schema: {
      type: "object" as const,
      properties: {
        species: {
          type: "string",
          enum: ["DOG", "CAT", "HORSE", "GOAT", "RABBIT", "SHEEP", "CATTLE", "PIG", "ALPACA", "LLAMA"],
          description: "Filter by species",
        },
        breed: {
          type: "string",
          description: "Filter by breed (partial match, case-insensitive)",
        },
        name: {
          type: "string",
          description: "Filter by animal name (partial match, case-insensitive)",
        },
        sex: {
          type: "string",
          enum: ["FEMALE", "MALE"],
          description: "Filter by sex",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "BREEDING", "UNAVAILABLE", "RETIRED", "DECEASED", "PROSPECT"],
          description: "Filter by status",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 20, max 50)",
        },
      },
      required: [],
    },
  },

  {
    name: "get_animal_details",
    description:
      "Get the full profile for a specific animal by ID, including parents, health records, traits, and titles. Use this after search_animals to get detailed info about a specific animal.",
    input_schema: {
      type: "object" as const,
      properties: {
        animal_id: {
          type: "number",
          description: "The animal's ID",
        },
      },
      required: ["animal_id"],
    },
  },

  {
    name: "search_breeding_plans",
    description:
      "Search breeding plans by status, species, or name. Returns a list of plans with dam/sire names, status, and expected dates. Use this when the user asks about their breeding plans, litters, or upcoming births.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: [
            "PLANNING", "COMMITTED", "CYCLE_EXPECTED", "HORMONE_TESTING",
            "BRED", "PREGNANT", "BIRTHED", "WEANED", "PLACEMENT",
            "COMPLETE", "CANCELED", "CYCLE", "UNSUCCESSFUL", "ON_HOLD", "PLAN_COMPLETE",
          ],
          description: "Filter by plan status",
        },
        species: {
          type: "string",
          enum: ["DOG", "CAT", "HORSE", "GOAT", "RABBIT", "SHEEP", "CATTLE", "PIG", "ALPACA", "LLAMA"],
          description: "Filter by species",
        },
        name: {
          type: "string",
          description: "Filter by plan name (partial match, case-insensitive)",
        },
        limit: {
          type: "number",
          description: "Max results (default 20, max 50)",
        },
      },
      required: [],
    },
  },

  {
    name: "get_breeding_plan_details",
    description:
      "Get full details for a specific breeding plan including all dates, dam/sire info, litter data, waitlist entries, and offspring. Use after search_breeding_plans for deep dive into a specific plan.",
    input_schema: {
      type: "object" as const,
      properties: {
        plan_id: {
          type: "number",
          description: "The breeding plan's ID",
        },
      },
      required: ["plan_id"],
    },
  },

  {
    name: "search_offspring",
    description:
      "Search offspring across breeding plans. Filter by species, status, placement state, or specific plan. Use when the user asks about puppies, kittens, foals, or other young animals.",
    input_schema: {
      type: "object" as const,
      properties: {
        species: {
          type: "string",
          enum: ["DOG", "CAT", "HORSE", "GOAT", "RABBIT", "SHEEP", "CATTLE", "PIG", "ALPACA", "LLAMA"],
          description: "Filter by species",
        },
        status: {
          type: "string",
          enum: ["NEWBORN", "ALIVE", "WEANED", "PLACED", "DECEASED"],
          description: "Filter by offspring status",
        },
        placement_state: {
          type: "string",
          enum: ["UNASSIGNED", "OPTION_HOLD", "RESERVED", "PLACED", "RETURNED", "TRANSFERRED"],
          description: "Filter by placement state",
        },
        plan_id: {
          type: "number",
          description: "Filter by breeding plan ID",
        },
        limit: {
          type: "number",
          description: "Max results (default 20, max 50)",
        },
      },
      required: [],
    },
  },

  {
    name: "search_contacts",
    description:
      "Search the breeder's contacts (buyers, vets, co-owners, etc.) by name, email, or phone. Use when the user asks about their clients, buyers, or contacts.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search term to match against name, email, or phone",
        },
        limit: {
          type: "number",
          description: "Max results (default 20, max 50)",
        },
      },
      required: [],
    },
  },

  {
    name: "get_waitlist",
    description:
      "Get waitlist entries, optionally filtered by a specific breeding plan or status. Shows client names, deposit amounts, preferences, and priority. Use when the user asks about their waitlist or buyers waiting for animals.",
    input_schema: {
      type: "object" as const,
      properties: {
        plan_id: {
          type: "number",
          description: "Filter by breeding plan ID",
        },
        status: {
          type: "string",
          enum: ["INQUIRY", "DEPOSIT_DUE", "DEPOSIT_PAID", "READY", "ALLOCATED", "COMPLETED", "CANCELED", "APPROVED", "REJECTED"],
          description: "Filter by waitlist status",
        },
        limit: {
          type: "number",
          description: "Max results (default 20, max 50)",
        },
      },
      required: [],
    },
  },

  {
    name: "get_financial_summary",
    description:
      "Get a financial summary including total invoices, outstanding balance, paid amounts, overdue count, and recent invoices. Use when the user asks about invoices, payments, revenue, or outstanding balances.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["draft", "issued", "partially_paid", "paid", "void", "uncollectible", "refunded", "cancelled"],
          description: "Filter by invoice status",
        },
      },
      required: [],
    },
  },

  // ── Knowledge Tools ───────────────────────────────────────────────────

  {
    name: "search_help_articles",
    description:
      "Search the BreederHQ help article knowledge base for how-to guides and platform documentation. Use when the user asks HOW to do something in the platform (e.g., 'how do I create a breeding plan?').",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Natural language search query about platform features or workflows",
        },
        module: {
          type: "string",
          enum: ["animals", "breeding", "offspring", "contacts", "finance", "marketplace", "genetics", "bloodlines", "getting-started"],
          description: "Optional module filter",
        },
      },
      required: ["query"],
    },
  },

  // ── Summary Tools ─────────────────────────────────────────────────────

  {
    name: "get_farm_overview",
    description:
      "Get an operation-wide summary: animal counts by species, active breeding plans, upcoming due dates, recent offspring, waitlist totals, and outstanding invoice balance. Use when the user asks for a general overview, status report, or dashboard summary.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];
