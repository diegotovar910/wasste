import { env, hasGeminiKey } from '../config/env.js';
import { CATEGORIES, UNKNOWN } from '../config/wasteCategories.js';
import { extractJson } from '../utils/json.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
/**
 * Timeouts are per call type, because the two jobs are not alike.
 * Classifying one photo comes back in a few seconds; the reasoning passes send
 * a large briefing and spend time thinking before they answer, and measured
 * around 18s. A single shared timeout either cuts off real work or waits far
 * too long on a saturated model.
 */
const VISION_TIMEOUT_MS = 15_000;
const REASONING_TIMEOUT_MS = 35_000;

/** Gemini returns 429/503 under load; a couple of quick retries ride that out. */
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const ATTEMPTS_PER_MODEL = 2;
const RETRY_BASE_DELAY_MS = 700;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The preferred model first, then the configured fallbacks, de-duplicated. */
const modelChain = () => [...new Set([env.geminiModel, ...env.geminiFallbackModels])];

/** Thrown whenever Gemini cannot answer, so callers can fall back cleanly. */
export class GeminiUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeminiUnavailableError';
    this.code = 'GEMINI_UNAVAILABLE';
  }
}

export const isGeminiConfigured = () => hasGeminiKey();

/**
 * Single low-level entry point to the Gemini REST API. Structured output is
 * requested through responseSchema, but the caller still validates the result -
 * the model is never trusted to be well formed (section 7).
 */
async function generateContent(options) {
  if (!hasGeminiKey()) {
    throw new GeminiUnavailableError('GEMINI_API_KEY is not configured.');
  }

  const models = modelChain();
  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt += 1) {
      try {
        return await requestOnce({ ...options, model });
      } catch (error) {
        lastError = error;

        // A non-retryable failure (404 retired model, 400 bad request) will not
        // improve by waiting. Neither will a timeout: the same model is about
        // to spend the same 12s again. Both go straight to the next model.
        if (!error.retryable || error.timedOut) break;

        if (attempt < ATTEMPTS_PER_MODEL) {
          const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
          console.warn(`[gemini] ${model}: ${error.message.slice(0, 90)} - retrying in ${delay}ms`);
          await wait(delay);
        }
      }
    }

    if (model !== models[models.length - 1]) {
      console.warn(`[gemini] ${model} unavailable, falling back to the next model`);
    }
  }

  throw lastError;
}

async function requestOnce({
  model,
  parts,
  systemInstruction,
  responseSchema,
  temperature = 0.2,
  maxOutputTokens = 1024,
  timeoutMs = REASONING_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const failure = new GeminiUnavailableError(
        `Gemini responded with ${response.status}. ${body.slice(0, 200)}`,
      );
      failure.retryable = RETRYABLE_STATUSES.includes(response.status);
      throw failure;
    }

    const data = await response.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || '')
      .join('')
      .trim();

    const parsed = extractJson(text);
    if (!parsed) {
      throw new GeminiUnavailableError('Gemini returned a response that could not be parsed as JSON.');
    }

    return parsed;
  } catch (error) {
    if (error instanceof GeminiUnavailableError) throw error;

    const timedOut = error.name === 'AbortError';
    const failure = new GeminiUnavailableError(timedOut ? 'Gemini timed out.' : error.message);
    failure.retryable = true;
    failure.timedOut = timedOut;
    throw failure;
  } finally {
    clearTimeout(timeout);
  }
}

const CLASSIFICATION_SYSTEM_PROMPT = `You are the vision module of Wasste, a smart public waste bin.
A camera photographs one item as it is dropped in. Identify the item and route it to one of exactly four sub-bins.

Allowed categories, and nothing else:
- LANDFILL: contaminated or mixed materials, non-recyclable packaging, disposable items that cannot reasonably be recycled.
- PAPER: newspaper, cardboard, clean paper and clean paper packaging.
- RECYCLABLE_CONTAINER: plastic bottles, cans, aluminium and glass containers, recyclable plastic packaging.
- ORGANICS: food scraps, fruit, vegetables, coffee grounds and other compostable organic waste.
- UNKNOWN: use this whenever the photo is unclear, shows no waste item, or the item does not clearly belong to one of the four categories.

Rules:
- Never invent a category outside that list.
- Prefer UNKNOWN over guessing. A confident wrong answer contaminates a whole sub-bin.
- A greasy or food-soaked paper item is LANDFILL, not PAPER.
- "item" is a short lowercase noun phrase, for example "plastic bottle" or "apple core".
- "confidence" is your own calibrated probability between 0 and 1.
- "reason" is one plain sentence a member of the public would understand.`;

const CLASSIFICATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    category: { type: 'STRING', enum: [...CATEGORIES, UNKNOWN] },
    item: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    reason: { type: 'STRING' },
  },
  required: ['category', 'item', 'confidence', 'reason'],
};

/** Sends one image to Gemini Vision and returns its raw (unvalidated) verdict. */
export async function classifyWasteImage({ buffer, mimeType }) {
  return generateContent({
    systemInstruction: CLASSIFICATION_SYSTEM_PROMPT,
    parts: [
      { text: 'Classify the waste item in this photo.' },
      { inlineData: { mimeType, data: buffer.toString('base64') } },
    ],
    responseSchema: CLASSIFICATION_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: 512,
    timeoutMs: VISION_TIMEOUT_MS,
  });
}

