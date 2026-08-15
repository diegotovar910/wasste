import { createApp } from './app.js';
import { env, hasGeminiKey } from './config/env.js';
import { connectDatabase } from './config/db.js';

async function start() {
  await connectDatabase();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`\n  Wasste API listening on http://localhost:${env.port}`);
    console.log(`  Gemini: ${hasGeminiKey() ? `enabled (${env.geminiModel})` : 'no API key - demo mode'}`);
    console.log(`  Allowed origins: ${env.clientOrigins.join(', ')}\n`);
  });
}

start().catch((error) => {
  console.error('[server] failed to start:', error);
  process.exit(1);
});
