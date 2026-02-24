#!/usr/bin/env npx tsx
/**
 * scripts/help/index-help-articles.ts
 *
 * Standalone help article indexer — no dev server needed.
 * Connects directly to Prisma + Voyage AI without spawning an HTTP server.
 *
 * Usage:
 *   npx tsx scripts/help/index-help-articles.ts --path ../breederhq/docs/help/articles
 *   npx tsx scripts/help/index-help-articles.ts --path ../breederhq/docs/help/articles --force
 *
 * Env loading:
 *   Reads .env.dev from the repo root, then fetches secrets from AWS Secrets Manager
 *   (same approach as scripts/development/boot-dev.js). Set USE_SECRETS_MANAGER=false
 *   in .env.dev to skip SM and use .env.dev values directly.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname, basename } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { spawn } from "node:child_process";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 800;   // ~800 token target; rough approximation by word count
const CHUNK_OVERLAP = 100;

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-lite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "../..");
const ENV_FILE = resolve(ROOT, ".env.dev");

// ─── Env Loading ─────────────────────────────────────────────────────────────

function parseEnvFile(filePath: string): Record<string, string> {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`[env] Could not read ${filePath}`);
    process.exit(1);
  }

  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function fetchSmSecrets(secretName: string, region: string): Promise<Record<string, string>> {
  const { SecretsManagerClient, GetSecretValueCommand } = await import("@aws-sdk/client-secrets-manager");
  const client = new SecretsManagerClient({ region });
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    if (!response.SecretString) throw new Error("Secret value is empty");
    return JSON.parse(response.SecretString) as Record<string, string>;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[env] Failed to fetch secrets from AWS SM (${secretName}): ${msg}`);
    console.error("[env] Make sure your AWS profile is configured: aws configure --profile dev");
    console.error("[env] Or set USE_SECRETS_MANAGER=false in .env.dev to skip SM.");
    process.exit(1);
  }
}

async function loadEnv(): Promise<void> {
  const fileEnv = parseEnvFile(ENV_FILE);

  for (const [key, value] of Object.entries(fileEnv)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  if (process.env.USE_SECRETS_MANAGER === "true") {
    const secretName =
      process.env.AWS_SECRET_NAME ||
      `breederhq-api/${process.env.NODE_ENV || "development"}`;
    const region = process.env.AWS_SECRETS_MANAGER_REGION || "us-east-2";

    console.log(`[env] Fetching secrets from AWS Secrets Manager: ${secretName}`);
    const secrets = await fetchSmSecrets(secretName, region);
    Object.assign(process.env, secrets);
    console.log(`[env] ${Object.keys(secrets).length} secrets loaded.`);
  } else {
    console.log("[env] USE_SECRETS_MANAGER=false — using .env.dev values directly.");
  }
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

/**
 * Split article body text into overlapping word-count chunks (~800 words each).
 * Mirrors the chunkText function in src/routes/help.ts exactly.
 *
 * IMPORTANT: break when end >= words.length — otherwise the final chunk repeats
 * infinitely since start = end - CHUNK_OVERLAP stays < words.length forever.
 */
function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  if (words.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + CHUNK_SIZE, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end >= words.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

// ─── Markdown / Frontmatter Parsing ──────────────────────────────────────────

interface ArticleMetadata {
  slug: string;
  title: string;
  module: string;
  tags: string[];
  summary: string | null;
  content: string;
}

function parseMarkdownFile(filePath: string): ArticleMetadata | null {
  const raw = readFileSync(filePath, "utf-8");

  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) {
    const fmAlt = raw.match(/^---\s*\n([\s\S]*?)\n?---\s*([\s\S]*)$/);
    if (!fmAlt) {
      console.warn(`  [skip] ${basename(filePath)} — no frontmatter found`);
      return null;
    }
    return parseFrontmatter(fmAlt[1], fmAlt[2].trim(), filePath);
  }

  return parseFrontmatter(fmMatch[1], fmMatch[2].trim(), filePath);
}

function parseFrontmatter(
  frontmatter: string,
  body: string,
  filePath: string
): ArticleMetadata | null {
  const lines = frontmatter.split("\n");
  const meta: Record<string, string> = {};

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    meta[key] = value;
  }

  const title = meta["title"];
  const slug = meta["slug"];
  const module = meta["module"];

  if (!title || !slug || !module) {
    console.warn(
      `  [skip] ${basename(filePath)} — missing required frontmatter (title, slug, module)`
    );
    return null;
  }

  let tags: string[] = [];
  if (meta["tags"]) {
    const raw = meta["tags"].trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      tags = raw
        .slice(1, -1)
        .split(",")
        .map((t) => t.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      tags = raw.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }

  const summary = meta["summary"] ? meta["summary"].trim() : null;

  return { slug, title, module, tags, summary, content: body };
}

// ─── File Discovery ───────────────────────────────────────────────────────────

function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (stat.isFile() && extname(entry).toLowerCase() === ".md") {
      results.push(fullPath);
    }
  }

  return results;
}

// ─── Voyage AI Embedding ──────────────────────────────────────────────────────

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { total_tokens: number };
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      "VOYAGE_API_KEY not set. Make sure AWS Secrets Manager contains this key."
    );
  }

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

  const data = await response.json() as VoyageResponse;
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// ─── CLI Arg Parsing ──────────────────────────────────────────────────────────

interface CliArgs {
  articlesPath: string;
  force: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let articlesPath: string | null = null;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--path" && args[i + 1]) {
      articlesPath = args[++i];
    } else if (args[i] === "--force") {
      force = true;
    }
  }

  if (!articlesPath) {
    console.error("Usage: npx tsx scripts/help/index-help-articles.ts --path <articles-dir> [--force]");
    console.error("Example: npx tsx scripts/help/index-help-articles.ts --path ../breederhq/docs/help/articles");
    process.exit(1);
  }

  const resolved = resolve(process.cwd(), articlesPath);
  return { articlesPath: resolved, force };
}

