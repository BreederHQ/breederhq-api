// src/routes/marketplace-image-upload.ts
// S3 Image Upload API for Service Provider Portal

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

// Initialize S3 client (AWS SDK v3)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "breederhq-assets";
const CDN_DOMAIN = process.env.CDN_DOMAIN || `${S3_BUCKET_NAME}.s3.amazonaws.com`;

/**
 * POST /api/v1/marketplace/images/upload-url
 * Generate presigned S3 URL for direct browser-to-S3 upload
 */
async function getPresignedUploadUrl(
  request: FastifyRequest<{
    Body: {
      filename: string;
      contentType: string;
      context?: "service_listing" | "profile_photo" | "breeding_animal";
    };
  }>,
  reply: FastifyReply
) {
  const { filename, contentType, context = "service_listing" } = request.body;

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
  const allowedContexts = ["service_listing", "profile_photo", "breeding_animal"];
  if (!allowedContexts.includes(context)) {
    return reply.status(400).send({
      error: "invalid_context",
      message: "Invalid upload context",
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

  // Generate unique S3 key
  // Format: {context}/{userId}/{uuid}.{ext}
  const uniqueId = uuidv4();
  const s3Key = `${context}/${userId}/${uniqueId}.${ext}`;

  // === GENERATE PRESIGNED URL ===

  try {
    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
    });

    // Generate presigned URL (expires in 5 minutes)
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
    });

    // Generate CDN URL for accessing the uploaded file
    const cdnUrl = `https://${CDN_DOMAIN}/${s3Key}`;

    // Optional: Log upload request for analytics/abuse prevention
    // (You can add database logging here if needed)

    return reply.send({
      uploadUrl: presignedUrl,
      cdnUrl,
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

  // Verify ownership (key should contain userId)
  if (!key.includes(`/${userId}/`)) {
    return reply.status(403).send({
      error: "forbidden",
      message: "You do not have permission to delete this image",
    });
  }

  try {
    // Create DeleteObject command
    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: decodeURIComponent(key),
    });

    // Execute delete
    await s3Client.send(command);

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
