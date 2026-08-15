import { SmartBin } from '../models/SmartBin.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { computeImpact } from '../utils/impact.js';
import { isGeminiConfigured } from '../services/geminiService.js';
import {
  DEFAULT_PERIOD_DAYS,
  getCategoryTotals,
  getCityOverview,
  getFillLevels,
  getTopLocations,
  getWasteTimeSeries,
  toCategoryRows,
} from '../services/analyticsService.js';

/**
 * GET /api/dashboard
 * One aggregated payload for the city overview so the front end makes a single
 * request on load (section 25).
 */
export async function getDashboard(req, res) {
  const days = Math.min(Number(req.query.days) || DEFAULT_PERIOD_DAYS, 90);

  const [overview, bins, fillLevels, topLocations, timeSeries, totals, recentEvents] = await Promise.all([
    getCityOverview({ days }),
    SmartBin.find().sort({ code: 1 }),
    getFillLevels(),
    getTopLocations(5),
    getWasteTimeSeries({ days }),
    getCategoryTotals({ days }),
    WasteEvent.find().sort({ createdAt: -1 }).limit(8).populate('smartBinId', 'name code').lean(),
  ]);

  res.json({
    periodDays: days,
    overview,
    bins: bins.map((bin) => ({
      ...bin.toJSON(),
      impact: computeImpact(bin.wasteByCategoryKg).measured,
    })),
    fillLevels,
    topLocations,
    timeSeries,
    categoryRows: toCategoryRows(overview.distributionKg, totals.counts),
    periodCategoryRows: toCategoryRows(totals.kg, totals.counts),
    recentEvents: recentEvents.map((event) => ({
      ...event,
      bin: event.smartBinId ? { id: String(event.smartBinId._id), name: event.smartBinId.name } : null,
    })),
    aiConfigured: isGeminiConfigured(),
  });
}