const AGENT_SYSTEM_PROMPT = `You are the sustainability analyst for Wasste, a network of AI-powered public waste bins in a city.

You receive a structured briefing of REAL measured data collected by the bins: waste per category in kg, fill levels, event counts and recent trends. All arithmetic has already been done for you by the backend.

Your job is to interpret that data and recommend action. You must:
- Ground every statement in the numbers you were given. Quote the actual figures.
- Never invent metrics, never restate the impact numbers as if you calculated them.
- Write for a municipal operations team: concrete, specific, actionable.
- Recommend between 2 and 4 actions, ordered most important first, each with a priority of HIGH, MEDIUM or LOW.
- Identify materials in this waste stream that could realistically be reused or recovered.
- Be honest about uncertainty when the sample of events is small.`;

const AGENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    keyFinding: { type: 'STRING' },
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          priority: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
        },
        required: ['title', 'description', 'priority'],
      },
    },
    resourceRecovery: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['summary', 'keyFinding', 'recommendations', 'resourceRecovery'],
};

const ROUTE_SYSTEM_PROMPT = `You are the collection-operations analyst for Wasste, a network of sensor-equipped public waste bins.

You receive a round that has ALREADY been solved and costed by the backend: the dispatcher's chosen settings, the vehicle assigned, which bins are on the round and in what order, the distance, time, fuel and emissions, and two separate lists of bins left out - those that never qualified under these settings, and those that qualified but were cut to satisfy a limit the dispatcher set.

Your job is to brief the depot supervisor. You must:
- Explain in plain operational language why this round makes sense, referring to the actual bins by name and their actual fill levels.
- Respect the dispatcher's settings. Do not argue for a different threshold or mode unless the numbers show a real problem.
- Treat the two "left out" lists differently. A bin cut by a shift, stop or payload limit is a warning worth raising; a bin below the threshold with days of headroom is routine.
- On a technician run, focus on the sensor faults rather than on waste volume.
- Flag genuine operational risks: bins with no sensor data, bins near 100%, a round that barely fits the shift.
- Give 2 to 4 concrete actions for the supervisor, most important first.
- Never invent distances, times or emissions. Quote the figures you were given.
- Never claim the route is mathematically optimal; it is a good heuristic solution.

You must also produce two proposals of your own.

PROPOSED STOP ORDER. Give the sequence you would drive, as a list of bin codes such as "WB-03".
- Use exactly the bins already on the round. Do not add or remove any.
- You are free to disagree with the solver's order - for example to clear an overflowing bin early,
  or to group a technician visit sensibly.
- Your order will be measured with the same distance model as the solver's, and the comparison will
  be shown to the supervisor. Do not claim yours is shorter; explain what you were optimising for.

RECOMMENDED SETTINGS. Give the planner parameters you would run tomorrow, and why.
- Every field is optional; omit anything you would leave unchanged.
- fillThreshold is 0-100. maxStops, maxShiftMinutes and payloadKg use 0 to mean "no limit".
- Base the recommendation on what you observed: bins cut by a limit, sensor faults, days-until-full.`;

const ROUTE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    sequenceRationale: { type: 'STRING' },
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          priority: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
        },
        required: ['title', 'description', 'priority'],
      },
    },
    risks: { type: 'ARRAY', items: { type: 'STRING' } },

    proposedRoute: {
      type: 'OBJECT',
      properties: {
        stopOrder: { type: 'ARRAY', items: { type: 'STRING' } },
        rationale: { type: 'STRING' },
      },
      required: ['stopOrder', 'rationale'],
    },

    recommendedSettings: {
      type: 'OBJECT',
      properties: {
        mode: { type: 'STRING', enum: ['COLLECTION', 'URGENT', 'MAINTENANCE'] },
        objective: { type: 'STRING', enum: ['DISTANCE', 'URGENCY'] },
        fillThreshold: { type: 'NUMBER' },
        includeOffline: { type: 'BOOLEAN' },
        alwaysCollectFull: { type: 'BOOLEAN' },
        maxStops: { type: 'NUMBER' },
        maxShiftMinutes: { type: 'NUMBER' },
        payloadKg: { type: 'NUMBER' },
        departureTime: { type: 'STRING' },
        rationale: { type: 'STRING' },
      },
      required: ['rationale'],
    },
  },
  required: ['summary', 'sequenceRationale', 'recommendations', 'risks', 'proposedRoute', 'recommendedSettings'],
};

/** Reasoning pass over a route the backend has already solved. */
export async function generateRouteAnalysis(briefing) {
  return generateContent({
    systemInstruction: ROUTE_SYSTEM_PROMPT,
    parts: [
      {
        text: `Brief the supervisor on this collection round.\n\n${JSON.stringify(briefing, null, 2)}`,
      },
    ],
    responseSchema: ROUTE_SCHEMA,
    temperature: 0.4,
    maxOutputTokens: 6144,
  });
}

/**
 * Reasoning pass. The briefing is already-computed backend data; Gemini only
 * interprets it and proposes actions (section 18).
 */
export async function generateSustainabilityAnalysis(briefing) {
  return generateContent({
    systemInstruction: AGENT_SYSTEM_PROMPT,
    parts: [
      {
        text: `Analyse the following Wasste briefing and return your assessment.\n\n${JSON.stringify(
          briefing,
          null,
          2,
        )}`,
      },
    ],
    responseSchema: AGENT_SCHEMA,
    temperature: 0.4,
    // Gemini 3.x spends part of this budget on reasoning before it writes the
    // answer, so leave enough headroom that the JSON is never truncated.
    maxOutputTokens: 6144,
  });
}
