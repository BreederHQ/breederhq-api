// src/services/email/resend.ts
// Minimal Resend mailer using native fetch (Node 18+). No 'resend' npm package required.

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

/** Minimal magic link email (dark theme) */
export function renderMagicLinkEmail(link: string) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:24px;color:#e6e6e6;background:#0b0b0c;padding:24px">
      <table width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#121214;border-radius:12px;padding:24px">
        <tr><td>
          <h1 style="margin:0 0 12px 0;font-size:20px;color:#fff">Sign in to BreederHQ</h1>
          <p style="margin:0 0 16px 0">Click the button below to sign in. This link expires shortly.</p>
          <p style="margin:0 0 24px 0">
            <a href="${link}" style="display:inline-block;padding:12px 16px;border-radius:8px;background:#ff7a00;color:#000;text-decoration:none;font-weight:600">
              Sign in
            </a>
          </p>
          <p style="font-size:12px;color:#9a9a9a">If you did not request this, you can ignore this email.</p>
        </td></tr>
      </table>
    </div>
  `;
}
