// src/services/media-storage.ts
// Core S3 operations for media uploads

import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { getS3Client, getS3Bucket, getCdnDomain } from "./s3-client.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type OwnerType = "provider" | "tenant";

export type TenantPurpose =
  | "animal"
  | "offspring"
  | "contract"
  | "finance"
  | "services"
  | "credentials"
  | "profile";

export type ProviderPurpose = "listings" | "credentials" | "profile";

export interface UploadContext {
  ownerType: OwnerType;
  ownerId: number | undefined;
  purpose: TenantPurpose | ProviderPurpose;
  resourceId?: string | number; // animalId, listingId, contractId, etc.
  subPath?: string; // e.g., "photos", "documents", "logo"
}

export interface PresignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  cdnUrl: string;
  expiresIn: number;
}

export interface PresignedDownloadResult {
  url: string;
  expiresIn: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// File type validation
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const ALLOWED_ALL_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];
const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (documents)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export function validateContentType(
  contentType: string,
  purpose: string,
  subPath?: string
): { valid: boolean; error?: string } {
  // Media subPath allows images + videos (animal photo/video gallery)
  const isMediaPath = subPath === "media" || subPath === "photos";
  if (isMediaPath) {
    if (!ALLOWED_MEDIA_TYPES.includes(contentType)) {
      return {
        valid: false,
        error: "Invalid content type. Allowed: images (JPEG, PNG, WebP, GIF, AVIF) or videos (MP4, MOV, WebM)",
      };
    }
    return { valid: true };
  }

  // Purposes that allow document uploads (PDF, Word, TXT)
  const documentPurposes = ["contract", "finance", "credentials", "animal", "offspring"];
  // Also allow documents if subPath indicates documents folder
  const isDocumentPath = subPath === "documents";
  const allowDocuments = documentPurposes.includes(purpose) || isDocumentPath;
  const allowedTypes = allowDocuments
    ? ALLOWED_ALL_TYPES
    : ALLOWED_IMAGE_TYPES;

  if (!allowedTypes.includes(contentType)) {
    const typeList = documentPurposes.includes(purpose)
      ? "images (JPEG, PNG, WebP, AVIF) or documents (PDF, Word)"
      : "images (JPEG, PNG, WebP, HEIC, AVIF)";
    return {
      valid: false,
      error: `Invalid content type. Allowed: ${typeList}`,
    };
  }

  return { valid: true };
}

export function validateFileSize(
  sizeBytes: number,
  contentType: string
): { valid: boolean; error?: string } {
  const isImage = ALLOWED_IMAGE_TYPES.includes(contentType);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);
  const maxSize = isVideo ? MAX_VIDEO_SIZE : isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;

  if (sizeBytes > maxSize) {
    const maxMB = Math.floor(maxSize / 1024 / 1024);
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxMB}MB`,
    };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage key generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate S3 storage key based on ownership context.
 *
 * Key patterns:
 * - providers/{providerId}/profile/logo/{uuid}.jpg
 * - providers/{providerId}/listings/{listingId}/{uuid}.jpg
 * - providers/{providerId}/credentials/{uuid}.pdf
 * - tenants/{tenantId}/animals/{animalId}/photos/{uuid}.jpg
 * - tenants/{tenantId}/animals/{animalId}/documents/{uuid}.pdf
 * - tenants/{tenantId}/contracts/{contractId}/{uuid}.pdf
 * - tenants/{tenantId}/finance/invoices/{invoiceId}/{uuid}.pdf
 * - tenants/{tenantId}/services/{listingId}/{uuid}.jpg
 * - tenants/{tenantId}/profile/logo/{uuid}.jpg
 * - temp/{ownerType}/{ownerId}/{sessionId}/{uuid}.jpg
 */
export function generateStorageKey(
  context: UploadContext,
  filename: string
): string {
  const { ownerType, ownerId, purpose, resourceId, subPath } = context;

  // Extract and validate extension
  const ext = extractExtension(filename);
  const uuid = uuidv4();

  // Build path segments
  const segments: string[] = [];

  // Root: owners/{ownerId} or tenants/{tenantId}
  if (ownerType === "provider") {
    segments.push("providers", String(ownerId));
  } else {
    segments.push("tenants", String(ownerId));
  }

  // Purpose-specific path
  segments.push(purpose);

  // Resource ID if present (e.g., animalId, listingId)
  if (resourceId) {
    segments.push(String(resourceId));
  }

  // Sub-path if present (e.g., "photos", "documents", "logo")
  if (subPath) {
    segments.push(subPath);
  }

  // Final filename
  segments.push(`${uuid}.${ext}`);

  return segments.join("/");
}

/**
 * Generate a temporary storage key for uploads that will be moved later.
 */
export function generateTempStorageKey(
  ownerType: OwnerType,
  ownerId: number,
  sessionId: string,
  filename: string
): string {
  const ext = extractExtension(filename);
  const uuid = uuidv4();
  return `temp/${ownerType}/${ownerId}/${sessionId}/${uuid}.${ext}`;
}

function extractExtension(filename: string): string {
  const parts = filename.split(".");
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : "bin";
  return ext || "bin";
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct upload (for server-side uploads, e.g., image processing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a buffer directly to S3 (for server-side processing like image resizing).
 * Returns the storage key and CDN URL.
 */
export async function uploadBuffer(
  context: UploadContext,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<{ storageKey: string; cdnUrl: string }> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();
  const storageKey = generateStorageKey(context, filename);

  // CacheControl: S3 keys contain UUIDs so URLs are immutable — cache aggressively
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const cdnDomain = getCdnDomain();
  const cdnUrl = `https://${cdnDomain}/${storageKey}`;

  return { storageKey, cdnUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// Presigned URL generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a presigned URL for uploading a file directly to S3.
 */
export async function generatePresignedUploadUrl(
  context: UploadContext,
  filename: string,
  contentType: string,
  contentLength?: number
): Promise<PresignedUploadResult> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();
  const storageKey = generateStorageKey(context, filename);

  // CacheControl: S3 keys contain UUIDs so URLs are immutable — cache aggressively
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
    ...(contentLength && { ContentLength: contentLength }),
  });

  // 15 minutes for upload
  const expiresIn = 900;
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn });

  // CDN URL for after upload completes
  const cdnDomain = getCdnDomain();
  const cdnUrl = `https://${cdnDomain}/${storageKey}`;

  return {
    uploadUrl,
    storageKey,
    cdnUrl,
    expiresIn,
  };
}

