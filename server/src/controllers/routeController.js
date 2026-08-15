import { DEFAULT_FILL_THRESHOLD } from '../config/fleet.js';
import { badRequest } from '../utils/errors.js';
import { planCollectionRoute } from '../services/routeService.js';
import { analyseRoute } from '../services/sustainabilityAgent.js';
import { isGeminiConfigured } from '../services/geminiService.js';

function thresholdFrom(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_FILL_THRESHOLD;

  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw badRequest('fillThreshold must be a number between 0 and 100.');
  }
  return threshold;
}

/**
 * GET /api/routes/optimize?fillThreshold=70
 * Pure arithmetic - no AI, so the dashboard can load the plan instantly.
 */
export async function optimizeRoute(req, res) {
  const plan = await planCollectionRoute({ fillThreshold: thresholdFrom(req.query.fillThreshold) });
  res.json({ plan, aiConfigured: isGeminiConfigured() });
}

/**
 * POST /api/routes/analyze
 * The same plan, plus Gemini's operational briefing on top.
 */
export async function analyseCollectionRoute(req, res) {
  const plan = await planCollectionRoute({ fillThreshold: thresholdFrom(req.body?.fillThreshold) });
  const analysis = await analyseRoute(plan);

  res.json({ plan, analysis, aiConfigured: isGeminiConfigured() });
}
