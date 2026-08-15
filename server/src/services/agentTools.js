import { SmartBin } from '../models/SmartBin.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { DISTRIBUTION_KEY } from '../config/wasteCategories.js';
import { computeImpact, round, sumDistribution, toPercentages } from '../utils/impact.js';
import {
  DEFAULT_PERIOD_DAYS,
  getCategoryTotals,
  getCityOverview,
  getFillLevels,
  getWasteTimeSeries,
} from './analyticsService.js';

/**
 * The agent's "tools" (section 32). These are ordinary backend functions the
 * sustainability agent calls to observe the system before it reasons - no agent
 * framework, no vector store, just data access with a clear contract.
 */

export async function getBinData(binId) {
  const bin = await SmartBin.findById(binId).lean();
  if (!bin) return null;

  return {
    id: String(bin._id),
    code: bin.code,
    name: bin.name,
    address: bin.location.address,
    capacityKg: bin.capacityKg,
    status: bin.status,
    fillPercentage: bin.currentFillPercentage,
    totalWasteKg: sumDistribution(bin.wasteByCategoryKg),
    wasteByCategoryKg: bin.wasteByCategoryKg,
    wasteDistributionPct: toPercentages(bin.wasteByCategoryKg),
    eventCounts: bin.eventCounts,
  };
}

export async function getRecentWasteEvents(binId, limit = 25) {
  const filter = binId ? { smartBinId: binId } : {};
  const events = await WasteEvent.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

  return events.map((event) => ({
    item: event.item,
    category: event.category,
    confidence: event.confidence,
    estimatedWeightKg: event.estimatedWeightKg,
    createdAt: event.createdAt,
  }));
}

export const getWasteStatistics = ({ binId, days = DEFAULT_PERIOD_DAYS } = {}) =>
  getCategoryTotals({ binId, days });

export async function getFillLevel(binId) {
  const bin = await SmartBin.findById(binId).lean();
  if (!bin) return null;
  return {
    fillPercentage: bin.currentFillPercentage,
    status: bin.status,
    estimatedWeightKg: round(bin.sensors?.estimatedWeightKg || 0),
    capacityKg: bin.capacityKg,
  };
}

export const calculateLandfillDiversion = (wasteByCategoryKg) =>
  computeImpact(wasteByCategoryKg).measured;

export const calculateEstimatedImpact = (wasteByCategoryKg, periodDays = DEFAULT_PERIOD_DAYS) =>
  computeImpact(wasteByCategoryKg, { periodDays });

/**
 * Compares one bin's mix against the city average - the "28% above the city
 * average" style insight in section 20.
 */
export async function compareWithCity(binDistributionPct) {
  const city = await getCityOverview();
  const deltas = {};

  for (const key of Object.values(DISTRIBUTION_KEY)) {
    deltas[key] = round((binDistributionPct[key] || 0) - (city.distributionPct[key] || 0), 1);
  }

  return { cityDistributionPct: city.distributionPct, deltaVsCityPct: deltas };
}

/** Splits the period in half to show which streams are growing (section 16). */
export async function getCategoryTrend({ binId, days = DEFAULT_PERIOD_DAYS } = {}) {
  const series = await getWasteTimeSeries({ binId, days });
  const half = Math.floor(series.length / 2);
  const keys = Object.values(DISTRIBUTION_KEY);

  const sumRange = (rows) =>
    keys.reduce((totals, key) => {
      totals[key] = round(rows.reduce((sum, row) => sum + (row[key] || 0), 0));
      return totals;
    }, {});

  const earlier = sumRange(series.slice(0, half));
  const recent = sumRange(series.slice(half));

  const changePct = {};
  for (const key of keys) {
    changePct[key] = earlier[key] > 0 ? Math.round(((recent[key] - earlier[key]) / earlier[key]) * 100) : null;
  }

  return {
    earlierHalfKg: earlier,
    recentHalfKg: recent,
    changePct,
    windowDays: days,
  };
}

export { getCityOverview, getFillLevels };
