import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wasste',
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: (process.env.GEMINI_MODEL || 'gemini-3.7-flash').trim(),
  /**
   * Tried in order when the preferred model is saturated. Google returns 503
   * "high demand" on popular models often enough that a live demo needs a
   * second choice before it gives up on the AI entirely.
   */
  geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.6-flash,gemini-3.5-flash')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Upload guards (section 27: file type + size validation).
  maxUploadBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
};

/** True when a Gemini key is configured. When false the app degrades to demo mode. */
export const hasGeminiKey = () => env.geminiApiKey.length > 0;
