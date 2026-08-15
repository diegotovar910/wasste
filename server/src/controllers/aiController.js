import { DEFAULT_PERIOD_DAYS } from '../services/analyticsService.js';
import { analyseBin, analyseCity } from '../services/sustainabilityAgent.js';
import { isGeminiConfigured } from '../services/geminiService.js';

const periodFrom = (value) => Math.min(Number(value) || DEFAULT_PERIOD_DAYS, 90);

/**
 * POST /api/ai/analyze
 * Body: { binId?: string, days?: number }
 * Without a binId the agent reasons over the whole city.
 */
export async function analyse(req, res) {
  const days = periodFrom(req.body?.days);
  const binId = req.body?.binId;

  const analysis = binId ? await analyseBin(binId, { days }) : await analyseCity({ days });

  res.json({ analysis, aiConfigured: isGeminiConfigured() });
}

/** GET /api/ai/recommendations/:binId */
export async function getBinRecommendations(req, res) {
  const days = periodFrom(req.query.days);
  const analysis = await analyseBin(req.params.binId, { days });

  res.json({ analysis, aiConfigured: isGeminiConfigured() });
}
