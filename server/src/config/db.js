import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Connects to MongoDB. The server intentionally keeps running when the
 * database is unreachable so the API can answer with a clean 503 instead of
 * crashing the whole demo (section 28: database failure handling).
 */
export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[db] connected to ${redact(env.mongoUri)}`);
    return true;
  } catch (error) {
    console.error(`[db] connection failed: ${error.message}`);
    console.error('[db] the API will start, but data endpoints will return 503 until MongoDB is reachable.');
    return false;
  }
}

/** Mongoose readyState 1 === connected. */
export const isDatabaseReady = () => mongoose.connection.readyState === 1;

function redact(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}
