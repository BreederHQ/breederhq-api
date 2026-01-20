// src/services/s3-client.ts
// Shared S3 client instance for media uploads

import { S3Client } from "@aws-sdk/client-s3";

// Singleton S3 client instance
let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    const region = process.env.AWS_REGION || "us-east-1";
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables."
      );
    }

    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return s3Client;
}

export function getS3Bucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("S3_BUCKET environment variable not configured.");
  }
  return bucket;
}

export function getCdnDomain(): string {
  // For dev, use direct S3 URL. For prod, use CloudFront domain.
  const cdnDomain = process.env.CDN_DOMAIN;
  if (cdnDomain) {
    return cdnDomain;
  }
  // Fallback to S3 direct URL
  const bucket = getS3Bucket();
  const region = process.env.AWS_REGION || "us-east-1";
  return `${bucket}.s3.${region}.amazonaws.com`;
}
