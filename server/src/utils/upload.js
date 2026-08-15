import multer from 'multer';
import { env } from '../config/env.js';
import { badRequest } from './errors.js';

/**
 * Images stay in memory: they are forwarded straight to Gemini and never
 * written to disk (section 27 - type + size validation, no storage surface).
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter(req, file, callback) {
    if (!env.allowedMimeTypes.includes(file.mimetype)) {
      callback(badRequest('Please upload a valid image (JPEG, PNG, WebP or HEIC).'));
      return;
    }
    callback(null, true);
  },
}).single('image');

/** Runs multer and converts its errors into friendly ApiErrors. */
export function handleImageUpload(req, res, next) {
  imageUpload(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? `Image is too large. The limit is ${Math.round(env.maxUploadBytes / (1024 * 1024))} MB.`
          : 'Please upload a valid image.';
      next(badRequest(message));
      return;
    }

    next(error);
  });
}
