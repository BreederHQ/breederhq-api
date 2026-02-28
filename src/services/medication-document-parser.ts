// src/services/medication-document-parser.ts
// AI-powered vet document parsing via Claude — extracts medications, Coggins data
// Uses existing infrastructure: getAnthropicClient(), getS3Client()

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getAnthropicClient } from "./anthropic-client.js";
import { getS3Client, getS3Bucket } from "./s3-client.js";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type ParsedMedicationCategory =
  | "ANTIBIOTIC" | "NSAID" | "ANTIPARASITIC" | "ANTIFUNGAL"
  | "STEROID" | "HORMONE" | "SUPPLEMENT" | "SEDATIVE" | "ANESTHETIC" | "OTHER";

export type ParsedMedication = {
  name: string;
  genericName?: string;
  category?: ParsedMedicationCategory;
  dosageAmount?: number;
  dosageUnit?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  refills?: number;
  veterinarian?: string;
  clinic?: string;
  rxNumber?: string;
  confidence: number; // 0-1
};

export type ParsedCogginsData = {
  testDate: string;
  result: "Negative" | "Positive";
  labName: string;
  accessionNumber?: string;
  veterinarian?: string;
  animalDescription?: string;
};

export type DocumentParseResult = {
  medications: ParsedMedication[];
  documentType: "prescription" | "invoice" | "lab_report" | "coggins" | "health_certificate" | "other";
  isCoggins: boolean;
  cogginsData?: ParsedCogginsData;
  parseError?: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Rate Limiting — 5 parses per user per hour (configurable, in-memory)
// ────────────────────────────────────────────────────────────────────────────

const PARSE_RATE_LIMIT = parseInt(process.env.MEDICATION_PARSE_RATE_LIMIT || "5", 10);
const PARSE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * In-memory sliding-window rate limiter. Key = "userId:tenantId",
 * value = array of timestamps. Entries older than the window are pruned on check.
 */
const parseLog = new Map<string, number[]>();

export function checkParseRateLimit(
  userId: number,
  tenantId: number,
): { allowed: boolean; remaining: number; resetAt: Date } {
  const key = `${userId}:${tenantId}`;
  const now = Date.now();
  const cutoff = now - PARSE_WINDOW_MS;

  // Prune expired entries
  const timestamps = (parseLog.get(key) ?? []).filter((t) => t > cutoff);
  parseLog.set(key, timestamps);

  const remaining = Math.max(0, PARSE_RATE_LIMIT - timestamps.length);
  const oldestInWindow = timestamps[0] ?? now;
  const resetAt = new Date(oldestInWindow + PARSE_WINDOW_MS);

  return { allowed: remaining > 0, remaining, resetAt };
}

function recordParseUsage(userId: number, tenantId: number): void {
  const key = `${userId}:${tenantId}`;
  const timestamps = parseLog.get(key) ?? [];
  timestamps.push(Date.now());
  parseLog.set(key, timestamps);
}

// ────────────────────────────────────────────────────────────────────────────
// Document Fetching from S3
// ────────────────────────────────────────────────────────────────────────────

async function fetchDocumentFromS3(storageKey: string): Promise<{ bytes: Buffer; contentType: string }> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();

  const command = new GetObjectCommand({ Bucket: bucket, Key: storageKey });
  const response = await s3.send(command);

  if (!response.Body) {
    throw new Error("Empty response body from S3");
  }

  // Collect stream into buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);

  const contentType = response.ContentType || "application/octet-stream";
  return { bytes, contentType };
}

// ────────────────────────────────────────────────────────────────────────────
// Claude Document Parsing
// ────────────────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a veterinary document parser. Extract medication information from this document.

Return a JSON object with this exact structure:
{
  "medications": [
    {
      "name": "Brand or common name",
      "genericName": "Scientific/generic name if visible",
      "category": "ANTIBIOTIC|NSAID|ANTIPARASITIC|ANTIFUNGAL|STEROID|HORMONE|SUPPLEMENT|SEDATIVE|ANESTHETIC|OTHER",
      "dosageAmount": 10.5,
      "dosageUnit": "mg, mL, cc, IU, etc.",
      "route": "Oral, IV, IM, SQ, Topical, etc.",
      "frequency": "ONCE, DAILY, BID (twice daily), TID (three times daily), QID (four times daily), EVERY_OTHER_DAY, WEEKLY, AS_NEEDED, OTHER",
      "duration": "7 days, 14 days, ongoing, etc.",
      "refills": 3,
      "veterinarian": "Dr. Name",
      "clinic": "Clinic Name",
      "rxNumber": "Prescription number if visible",
      "confidence": 0.95
    }
  ],
  "documentType": "prescription|invoice|lab_report|coggins|health_certificate|other",
  "isCoggins": false,
  "cogginsData": null
}

