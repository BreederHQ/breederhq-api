// src/services/voyage-client.ts
// Voyage AI embedding client for the help system RAG pipeline.
// Uses voyage-3-lite model (512 dims) — fast and cost-effective for semantic search.
// Direct REST calls (no SDK needed) following the pattern of other service clients.

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-lite";
const EMBEDDING_DIMS = 512;

export { EMBEDDING_DIMS };

function getVoyageApiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      "VOYAGE_API_KEY not configured. Add it to AWS Secrets Manager."
    );
  }
  return key;
}

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { total_tokens: number };
}

/**
 * Embed multiple text chunks for indexing (document input type).
 * Returns an array of 512-dim float vectors in the same order as input texts.
 * Batches are limited to 128 inputs per Voyage API constraint.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const key = getVoyageApiKey();
  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: "document",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage API error ${response.status}: ${body}`);
  }

  const data: VoyageResponse = await response.json();
  // Sort by index to ensure correct ordering
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/**
 * Embed a single user query for retrieval (query input type).
 * Returns a 512-dim float vector.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const key = getVoyageApiKey();
  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: [text],
      input_type: "query",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage API error ${response.status}: ${body}`);
  }

  const data: VoyageResponse = await response.json();
  return data.data[0].embedding;
}
