import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config/env.js";
import { logger } from "./logger.js";

// Single shared client. The SDK pools HTTP keep-alive connections internally.
const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  } catch (err) {
    logger.error(
      {
        err,
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET,
        key,
        contentType,
        bytes: body.byteLength,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        accessKeyPreview: env.S3_ACCESS_KEY.slice(0, 4) + "***",
      },
      "s3_put_object_failed"
    );
    throw err;
  }
}

export async function getPresignedGetUrl(key: string, ttlSeconds: number): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: ttlSeconds,
  });
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

// Stable per-org/per-lot/per-photo layout. Tied to ObjectId values that
// already live in Mongo so the bucket can be browsed without joining tables.
export function buildLotPhotoKey(orgId: string, lotId: string, photoId: string): string {
  return `orgs/${orgId}/lots/${lotId}/photos/${photoId}.jpg`;
}
