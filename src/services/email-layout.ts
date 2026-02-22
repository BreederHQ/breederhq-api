// src/services/email-layout.ts
/**
 * Shared Email Layout Module
 *
 * Provides a unified dark-theme email layout matching the Client Portal Invitation design.
 * All platform emails should use these helpers for consistent branding.
 *
 * Design tokens (matching portal invitation):
 *   Page bg:      #0a0a0a
 *   Card bg:      #171717
 *   Border:       #262626
 *   Heading text: #ffffff
 *   Body text:    #e5e5e5
 *   Muted text:   #a3a3a3
 *   Subtle text:  #737373
 *   Orange brand: #f97316 → #ea580c
 */

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const LOGO_URL = "https://app.breederhq.com/assets/logo-BzhLJbz9.png";

// ────────────────────────────────────────────────────────────────────────────
// Main Layout Wrapper
// ────────────────────────────────────────────────────────────────────────────

export interface EmailLayoutOptions {
  /** Email heading shown below logo */
  title: string;
  /** HTML body content (goes between header and footer) */
  body: string;
  /** Footer org name. Defaults to "BreederHQ" */
  footerOrgName?: string;
  /** Whether to show logo. Defaults to true */
  showLogo?: boolean;
}

/**
 * Wraps email body content in the standard dark-theme layout:
 * orange accent bar → logo + title header → body → branded footer
 */
export function wrapEmailLayout(options: EmailLayoutOptions): string {
  const { title, body, footerOrgName, showLogo = true } = options;
  const orgName = footerOrgName || "BreederHQ";

  const logoHtml = showLogo
    ? `<div style="margin-bottom: 16px;">
        <img src="${LOGO_URL}" alt="BreederHQ" style="height: 80px; width: auto;" />
      </div>`
    : "";

  return `
<div style="font-family: ${FONT_STACK}; max-width: 600px; margin: 0 auto; background-color: #0a0a0a; border-radius: 12px; overflow: hidden;">
  <!-- Orange accent bar -->
  <div style="height: 4px; background: linear-gradient(90deg, #f97316 0%, #ea580c 100%);"></div>

  <!-- Header with Logo -->
  <div style="padding: 32px 24px 24px 24px; text-align: center; border-bottom: 1px solid #262626;">
    ${logoHtml}
    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">${title}</h1>
  </div>

  <!-- Body -->
  <div style="padding: 32px 24px; background-color: #0a0a0a;">
    ${body}
  </div>

  <!-- Footer -->
  <div style="background-color: #171717; padding: 24px; text-align: center; border-top: 1px solid #262626;">
    <p style="color: #737373; font-size: 12px; margin: 0 0 8px 0;">
      Sent by <strong style="color: #a3a3a3;">${orgName}</strong> via BreederHQ
    </p>
    <p style="color: #525252; font-size: 11px; margin: 0;">
      <a href="https://breederhq.com" style="color: #f97316; text-decoration: none;">breederhq.com</a> &bull; Professional Breeder Management
    </p>
  </div>
</div>
  `.trim();
}

// ────────────────────────────────────────────────────────────────────────────
// Component Helpers
// ────────────────────────────────────────────────────────────────────────────

type ButtonColor = "orange" | "green" | "red" | "blue" | "gray";

const BUTTON_STYLES: Record<ButtonColor, { bg: string; shadow: string }> = {
  orange: {
    bg: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    shadow: "0 4px 14px rgba(249, 115, 22, 0.4)",
  },
  green: {
    bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    shadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
  },
  red: {
    bg: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
    shadow: "0 4px 14px rgba(220, 38, 38, 0.4)",
  },
  blue: {
    bg: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    shadow: "0 4px 14px rgba(59, 130, 246, 0.4)",
  },
  gray: {
    bg: "#262626",
    shadow: "none",
  },
};

/**
 * Renders a CTA button with gradient background and box-shadow.
 */
export function emailButton(
  text: string,
  href: string,
  color: ButtonColor = "orange"
): string {
  const style = BUTTON_STYLES[color];
  return `
<div style="text-align: center; margin: 32px 0;">
  <a href="${href}" style="display: inline-block; padding: 16px 40px; background: ${style.bg}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: ${style.shadow};">
    ${text}
  </a>
</div>`.trim();
}

