// src/services/copilot/index.ts
// Public exports for the AI Copilot service.

export { COPILOT_TOOLS } from "./copilot-tools.js";
export { toolHandlers, truncateResult, generateToolSummary } from "./copilot-handlers.js";
export { streamCopilotResponse } from "./copilot-service.js";
export type { CopilotChatOpts } from "./copilot-service.js";