// ─── Worker mode (processes a single article; spawned by parent) ──────────────

async function runWorker(filePath: string, force: boolean): Promise<void> {
  const article = parseMarkdownFile(filePath);
  if (!article) {
    console.log(`WORKER_SKIP:no-frontmatter`);
    process.exit(0);
  }

  const contentHash = createHash("sha256")
    .update(article.content)
    .digest("hex")
    .slice(0, 16);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    if (!force) {
      const existing = await prisma.helpArticleEmbedding.findFirst({
        where: { slug: article.slug, chunkIndex: 0 },
        select: { contentHash: true },
      });
      if (existing?.contentHash === contentHash) {
        console.log(`WORKER_SKIP:${article.slug}`);
        return;
      }
    }

    const chunks = chunkText(article.content);
    const embeddings = await embedTexts(chunks);

    await prisma.helpArticleEmbedding.deleteMany({ where: { slug: article.slug } });

    for (let i = 0; i < chunks.length; i++) {
      const vectorStr = `[${embeddings[i].join(",")}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "public"."HelpArticleEmbedding"
           (slug, "chunkIndex", title, module, tags, summary, "chunkText", embedding, "contentHash", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8::vector, $9, NOW())`,
        article.slug,
        i,
        article.title,
        article.module,
        `{${(article.tags ?? []).map((t) => `"${t}"`).join(",")}}`,
        article.summary ?? null,
        chunks[i],
        vectorStr,
        contentHash
      );
    }

    console.log(`WORKER_OK:${article.slug}:${chunks.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Worker mode: process a single article file then exit ──
  const rawArgs = process.argv.slice(2);
  const workerFileArg = rawArgs.find(a => a.startsWith("--worker-file="));
  if (workerFileArg) {
    const filePath = workerFileArg.split("=").slice(1).join("=");
    const force = rawArgs.includes("--force");
    await runWorker(filePath, force);
    return;
  }

  // ── Parent mode ──
  const startTime = Date.now();

  await loadEnv();

  const { articlesPath, force } = parseArgs();

  console.log("");
  console.log("Help Article Indexer");
  console.log("====================");
  console.log(`Articles path: ${articlesPath}`);
  console.log(`Force re-index: ${force}`);
  console.log("");

  let mdFiles: string[];
  try {
    mdFiles = findMarkdownFiles(articlesPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error reading articles directory: ${msg}`);
    process.exit(1);
  }

  if (mdFiles.length === 0) {
    console.log("No .md files found. Nothing to index.");
    return;
  }

  const validFiles: string[] = [];
  for (const file of mdFiles) {
    const parsed = parseMarkdownFile(file);
    if (parsed) {
      console.log(`  ✓ ${parsed.slug}`);
      validFiles.push(file);
    }
  }
  console.log(`\nFound ${validFiles.length} valid article(s). Processing...\n`);

  // Spawn a fresh subprocess for each article (isolates Prisma + embeddings per article).
  // Workers run under --experimental-strip-types (Node 24 native TS stripping) instead
  // of tsx to reduce baseline memory. Each worker handles exactly one article and exits.
  const scriptPath = fileURLToPath(import.meta.url);
  const nodeArgs = ["--experimental-strip-types", "--no-warnings"];

  let indexed = 0;
  let skipped = 0;
  let totalChunks = 0;
  const errors: string[] = [];

  for (const filePath of validFiles) {
    const result = await new Promise<{ status: string; slug: string; chunks: number }>((resolve) => {
      const args = [...nodeArgs, scriptPath, `--worker-file=${filePath}`, ...(force ? ["--force"] : [])];
      const child = spawn(process.execPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

      child.on("exit", (_code) => {
        const lines = stdout.split("\n").filter(Boolean);
        const okLine = lines.find(l => l.startsWith("WORKER_OK:"));
        const skipLine = lines.find(l => l.startsWith("WORKER_SKIP:"));

        if (okLine) {
          const [, slug, chunks] = okLine.split(":");
          resolve({ status: "indexed", slug, chunks: parseInt(chunks, 10) });
        } else if (skipLine) {
          const slug = skipLine.split(":")[1] || "unknown";
          resolve({ status: "skipped", slug, chunks: 0 });
        } else {
          const errMsg = (stderr || stdout).slice(0, 500);
          resolve({ status: "error:" + errMsg, slug: filePath, chunks: 0 });
        }
      });
    });

    if (result.status === "indexed") {
      console.log(`  + ${result.slug} (indexed, ${result.chunks} chunk${result.chunks === 1 ? "" : "s"})`);
      indexed++;
      totalChunks += result.chunks;
    } else if (result.status === "skipped") {
      console.log(`  - ${result.slug} (skipped, unchanged)`);
      skipped++;
    } else {
      const errMsg = result.status.replace("error:", "");
      console.error(`  ! ${result.slug} (ERROR: ${errMsg})`);
      errors.push(`${result.slug}: ${errMsg}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log("====================");
  console.log(`Done in ${elapsed}s`);
  console.log(`  Indexed:  ${indexed} article(s)`);
  console.log(`  Skipped:  ${skipped} article(s) (unchanged)`);
  console.log(`  Chunks:   ${totalChunks} total`);
  console.log(`  Errors:   ${errors.length}`);

  if (errors.length > 0) {
    console.log("");
    console.log("Failed articles:");
    for (const e of errors) {
      console.error(`  ! ${e}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nFatal error: ${msg}`);
  process.exit(1);
});