type CardBorderColor = "orange" | "green" | "red" | "blue" | "yellow" | "gray";

const CARD_BORDER_COLORS: Record<CardBorderColor, string> = {
  orange: "#f97316",
  green: "#10b981",
  red: "#dc2626",
  blue: "#3b82f6",
  yellow: "#f59e0b",
  gray: "#737373",
};

/**
 * Renders a dark info/callout card with optional colored left border.
 * Content is raw HTML.
 */
export function emailInfoCard(
  content: string,
  options?: { borderColor?: CardBorderColor }
): string {
  const borderLeft = options?.borderColor
    ? `border-left: 3px solid ${CARD_BORDER_COLORS[options.borderColor]};`
    : "";
  const borderRadius = options?.borderColor
    ? "border-radius: 0 8px 8px 0;"
    : "border-radius: 8px;";

  return `
<div style="background-color: #171717; border: 1px solid #262626; ${borderLeft} padding: 16px; margin: 24px 0; ${borderRadius}">
  ${content}
</div>`.trim();
}

/**
 * Renders a key/value detail table in dark theme.
 * Each row is { label, value }.
 */
export function emailDetailRows(
  rows: Array<{ label: string; value: string }>
): string {
  const rowsHtml = rows
    .map(
      (row) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #262626; font-weight: 600; color: #a3a3a3; width: 40%; font-size: 14px;">${row.label}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #262626; color: #e5e5e5; font-size: 14px;">${row.value}</td>
      </tr>`
    )
    .join("");

  return `
<table style="width: 100%; margin: 20px 0; border-collapse: collapse; background-color: #171717; border-radius: 8px; overflow: hidden;">
  ${rowsHtml}
</table>`.trim();
}

/**
 * Renders a list of items with orange checkmarks in dark cards (like portal invite features).
 */
export function emailFeatureList(items: string[]): string {
  const itemsHtml = items
    .map(
      (item, i) => `
      <div style="display: flex; align-items: center; padding: 12px 16px; background-color: #171717; border-radius: 8px;${i < items.length - 1 ? " margin-bottom: 8px;" : ""}">
        <span style="color: #f97316; font-size: 16px; margin-right: 12px;">&#10003;</span>
        <span style="color: #d4d4d4; font-size: 14px;">${item}</span>
      </div>`
    )
    .join("");

  return `<div style="margin: 0 0 28px 0;">${itemsHtml}</div>`;
}

/**
 * Renders a bulleted list in dark theme (for "What You Can Do" etc.).
 */
export function emailBulletList(items: string[]): string {
  const itemsHtml = items
    .map(
      (item) =>
        `<li style="margin-bottom: 8px; color: #d4d4d4; font-size: 14px;">${item}</li>`
    )
    .join("");

  return `<ul style="margin: 0 0 24px 0; padding-left: 20px;">${itemsHtml}</ul>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Text Helpers (for paragraph styling)
// ────────────────────────────────────────────────────────────────────────────

/** Greeting line: "Hello Name," */
export function emailGreeting(name: string): string {
  return `<p style="color: #e5e5e5; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
  Hello <strong style="color: #ffffff;">${name}</strong>,
</p>`;
}

/** Standard body paragraph */
export function emailParagraph(html: string): string {
  return `<p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">${html}</p>`;
}

/** Muted footnote text (centered) */
export function emailFootnote(text: string): string {
  return `<p style="color: #737373; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">${text}</p>`;
}

/** Section heading within email body */
export function emailHeading(text: string): string {
  return `<h3 style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 28px 0 12px 0;">${text}</h3>`;
}

/** Accent-colored text for emphasis */
export function emailAccent(text: string): string {
  return `<strong style="color: #f97316;">${text}</strong>`;
}

/** Large centered code/token display (for verification codes) */
export function emailCodeBlock(code: string): string {
  return `
<div style="text-align: center; margin: 32px 0;">
  <span style="display: inline-block; font-size: 36px; font-weight: 700; letter-spacing: 8px; padding: 16px 32px; background: #171717; border: 1px solid #262626; border-radius: 8px; color: #ffffff;">
    ${code}
  </span>
</div>`.trim();
}
