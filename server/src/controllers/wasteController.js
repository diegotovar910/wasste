import { WasteEvent } from '../models/WasteEvent.js';
import { ALL_CATEGORIES, LOW_CONFIDENCE_THRESHOLD } from '../config/wasteCategories.js';
import { badRequest } from '../utils/errors.js';
import { computeImpact } from '../utils/impact.js';
import {
  DEFAULT_PERIOD_DAYS,
  getCategoryTotals,
  getWasteTimeSeries,
  toCategoryRows,
} from '../services/analyticsService.js';
import { classifyImage, recordWasteEvent } from '../services/wasteClassificationService.js';

/**
 * POST /api/waste/classify   (multipart/form-data)
 *
 * The end-to-end loop: image -> Gemini -> validated category -> stored event
 * -> updated bin statistics.
 */
export async function classifyWaste(req, res) {
  if (!req.file) throw badRequest('Please upload a valid image.');

  const { classification, source, notice } = await classifyImage({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
  });

  const binId = req.body?.binId;
  const shouldRecord = binId && req.body?.record !== 'false';

  let event = null;
  let bin = null;

  if (shouldRecord) {
    const recorded = await recordWasteEvent({ binId, classification, source });
    event = recorded.event;
    bin = recorded.bin.toJSON();
  }

  res.json({
    classification,
    source,
    notice,
    lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
    recorded: Boolean(event),
    event,
    bin,
  });
}

/** GET /api/waste/events */
export async function listWasteEvents(req, res) {
  const limit = Math.min(Number(req.query.limit) || 25, 200);
  const filter = {};

  if (req.query.binId) filter.smartBinId = req.query.binId;
  if (req.query.category) {
    const category = String(req.query.category).toUpperCase();
    if (!ALL_CATEGORIES.includes(category)) throw badRequest('Unknown waste category.');
    filter.category = category;
  }

  const events = await WasteEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('smartBinId', 'name code')
    .lean();

  res.json({
    events: events.map((event) => ({
      ...event,
      bin: event.smartBinId ? { id: String(event.smartBinId._id), name: event.smartBinId.name, code: event.smartBinId.code } : null,
      smartBinId: event.smartBinId ? String(event.smartBinId._id) : null,
    })),
  });
}

/** GET /api/waste/stats */
export async function getWasteStats(req, res) {
  const days = Math.min(Number(req.query.days) || DEFAULT_PERIOD_DAYS, 90);
  const binId = req.query.binId || null;

  const [{ kg, counts }, timeSeries] = await Promise.all([
    getCategoryTotals({ binId, days }),
    getWasteTimeSeries({ binId, days }),
  ]);

  res.json({
    periodDays: days,
    binId,
    categoryRows: toCategoryRows(kg, counts),
    counts,
    timeSeries,
    ...computeImpact(kg, { periodDays: days }),
  });
}
