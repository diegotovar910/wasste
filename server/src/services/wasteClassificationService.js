import {
  CATEGORY_LABELS,
  LOW_CONFIDENCE_THRESHOLD,
  UNKNOWN,
  normaliseCategory,
} from '../config/wasteCategories.js';
import { SmartBin } from '../models/SmartBin.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { notFound, serviceUnavailable } from '../utils/errors.js';
import { estimateWeightKg } from '../utils/weight.js';
import { round } from '../utils/impact.js';
import {
  GeminiUnavailableError,
  classifyWasteImage,
  isGeminiConfigured,
} from './geminiService.js';

/**
 * Turns whatever Gemini said into a value the rest of the system can trust
 * (sections 7 and 8). Anything unexpected collapses to UNKNOWN rather than
 * inventing a fifth sub-bin.
 */
export function validateClassification(raw) {
  const category = normaliseCategory(raw?.category);

  const item =
    typeof raw?.item === 'string' && raw.item.trim()
      ? raw.item.trim().slice(0, 120).toLowerCase()
      : 'unidentified item';

  const parsedConfidence = Number(raw?.confidence);
  let confidence = Number.isFinite(parsedConfidence) ? parsedConfidence : 0;
  if (confidence > 1) confidence = confidence / 100; // tolerate "94" meaning 94%
  confidence = Math.min(1, Math.max(0, round(confidence, 2)));

  const reason =
    typeof raw?.reason === 'string' && raw.reason.trim()
      ? raw.reason.trim().slice(0, 400)
      : 'No explanation was returned for this classification.';

  const isUnknown = category === UNKNOWN;
  const needsReview = isUnknown || confidence < LOW_CONFIDENCE_THRESHOLD;

  return {
    category,
    categoryLabel: CATEGORY_LABELS[category],
    item,
    confidence,
    reason,
    needsReview,
    estimatedWeightKg: estimateWeightKg(item, category),
    recommendedBin: isUnknown ? null : CATEGORY_LABELS[category],
  };
}

/**
 * Demo fallback used only when no GEMINI_API_KEY is configured, so the
 * prototype still demonstrates the full loop. Always labelled DEMO in the API
 * response - it is never presented as a real AI result.
 */
const DEMO_RESULTS = [
  { category: 'RECYCLABLE_CONTAINER', item: 'plastic bottle', confidence: 0.94, reason: 'Demo result: a PET bottle of this shape is accepted as a recyclable container.' },
  { category: 'PAPER', item: 'cardboard box', confidence: 0.91, reason: 'Demo result: clean corrugated cardboard belongs in paper recycling.' },
  { category: 'ORGANICS', item: 'apple core', confidence: 0.89, reason: 'Demo result: food scraps are compostable organic waste.' },
  { category: 'LANDFILL', item: 'coffee cup', confidence: 0.78, reason: 'Demo result: plastic-lined cups are not accepted in paper recycling.' },
  { category: 'UNKNOWN', item: 'unidentified item', confidence: 0.35, reason: 'Demo result: the object could not be matched to a single sub-bin.' },
];

function demoClassification(seed = 0) {
  return DEMO_RESULTS[seed % DEMO_RESULTS.length];
}

/**
 * Runs the vision step. Returns the validated classification plus the source,
 * so the UI can be explicit about where the answer came from.
 */
export async function classifyImage({ buffer, mimeType }) {
  if (!isGeminiConfigured()) {
    return {
      classification: validateClassification(demoClassification(buffer.length)),
      source: 'DEMO',
      notice: 'Running without a Gemini API key. This is a demo classification, not a real AI result.',
    };
  }

  try {
    const raw = await classifyWasteImage({ buffer, mimeType });
    return { classification: validateClassification(raw), source: 'GEMINI', notice: null };
  } catch (error) {
    if (error instanceof GeminiUnavailableError) {
      console.error('[gemini] classification failed:', error.message);
      throw serviceUnavailable('AI analysis is temporarily unavailable. Please try again.');
    }
    throw error;
  }
}

/**
 * Persists the classification and updates the bin's sub-bin totals and fill
 * level, which is what makes the dashboard move during the demo (section 30).
 */
export async function recordWasteEvent({ binId, classification, source }) {
  const bin = await SmartBin.findById(binId);
  if (!bin) throw notFound('That Wasste bin does not exist.');

  const event = await WasteEvent.create({
    smartBinId: bin._id,
    category: classification.category,
    item: classification.item,
    confidence: classification.confidence,
    estimatedWeightKg: classification.estimatedWeightKg,
    reason: classification.reason,
    needsReview: classification.needsReview,
    source: source === 'GEMINI' ? 'GEMINI' : 'DEMO',
  });

  bin.applyWasteEvent(classification.category, classification.estimatedWeightKg);
  await bin.save();

  return { event, bin };
}