/**
 * Generate a presigned URL for downloading/viewing a file.
 */
export async function generatePresignedDownloadUrl(
  storageKey: string,
  expiresInSeconds: number = 3600
): Promise<PresignedDownloadResult> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });

  return {
    url,
    expiresIn: expiresInSeconds,
  };
}

/**
 * Get a public CDN URL for a file (only for PUBLIC visibility files).
 */
export function getPublicCdnUrl(storageKey: string): string {
  const cdnDomain = getCdnDomain();
  return `https://${cdnDomain}/${storageKey}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3 operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a file exists in S3.
 */
export async function fileExists(storageKey: string): Promise<boolean> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();

  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      })
    );
    return true;
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Delete a file from S3.
 */
export async function deleteFile(storageKey: string): Promise<void> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    })
  );
}

/**
 * Copy a file within S3 (used for provider→tenant migration).
 */
export async function copyFile(
  sourceKey: string,
  destKey: string
): Promise<void> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();

  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: destKey,
    })
  );
}

/**
 * List files under a prefix (used for migration).
 */
export async function listFiles(prefix: string): Promise<string[]> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();
  const keys: string[] = [];

  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          keys.push(obj.Key);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

/**
 * Delete all files under a prefix (used for cleanup after migration).
 */
export async function deleteFilesByPrefix(prefix: string): Promise<number> {
  const keys = await listFiles(prefix);
  let deleted = 0;

  for (const key of keys) {
    await deleteFile(key);
    deleted++;
  }

  return deleted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage key parsing
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedStorageKey {
  ownerType: OwnerType;
  ownerId: number;
  purpose: string;
  resourceId?: string;
  filename: string;
}

/**
 * Parse a storage key to extract owner information.
 */
export function parseStorageKey(storageKey: string): ParsedStorageKey | null {
  const parts = storageKey.split("/");

  if (parts.length < 3) return null;

  const [ownerTypeDir, ownerIdStr, purpose, ...rest] = parts;

  let ownerType: OwnerType;
  if (ownerTypeDir === "providers") {
    ownerType = "provider";
  } else if (ownerTypeDir === "tenants") {
    ownerType = "tenant";
  } else if (ownerTypeDir === "temp") {
    // Temp files: temp/{ownerType}/{ownerId}/...
    if (parts.length < 4) return null;
    const tempOwnerType = parts[1] as OwnerType;
    const tempOwnerId = parseInt(parts[2], 10);
    if (isNaN(tempOwnerId)) return null;
    return {
      ownerType: tempOwnerType,
      ownerId: tempOwnerId,
      purpose: "temp",
      filename: parts[parts.length - 1],
    };
  } else {
    return null;
  }

  const ownerId = parseInt(ownerIdStr, 10);
  if (isNaN(ownerId)) return null;

  const filename = rest[rest.length - 1];

  // Try to extract resourceId (second-to-last segment if it looks like an ID)
  let resourceId: string | undefined;
  if (rest.length > 1) {
    const possibleId = rest[rest.length - 2];
    // Check if it's a numeric ID or UUID
    if (/^\d+$/.test(possibleId) || /^[0-9a-f-]{36}$/i.test(possibleId)) {
      resourceId = possibleId;
    }
  }

  return {
    ownerType,
    ownerId,
    purpose,
    resourceId,
    filename,
  };
}
