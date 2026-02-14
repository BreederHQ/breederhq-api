// src/routes/marketplace-image-upload.ts
// S3 Image Upload API for Service Provider Portal
// Uses unified S3 client and semantic storage paths

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { getS3Client, getS3Bucket, getCdnDomain } from "../services/s3-client.js";

// Size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/v1/marketplace/images/upload-url
 * Generate presigned S3 URL for direct browser-to-S3 upload
 */
async function getPresignedUploadUrl(
  request: FastifyRequest<{
    Body: {
      filename: string;
      contentType: string;
      contentLength?: number;
      context?: "service_listing" | "profile_photo" | "profile_banner" | "service_banner" | "breeding_animal" | "breeding_program";
      serviceId?: string; // Required for service_banner context
      programId?: string; // Optional for breeding_program context
    };
  }>,
  reply: FastifyReply
) {
  const { filename, contentType, contentLength, context = "service_listing", serviceId, programId } = request.body;

  // Get user ID from session (marketplace auth uses different session keys)
  // Adjust based on your auth middleware
  const userId = (request as any).marketplaceUserId || (request as any).userId;

  if (!userId) {
    return reply.status(401).send({
      error: "unauthorized",
      message: "Authentication required",
    });
  }

  // === VALIDATION ===

  if (!filename || typeof filename !== "string") {
    return reply.status(400).send({
      error: "invalid_filename",
      message: "Filename is required",
    });
  }

  // Validate content type (images only)
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
  ];

  if (!allowedTypes.includes(contentType)) {
    return reply.status(400).send({
      error: "invalid_content_type",
      message: "Only image files are allowed (JPEG, PNG, WebP, HEIC)",
    });
  }

  // Validate context
  const allowedContexts = ["service_listing", "profile_photo", "profile_banner", "service_banner", "breeding_animal", "breeding_program"];
  if (!allowedContexts.includes(context)) {
    return reply.status(400).send({
      error: "invalid_context",
      message: "Invalid upload context",
    });
  }

  // Validate serviceId is provided for service_banner context
  if (context === "service_banner" && !serviceId) {
    return reply.status(400).send({
      error: "missing_service_id",
      message: "serviceId is required for service_banner uploads",
    });
  }

  // Validate file size if provided
  if (contentLength && contentLength > MAX_IMAGE_SIZE) {
    return reply.status(400).send({
      error: "file_too_large",
      message: "Image must be less than 10MB",
    });
  }

  // === GENERATE S3 KEY ===

  // Extract file extension
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const allowedExts = ["jpg", "jpeg", "png", "webp", "heic"];

  if (!allowedExts.includes(ext)) {
    return reply.status(400).send({
      error: "invalid_file_extension",
      message: "File must have a valid image extension",
    });
  }

  // Get provider ID if available (for semantic path)
  const providerId = (request as any).marketplaceProvider?.id;

  // Generate unique S3 key with semantic path structure
  // Format: providers/{providerId}/services/photos/{uuid}.ext (if provider)
  //     or: marketplace/{context}/{userId}/{uuid}.ext (fallback)
  const uniqueId = uuidv4();
  let s3Key: string;

  if (providerId) {
    // Semantic path for providers based on context
    let subPath: string;
    switch (context) {
      case "profile_photo":
        subPath = "profile/photo";
        break;
      case "profile_banner":
        subPath = "profile/banner";
        break;
      case "service_banner":
        subPath = `services/${serviceId}/banner`;
        break;
      case "breeding_animal":
        subPath = "breeding/animals";
        break;
      case "breeding_program":
        subPath = programId ? `breeding/programs/${programId}` : "breeding/programs";
        break;
      case "service_listing":
      default:
        subPath = "services/photos";
        break;
    }
    s3Key = `providers/${providerId}/${subPath}/${uniqueId}.${ext}`;
  } else {
    // Fallback for non-provider users (shouldn't happen in normal flow)
    s3Key = `marketplace/${context}/${userId}/${uniqueId}.${ext}`;
  }

  // === GENERATE PRESIGNED URL ===

  try {
    const s3 = getS3Client();
    const bucket = getS3Bucket();
    const cdnDomain = getCdnDomain();

    // Create PutObject command with optional ContentLength constraint
    // CacheControl: S3 keys contain UUIDs so URLs are immutable — cache aggressively
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      ...(contentLength && { ContentLength: contentLength }),
    });

    // Generate presigned URL (expires in 5 minutes)
    const presignedUrl = await getSignedUrl(s3, command, {
      expiresIn: 300,
    });

    // Generate CDN URL for accessing the uploaded file
    const cdnUrl = `https://${cdnDomain}/${s3Key}`;

    return reply.send({
      uploadUrl: presignedUrl,
      cdnUrl,
      maxAllowedSize: MAX_IMAGE_SIZE,
      key: s3Key,
      expiresIn: 300,
    });
  } catch (error) {
    request.log.error(error, "Failed to generate presigned URL");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to generate upload URL",
    });
  }
}

/**
 * DELETE /api/v1/marketplace/images/:key
 * Delete uploaded image from S3 (optional - for user-initiated removals)
 */
async function deleteImage(
  request: FastifyRequest<{
    Params: {
      key: string;
    };
  }>,
  reply: FastifyReply
) {
  const { key } = request.params;

  // Get user ID from session
  const userId = (request as any).marketplaceUserId || (request as any).userId;

  if (!userId) {
    return reply.status(401).send({
      error: "unauthorized",
      message: "Authentication required",
    });
  }

  // Get provider ID for ownership check
  const providerId = (request as any).marketplaceProvider?.id;
  const decodedKey = decodeURIComponent(key);

  // Verify ownership - check for provider ID or user ID in the path
  const hasProviderAccess = providerId && decodedKey.includes(`providers/${providerId}/`);
  const hasUserAccess = decodedKey.includes(`/${userId}/`);

  if (!hasProviderAccess && !hasUserAccess) {
    return reply.status(403).send({
      error: "forbidden",
      message: "You do not have permission to delete this image",
    });
  }

  try {
    const s3 = getS3Client();
    const bucket = getS3Bucket();

    // Create DeleteObject command
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: decodedKey,
    });

    // Execute delete
    await s3.send(command);

    return reply.send({ ok: true });
  } catch (error) {
    request.log.error(error, "S3 delete error");
    return reply.status(500).send({
      error: "delete_failed",
      message: "Failed to delete image",
    });
  }
}

/**
 * Register routes
 */
export default async function marketplaceImageUploadRoutes(fastify: FastifyInstance) {
  // POST /api/v1/marketplace/images/upload-url - Get presigned S3 URL
  fastify.post("/upload-url", {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 minute",
      },
    },
    handler: getPresignedUploadUrl,
  });

  // DELETE /api/v1/marketplace/images/:key - Delete image
  fastify.delete("/:key", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
      },
    },
    handler: deleteImage,
  });
}
