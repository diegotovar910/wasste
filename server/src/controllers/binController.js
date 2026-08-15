import { SmartBin, statusFromFill } from '../models/SmartBin.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { badRequest, notFound } from '../utils/errors.js';
import { computeImpact, round } from '../utils/impact.js';
import { DEFAULT_PERIOD_DAYS, getWasteTimeSeries, toCategoryRows } from '../services/analyticsService.js';

/** GET /api/bins */
export async function listBins(req, res) {
  const bins = await SmartBin.find().sort({ code: 1 });

  res.json({
    bins: bins.map((bin) => ({
      ...bin.toJSON(),
      impact: computeImpact(bin.wasteByCategoryKg).measured,
    })),
  });
}

/** GET /api/bins/:id */
export async function getBin(req, res) {
  const bin = await SmartBin.findById(req.params.id);
  if (!bin) throw notFound('That Wasste bin does not exist.');

  const days = Number(req.query.days) || DEFAULT_PERIOD_DAYS;

  const [recentEvents, timeSeries] = await Promise.all([
    WasteEvent.find({ smartBinId: bin._id }).sort({ createdAt: -1 }).limit(12).lean(),
    getWasteTimeSeries({ binId: bin._id, days }),
  ]);

  const impact = computeImpact(bin.wasteByCategoryKg, { periodDays: days });

  res.json({
    bin: bin.toJSON(),
    categoryRows: toCategoryRows(bin.wasteByCategoryKg, bin.eventCounts),
    impact,
    timeSeries,
    recentEvents,
  });
}

/** POST /api/bins */
export async function createBin(req, res) {
  const { code, name, location, capacityKg } = req.body || {};

  if (!code || !name) throw badRequest('A bin needs both a code and a name.');
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    throw badRequest('A bin needs a location with numeric latitude and longitude.');
  }
  if (!location.address) throw badRequest('A bin needs a street address.');

  const bin = await SmartBin.create({
    code,
    name,
    location,
    capacityKg: capacityKg || 200,
  });

  res.status(201).json({ bin: bin.toJSON() });
}

/**
 * POST /api/bins/:id/sensor
 *
 * Stands in for the ultrasonic + load-cell readings a real Wasste bin would
 * push (section 11). Sending an empty body lets the bin drift on its own so
 * the dashboard can be demoed live. Everything written here is flagged as
 * SIMULATED.
 */
export async function updateSensorReading(req, res) {
  const bin = await SmartBin.findById(req.params.id);
  if (!bin) throw notFound('That Wasste bin does not exist.');

  const { fillPercentage, estimatedWeightKg, temperatureC, status } = req.body || {};

  if (fillPercentage !== undefined) {
    const value = Number(fillPercentage);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw badRequest('fillPercentage must be a number between 0 and 100.');
    }
    // A drop in fill level means the bin was emptied on a collection round.
    if (value < bin.currentFillPercentage) bin.lastCollectedAt = new Date();
    bin.currentFillPercentage = round(value, 1);
  } else {
    // No explicit reading: drift upward the way a bin in use would.
    const drift = Math.random() * 4;
    bin.currentFillPercentage = Math.min(100, round(bin.currentFillPercentage + drift, 1));
  }

  if (estimatedWeightKg !== undefined) {
    const value = Number(estimatedWeightKg);
    if (!Number.isFinite(value) || value < 0) throw badRequest('estimatedWeightKg must be a positive number.');
    bin.sensors.estimatedWeightKg = round(value);
  } else {
    bin.sensors.estimatedWeightKg = round((bin.currentFillPercentage / 100) * bin.capacityKg);
  }

  if (temperatureC !== undefined) {
    const value = Number(temperatureC);
    if (!Number.isFinite(value)) throw badRequest('temperatureC must be a number.');
    bin.sensors.temperatureC = round(value, 1);
  }

  if (status === 'OFFLINE' || status === 'ACTIVE') {
    bin.status = status === 'OFFLINE' ? 'OFFLINE' : statusFromFill(bin.currentFillPercentage);
  }

  bin.sensors.lastReadingAt = new Date();
  bin.sensors.source = 'SIMULATED';
  bin.lastUpdated = new Date();
  await bin.save();

  res.json({
    bin: bin.toJSON(),
    reading: {
      fillPercentage: bin.currentFillPercentage,
      estimatedWeightKg: bin.sensors.estimatedWeightKg,
      temperatureC: bin.sensors.temperatureC,
      status: bin.status,
      source: 'SIMULATED',
      readAt: bin.sensors.lastReadingAt,
    },
  });
}
