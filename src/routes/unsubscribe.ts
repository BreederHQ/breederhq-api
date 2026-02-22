// src/routes/unsubscribe.ts
// Unauthenticated endpoints for CAN-SPAM email unsubscribe flow.
// Token-based verification replaces auth (JWT encodes partyId + tenantId).

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyUnsubscribeToken } from "../services/unsubscribe-token-service.js";
import { updateCommPreferences } from "../services/comm-prefs-service.js";
import prisma from "../prisma.js";

// ────────────────────────────────────────────────────────────────────────────
// Design tokens (matching email-layout.ts)
// ────────────────────────────────────────────────────────────────────────────
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const LOGO_URL = "https://app.breederhq.com/assets/logo-BzhLJbz9.png";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ────────────────────────────────────────────────────────────────────────────
// HTML page renderers
// ────────────────────────────────────────────────────────────────────────────

function pageShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — BreederHQ</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #0a0a0a;
      color: #e5e5e5;
      font-family: ${FONT_STACK};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 12px;
      max-width: 480px;
      width: 100%;
      margin: 24px;
      overflow: hidden;
    }
    .accent { height: 4px; background: linear-gradient(90deg, #f97316 0%, #ea580c 100%); }
    .header { padding: 32px 24px 16px; text-align: center; border-bottom: 1px solid #262626; }
    .header img { height: 60px; width: auto; margin-bottom: 12px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }
    .body { padding: 24px; }
    .body p { margin: 0 0 16px; line-height: 1.6; color: #e5e5e5; }
    .muted { color: #a3a3a3; font-size: 14px; }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: #f97316;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
    }
    .btn:hover { background: #ea580c; }
    .footer { padding: 16px 24px; border-top: 1px solid #262626; text-align: center; }
    .footer p { margin: 0; color: #737373; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="accent"></div>
    ${body}
  </div>
</body>
</html>`;
}

function renderConfirmPage(token: string, email: string, breederName: string): string {
  return pageShell("Unsubscribe", `
    <div class="header">
      <img src="${LOGO_URL}" alt="BreederHQ" />
      <h1>Unsubscribe from emails</h1>
    </div>
    <div class="body">
      <p>
        You will be unsubscribed from emails from
        <strong style="color:#ffffff;">${escapeHtml(breederName)}</strong>
        sent to <strong style="color:#ffffff;">${escapeHtml(email)}</strong>.
      </p>
      <p class="muted">You will no longer receive messages from this sender through BreederHQ.</p>
      <form method="POST" action="/api/v1/unsubscribe">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        <button type="submit" class="btn">Confirm Unsubscribe</button>
      </form>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} BreederHQ</p>
    </div>
  `);
}

function renderSuccessPage(): string {
  return pageShell("Unsubscribed", `
    <div class="header">
      <img src="${LOGO_URL}" alt="BreederHQ" />
      <h1>You have been unsubscribed</h1>
    </div>
    <div class="body">
      <p>You will no longer receive emails from this sender through BreederHQ.</p>
      <p class="muted">If this was a mistake, contact the sender directly to re-subscribe.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} BreederHQ</p>
    </div>
  `);
}

function renderErrorPage(message: string): string {
  return pageShell("Error", `
    <div class="header">
      <img src="${LOGO_URL}" alt="BreederHQ" />
      <h1>Unable to process request</h1>
    </div>
    <div class="body">
      <p>${escapeHtml(message)}</p>
      <p class="muted">If you believe this is an error, please contact the sender directly.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} BreederHQ</p>
    </div>
  `);
}

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {

  /**
   * GET /api/v1/unsubscribe?token=...
   * Shows a branded confirmation page for the recipient to confirm unsubscribe.
   */
  app.get("/", async (req, reply) => {
    const { token } = req.query as { token?: string };

    if (!token) {
      return reply.type("text/html").code(400).send(
        renderErrorPage("Missing unsubscribe token. Please use the link from your email.")
      );
    }

    try {
      const payload = verifyUnsubscribeToken(token);

      // Look up party email and tenant name for display
      const party = await prisma.party.findUnique({
        where: { id: payload.partyId },
        select: { email: true },
      });
      const tenant = await prisma.tenant.findUnique({
        where: { id: payload.tenantId },
        select: { name: true },
      });

      const email = party?.email || "your email";
      const breederName = tenant?.name || "this sender";

      return reply.type("text/html").code(200).send(
        renderConfirmPage(token, email, breederName)
      );
    } catch {
      return reply.type("text/html").code(400).send(
        renderErrorPage("This unsubscribe link has expired or is invalid. Please contact the sender directly.")
      );
    }
  });

  /**
   * POST /api/v1/unsubscribe
   * Processes the unsubscribe action.
   * Handles both:
   *   - Form submission from the confirmation page (token in body)
   *   - RFC 8058 one-click unsubscribe from email clients (token in query param)
   */
  app.post("/", async (req, reply) => {
    // Token can come from form body or query param (one-click unsubscribe)
    const body = req.body as Record<string, string> | null;
    const query = req.query as { token?: string };
    const token = body?.token || query?.token;

    if (!token) {
      return reply.type("text/html").code(400).send(
        renderErrorPage("Missing unsubscribe token.")
      );
    }

    try {
      const payload = verifyUnsubscribeToken(token);

      // Determine source based on how the request arrived
      const isOneClick = !body?.token && !!query?.token;
      const complianceSource = isOneClick ? "list_unsubscribe" : "unsubscribe_page";

      await updateCommPreferences(
        payload.partyId,
        [{
          channel: payload.channel,
          compliance: "UNSUBSCRIBED",
          complianceSource,
        }],
        undefined, // no actorPartyId — this is the recipient themselves
        `unsubscribe_${complianceSource}`
      );

      // For one-click (email client POST), return 200 with minimal body
      if (isOneClick) {
        return reply.code(200).send({ ok: true });
      }

      // For browser form submission, return success HTML
      return reply.type("text/html").code(200).send(renderSuccessPage());
    } catch {
      return reply.type("text/html").code(400).send(
        renderErrorPage("This unsubscribe link has expired or is invalid. Please contact the sender directly.")
      );
    }
  });
};

export default routes;
