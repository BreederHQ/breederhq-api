// src/services/email/resend.ts
// Minimal Resend mailer using native fetch (Node 18+). No 'resend' npm package required.

import { wrapEmailLayout, emailButton, emailParagraph, emailFootnote } from "../email-layout.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.MAIL_FROM || "onboarding@resend.dev";

export type SendEmailOpts = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
};

export async function sendEmail(opts: SendEmailOpts) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const body = {
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.text ? { text: opts.text } : {}),
    ...(opts.headers ? { headers: opts.headers } : {}),
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${errText || res.statusText}`);
  }

  return (await res.json()) as { id: string };
}

/** Minimal magic link email (dark theme, shared layout) */
export function renderMagicLinkEmail(link: string) {
  return wrapEmailLayout({
    title: "Sign In to BreederHQ",
    body: [
      emailParagraph("Click the button below to sign in. This link expires shortly."),
      emailButton("Sign In", link),
      emailFootnote("If you did not request this, you can ignore this email."),
    ].join("\n"),
  });
}