If this is a Coggins test (EIA/Equine Infectious Anemia test), set isCoggins to true and include:
{
  "cogginsData": {
    "testDate": "YYYY-MM-DD",
    "result": "Negative" or "Positive",
    "labName": "Laboratory name",
    "accessionNumber": "Lab accession/case number",
    "veterinarian": "Veterinarian who drew blood",
    "animalDescription": "Description of the animal on the form"
  }
}

Rules:
- Set confidence 0-1 for each medication based on how clearly the information was extracted
- If a field is not visible or ambiguous, omit it rather than guessing
- For dosageAmount, extract the number only (no units)
- Map frequency to standard abbreviations where possible
- If you cannot extract any medications, return an empty array
- ONLY return valid JSON, no markdown, no explanation`;

const PARSER_MODEL = process.env.MEDICATION_PARSER_MODEL || "claude-haiku-4-5-20251001";

export async function parseMedicationDocument(
  storageKey: string,
  contentType: string,
): Promise<DocumentParseResult> {
  try {
    const { bytes } = await fetchDocumentFromS3(storageKey);
    const base64Data = bytes.toString("base64");

    const anthropic = getAnthropicClient();

    // Build content block based on content type
    const contentBlocks: any[] = [];

    if (contentType === "application/pdf") {
      contentBlocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64Data,
        },
      });
    } else if (contentType.startsWith("image/")) {
      // Normalize media type for Claude API
      const mediaType = contentType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Data,
        },
      });
    } else {
      return {
        medications: [],
        documentType: "other",
        isCoggins: false,
        parseError: `Unsupported content type: ${contentType}. Upload a PDF or image (JPEG, PNG).`,
      };
    }

    contentBlocks.push({ type: "text", text: EXTRACTION_PROMPT });

    const response = await anthropic.messages.create({
      model: PARSER_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: contentBlocks }],
    });

    // Extract text from response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return {
        medications: [],
        documentType: "other",
        isCoggins: false,
        parseError: "No text response from AI model",
      };
    }

    // Parse JSON from response — handle possible markdown code fences
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize the result
    const result: DocumentParseResult = {
      medications: Array.isArray(parsed.medications)
        ? parsed.medications.map((m: any) => ({
            name: String(m.name || ""),
            genericName: m.genericName || undefined,
            category: validateCategory(m.category),
            dosageAmount: typeof m.dosageAmount === "number" ? m.dosageAmount : undefined,
            dosageUnit: m.dosageUnit || undefined,
            route: m.route || undefined,
            frequency: m.frequency || undefined,
            duration: m.duration || undefined,
            refills: typeof m.refills === "number" ? m.refills : undefined,
            veterinarian: m.veterinarian || undefined,
            clinic: m.clinic || undefined,
            rxNumber: m.rxNumber || undefined,
            confidence: typeof m.confidence === "number"
              ? Math.min(1, Math.max(0, m.confidence))
              : 0.5,
          }))
        : [],
      documentType: validateDocumentType(parsed.documentType),
      isCoggins: !!parsed.isCoggins,
      cogginsData: parsed.isCoggins && parsed.cogginsData
        ? {
            testDate: String(parsed.cogginsData.testDate || ""),
            result: parsed.cogginsData.result === "Positive" ? "Positive" : "Negative",
            labName: String(parsed.cogginsData.labName || ""),
            accessionNumber: parsed.cogginsData.accessionNumber || undefined,
            veterinarian: parsed.cogginsData.veterinarian || undefined,
            animalDescription: parsed.cogginsData.animalDescription || undefined,
          }
        : undefined,
    };

    // Filter out medications with empty names
    result.medications = result.medications.filter((m) => m.name.trim().length > 0);

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown parsing error";
    console.error("[MedicationParser] Parse error:", message);

    // Check for JSON parse errors specifically
    if (message.includes("JSON")) {
      return {
        medications: [],
        documentType: "other",
        isCoggins: false,
        parseError: "Could not extract structured data from AI response",
      };
    }

    return {
      medications: [],
      documentType: "other",
      isCoggins: false,
      parseError: `Could not extract medication data from this document: ${message}`,
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ────────────────────────────────────────────────────────────────────────────

const VALID_CATEGORIES: Set<string> = new Set([
  "ANTIBIOTIC", "NSAID", "ANTIPARASITIC", "ANTIFUNGAL", "STEROID",
  "HORMONE", "SUPPLEMENT", "SEDATIVE", "ANESTHETIC", "OTHER",
]);

function validateCategory(v: unknown): ParsedMedicationCategory | undefined {
  if (typeof v === "string" && VALID_CATEGORIES.has(v.toUpperCase())) {
    return v.toUpperCase() as ParsedMedicationCategory;
  }
  return undefined;
}

const VALID_DOC_TYPES: Set<string> = new Set([
  "prescription", "invoice", "lab_report", "coggins", "health_certificate", "other",
]);

function validateDocumentType(v: unknown): DocumentParseResult["documentType"] {
  if (typeof v === "string" && VALID_DOC_TYPES.has(v)) {
    return v as DocumentParseResult["documentType"];
  }
  return "other";
}

export { recordParseUsage };
