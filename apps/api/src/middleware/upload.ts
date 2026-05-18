import multer from "multer";
import { env } from "../config/env.js";

// First-pass guard: rejects obviously non-image declared MIME types early so
// we don't buffer multi-megabyte uploads we'll throw away. Magic-byte
// verification still runs server-side in the service (TZ §9 — never trust
// the content-type header).
function imageOnly(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("UNSUPPORTED_MEDIA"));
  }
}

export const lotPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.LOT_PHOTO_MAX_BYTES,
    files: env.LOT_PHOTO_MAX_COUNT,
  },
  fileFilter: imageOnly,
}).array("photos", env.LOT_PHOTO_MAX_COUNT);
