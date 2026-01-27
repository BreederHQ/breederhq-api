// src/services/email-security-service.ts
// Email spam detection and security checks for inbound messages

const GOOGLE_SAFE_BROWSING_API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
const GOOGLE_SAFE_BROWSING_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

interface SpamCheckResult {
  score: number; // 0-10, higher = more likely spam
  flags: string[]; // List of spam indicators detected
  isQuarantined: boolean; // Should be auto-quarantined
  warnings: string[]; // User-facing warnings to display
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  count?: number;
}

interface ThreatIntelResult {
  safe: boolean;
  threats: string[]; // List of malicious URLs detected
  threatTypes: string[]; // Types: MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE, etc.
}

/**
 * Calculate spam score for an email
 */
export function calculateSpamScore(email: {
  from: string;
  displayName: string | null;
  subject: string;
  body: string;
}): SpamCheckResult {
  let score = 0;
  const flags: string[] = [];
  const warnings: string[] = [];

  // 1. Suspicious subject patterns
  const spamKeywords = /\b(viagra|cialis|lottery|winner|claim now|urgent|congratulations|free money|bitcoin|crypto|investment|prince|inheritance|transfer funds)\b/i;
  if (spamKeywords.test(email.subject)) {
    score += 3;
    flags.push("SPAM_KEYWORDS_SUBJECT");
  }

  // 2. ALL CAPS subject (aggressive marketing)
  if (email.subject.length > 10 && email.subject === email.subject.toUpperCase()) {
    score += 2;
    flags.push("ALL_CAPS_SUBJECT");
  }

  // 3. Excessive exclamation marks
  const exclamCount = (email.subject.match(/!/g) || []).length;
  if (exclamCount >= 3) {
    score += 1;
    flags.push("EXCESSIVE_EXCLAMATION");
  }

  // 4. Suspicious body content
  if (spamKeywords.test(email.body)) {
    score += 2;
    flags.push("SPAM_KEYWORDS_BODY");
  }

  // 5. Excessive links (potential phishing)
  const links = extractLinks(email.body);
  if (links.length > 5) {
    score += 2;
    flags.push("EXCESSIVE_LINKS");
  }

  // 6. Suspicious/shortened URLs
  const suspiciousLinks = checkSuspiciousLinks(links);
  if (suspiciousLinks.length > 0) {
    score += 3;
    flags.push("SUSPICIOUS_LINKS");
    warnings.push("⚠️ WARNING: This email contains suspicious or shortened links. Do not click unless you trust the sender.");
  }

  // 7. Free email provider for business context
  // (Legitimate businesses usually use custom domains)
  if (/@(gmail|yahoo|hotmail|outlook|aol|mail\.com|protonmail|yandex)\.com$/i.test(email.from)) {
    score += 1;
    flags.push("FREE_EMAIL_DOMAIN");
  }

  // 8. Mismatched display name and email
  // e.g., "PayPal Support" <randomscammer@gmail.com>
  if (email.displayName) {
    const suspiciousBrands = /\b(paypal|amazon|microsoft|apple|google|bank|irs|fedex|ups|dhl)\b/i;
    if (suspiciousBrands.test(email.displayName) && !email.from.includes(email.displayName.toLowerCase())) {
      score += 4;
      flags.push("BRAND_IMPERSONATION");
      warnings.push("⚠️ WARNING: The sender name does not match the email address. This may be a phishing attempt.");
    }
  }

  // 9. Suspicious TLDs (top-level domains)
  const suspiciousTlds = /\.(tk|ml|ga|cf|gq|top|xyz|click|club|work|bid|win|date|party|loan|racing|accountant|stream)$/i;
  if (suspiciousTlds.test(email.from)) {
    score += 3;
    flags.push("SUSPICIOUS_TLD");
  }

  // 10. IP address in email domain (very suspicious)
  if (/\d+\.\d+\.\d+\.\d+/.test(email.from.split("@")[1] || "")) {
    score += 5;
    flags.push("IP_ADDRESS_DOMAIN");
  }

  // Auto-quarantine if score is high
  const isQuarantined = score >= 7;

  return {
    score: Math.min(score, 10), // Cap at 10
    flags,
    isQuarantined,
    warnings,
  };
}

/**
 * Extract URLs from text
 */
function extractLinks(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"]+/gi;
  return text.match(urlRegex) || [];
}

/**
 * Check for suspicious URL patterns
 */
function checkSuspiciousLinks(links: string[]): string[] {
  const suspiciousPatterns = [
    // URL shorteners
    'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd',
    // Free/suspicious TLDs
    '.tk', '.ml', '.ga', '.cf', '.gq',
    // Suspicious keywords in URL
    'login', 'verify', 'account', 'secure', 'update', 'confirm',
  ];

  return links.filter(link => {
    const lowerLink = link.toLowerCase();
    return suspiciousPatterns.some(pattern => lowerLink.includes(pattern));
  });
}

/**
 * Check rate limits for sender
 */
