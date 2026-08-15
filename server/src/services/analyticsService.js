import mongoose from 'mongoose';
import { SmartBin } from '../models/SmartBin.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { CATEGORIES, DISTRIBUTION_KEY } from '../config/wasteCategories.js';
import {
  addDistributions,
  computeImpact,
  emptyDistribution,
  round,
  sumDistribution,
} from '../utils/impact.js';

export const DEFAULT_PERIOD_DAYS = 30;

const startOfPeriod = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const toObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(String(value)) : null;

/**
 * Everything in this file is deterministic arithmetic over stored waste events
 * (section 18). No model is involved: this is the "truth" half of the system.
 */

/** kg and item counts per category, optionally scoped to one bin and a period. */
export async function getCategoryTotals({ binId, days = DEFAULT_PERIOD_DAYS } = {}) {
  const match = { createdAt: { $gte: startOfPeriod(days) } };
  const binObjectId = binId ? toObjectId(binId) : null;
  if (binObjectId) match.smartBinId = binObjectId;

  const rows = await WasteEvent.aggregate([
    { $match: match },
    { $group: { _id: '$category', kg: { $sum: '$estimatedWeightKg' }, count: { $sum: 1 } } },
  ]);

  const kg = emptyDistribution();
  const counts = { ...emptyDistribution(), unknown: 0 };

  for (const row of rows) {
    const key = DISTRIBUTION_KEY[row._id];
    if (key) {
      kg[key] = round(row.kg);
      counts[key] = row.count;
    } else {
      counts.unknown += row.count;
    }
  }

  return { kg, counts };
}

/** Daily kg per category, with empty days filled in so charts stay continuous. */
export async function getWasteTimeSeries({ binId, days = DEFAULT_PERIOD_DAYS } = {}) {
  const since = startOfPeriod(days);
  const match = { createdAt: { $gte: since } };
  const binObjectId = binId ? toObjectId(binId) : null;
  if (binObjectId) match.smartBinId = binObjectId;

  const rows = await WasteEvent.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          category: '$category',
        },
        kg: { $sum: '$estimatedWeightKg' },
      },
    },
  ]);

  const byDate = new Map();
  for (const row of rows) {
    const bucket = byDate.get(row._id.date) || emptyDistribution();
    const key = DISTRIBUTION_KEY[row._id.category];
    if (key) bucket[key] = round(bucket[key] + row.kg);
    byDate.set(row._id.date, bucket);
  }

  const series = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const bucket = byDate.get(date) || emptyDistribution();
    series.push({ date, ...bucket, total: sumDistribution(bucket) });
  }

  return series;
}

/** Ranks bins by lifetime collected weight (section 23: top waste locations). */
export async function getTopLocations(limit = 5) {
  const bins = await SmartBin.find().lean();

  return bins
    .map((bin) => ({
      id: String(bin._id),
      code: bin.code,
      name: bin.name,
      address: bin.location.address,
      totalWasteKg: sumDistribution(bin.wasteByCategoryKg),
      fillPercentage: bin.currentFillPercentage,
    }))
    .sort((a, b) => b.totalWasteKg - a.totalWasteKg)
    .slice(0, limit);
}

/** Fill levels for every bin, ordered fullest first (collection priority). */
export async function getFillLevels() {
  const bins = await SmartBin.find().lean();

  return bins
    .map((bin) => ({
      id: String(bin._id),
      code: bin.code,
      name: bin.name,
      address: bin.location.address,
      fillPercentage: bin.currentFillPercentage,
      status: bin.status,
      estimatedWeightKg: round(bin.sensors?.estimatedWeightKg || 0),
      capacityKg: bin.capacityKg,
    }))
    .sort((a, b) => b.fillPercentage - a.fillPercentage);
}

/** City-wide roll-up used by the main dashboard (sections 19 and 21). */
export async function getCityOverview({ days = DEFAULT_PERIOD_DAYS } = {}) {
  const bins = await SmartBin.find().lean();

  const lifetimeDistribution = bins.reduce(
    (total, bin) => addDistributions(total, bin.wasteByCategoryKg),
    emptyDistribution(),
  );

  const impact = computeImpact(lifetimeDistribution, { periodDays: days });

  const statusCounts = bins.reduce((counts, bin) => {
    counts[bin.status] = (counts[bin.status] || 0) + 1;
    return counts;
  }, {});

  const totalEvents = await WasteEvent.estimatedDocumentCount();

  return {
    binCount: bins.length,
    activeBinCount: bins.filter((bin) => bin.status !== 'OFFLINE').length,
    binsNeedingCollection: bins.filter((bin) => ['NEEDS_ATTENTION', 'FULL'].includes(bin.status)).length,
    statusCounts,
    totalEvents,
    averageFillPercentage: bins.length
      ? Math.round(bins.reduce((sum, bin) => sum + bin.currentFillPercentage, 0) / bins.length)
      : 0,
    ...impact,
  };
}

/** The category breakdown expressed as chart-ready rows in a fixed order. */
export function toCategoryRows(kg = {}, counts = {}) {
  return CATEGORIES.map((category) => {
    const key = DISTRIBUTION_KEY[category];
    return {
      category,
      key,
      kg: round(kg[key] || 0),
      count: counts[key] || 0,
    };
  });
}