export async function checkRateLimit(
  fromEmail: string,
  tenantId: number,
  prisma: any
): Promise<RateLimitResult> {
  // Count recent messages from this sender (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentCount = await prisma.message.count({
    where: {
      thread: { tenantId },
      senderParty: { email: { equals: fromEmail, mode: "insensitive" } },
      createdAt: { gte: oneHourAgo },
    },
  });

  // Allow up to 50 emails per hour from same sender
  if (recentCount >= 50) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${recentCount} emails in last hour`,
    };
  }

  return { allowed: true };
}

/**
 * Check if sender is blocked
 */
export async function checkEmailFilter(
  fromEmail: string,
  tenantId: number,
  prisma: any
): Promise<{ blocked: boolean; filter?: any }> {
  // Check for exact match
  const exactMatch = await prisma.emailFilter.findFirst({
    where: {
      tenantId,
      pattern: fromEmail,
      type: "BLOCK",
    },
  });

  if (exactMatch) {
    return { blocked: true, filter: exactMatch };
  }

  // Check for domain wildcards (*@domain.com)
  const domain = fromEmail.split("@")[1];
  if (domain) {
    const domainMatch = await prisma.emailFilter.findFirst({
      where: {
        tenantId,
        pattern: `*@${domain}`,
        type: "BLOCK",
      },
    });

    if (domainMatch) {
      return { blocked: true, filter: domainMatch };
    }
  }

  // Check for TLD wildcards (*.tk)
  const tld = domain?.split(".").pop();
  if (tld) {
    const tldMatch = await prisma.emailFilter.findFirst({
      where: {
        tenantId,
        pattern: `*.${tld}`,
        type: "BLOCK",
      },
    });

    if (tldMatch) {
      return { blocked: true, filter: tldMatch };
    }
  }

  return { blocked: false };
}

/**
 * Check email authentication headers (SPF, DKIM, DMARC)
 */
export function checkAuthentication(headers?: Record<string, string>): {
  passed: boolean;
  spf?: string;
  dkim?: string;
  dmarc?: string;
} {
  if (!headers) {
    return { passed: true }; // No headers = can't verify, allow through
  }

  const spfResult = headers["received-spf"] || headers["x-spf"] || "";
  const authResults = headers["authentication-results"] || "";

  // Check for failures
  const spfFailed = /\bfail\b/i.test(spfResult);
  const dkimFailed = /dkim=fail/i.test(authResults);
  const dmarcFailed = /dmarc=fail/i.test(authResults);

  return {
    passed: !spfFailed && !dkimFailed && !dmarcFailed,
    spf: spfResult,
    dkim: authResults.match(/dkim=(\w+)/i)?.[1],
    dmarc: authResults.match(/dmarc=(\w+)/i)?.[1],
  };
}

/**
 * Sanitize message body content
 */
export function sanitizeMessageBody(body: string): string {
  let cleaned = body;

  // Remove Base64-encoded content (often used to hide spam)
  cleaned = cleaned.replace(/[A-Za-z0-9+/]{100,}={0,2}/g, "[Base64 content removed]");

  // Remove excessive whitespace/newlines (formatting tricks)
  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");
  cleaned = cleaned.replace(/ {4,}/g, "   ");

  // Remove zero-width characters (used to bypass filters)
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, "");

  return cleaned.trim();
}

/**
 * Check URLs against Google Safe Browsing API
 * Detects phishing, malware, unwanted software, and potentially harmful applications
 */
export async function checkUrlThreatIntelligence(text: string): Promise<ThreatIntelResult> {
  if (!GOOGLE_SAFE_BROWSING_API_KEY) {
    // API key not configured - skip check (allow through)
    console.warn("⚠️  Google Safe Browsing API key not configured - skipping URL threat check");
    return { safe: true, threats: [], threatTypes: [] };
  }

  const urls = extractLinks(text);

  console.log(`🔍 Checking ${urls.length} URLs against Google Safe Browsing:`, urls);

  if (urls.length === 0) {
    return { safe: true, threats: [], threatTypes: [] };
  }

  // Limit to first 50 URLs to avoid rate limits
  const urlsToCheck = urls.slice(0, 50);

  try {
    const response = await fetch(`${GOOGLE_SAFE_BROWSING_URL}?key=${GOOGLE_SAFE_BROWSING_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: {
          clientId: "breederhq",
          clientVersion: "1.0.0",
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING", // Phishing
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION",
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: urlsToCheck.map((url) => ({ url })),
        },
      }),
    });

    if (!response.ok) {
      console.error("Google Safe Browsing API error:", response.status, response.statusText);
      // On API error, allow through (fail open) but log
      return { safe: true, threats: [], threatTypes: [] };
    }

    const data = await response.json();

    if (!data.matches || data.matches.length === 0) {
      // No threats found
      console.log("✅ Google Safe Browsing: No threats detected");
      return { safe: true, threats: [], threatTypes: [] };
    }

    // Threats detected
    const threats = data.matches.map((match: any) => match.threat.url) as string[];
    const threatTypes = [...new Set(data.matches.map((match: any) => match.threatType))] as string[];

    console.error(`🚨 THREATS DETECTED: ${threats.length} malicious URLs found:`, { threats, threatTypes });

    return {
      safe: false,
      threats,
      threatTypes,
    };
  } catch (err) {
    console.error("Error checking URLs with Google Safe Browsing:", err);
    // On error, fail open (allow through) to avoid blocking legitimate emails
    return { safe: true, threats: [], threatTypes: [] };
  }
}
