import { OBJECTIVES, ROUTE_DEFAULTS, ROUTE_MODES } from '../config/fleet.js';
import { badRequest } from '../utils/errors.js';
import { planCollectionRoute } from '../services/routeService.js';
import { analyseRoute } from '../services/sustainabilityAgent.js';
import { isGeminiConfigured } from '../services/geminiService.js';

const isBlank = (value) => value === undefined || value === null || value === '';

function boolean(value, fallback) {
  if (isBlank(value)) return fallback;
  if (typeof value === 'boolean') return value;
  const normalised = String(value).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalised)) return true;
  if (['false', '0', 'no', 'off'].includes(normalised)) return false;
  throw badRequest(`Expected true or false, received "${value}".`);
}

function integer(value, fallback, { min, max, name }) {
  if (isBlank(value)) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw badRequest(`${name} must be a number between ${min} and ${max}.`);
  }
  return Math.round(parsed);
}

function oneOf(value, allowed, fallback, name) {
  if (isBlank(value)) return fallback;

  const normalised = String(value).toUpperCase();
  if (!allowed.includes(normalised)) {
    throw badRequest(`${name} must be one of: ${allowed.join(', ')}.`);
  }
  return normalised;
}

function departureTime(value, fallback) {
  if (isBlank(value)) return fallback;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) {
    throw badRequest('departureTime must be in 24-hour HH:MM format.');
  }
  return String(value);
}

/** Reads planner parameters from a query string or a JSON body. */
export function readRouteParams(source = {}) {
  return {
    mode: oneOf(source.mode, Object.keys(ROUTE_MODES), ROUTE_DEFAULTS.mode, 'mode'),
    objective: oneOf(source.objective, Object.keys(OBJECTIVES), ROUTE_DEFAULTS.objective, 'objective'),
    fillThreshold: integer(source.fillThreshold, ROUTE_DEFAULTS.fillThreshold, {
      min: 0,
      max: 100,
      name: 'fillThreshold',
    }),
    includeOffline: boolean(source.includeOffline, ROUTE_DEFAULTS.includeOffline),
    alwaysCollectFull: boolean(source.alwaysCollectFull, ROUTE_DEFAULTS.alwaysCollectFull),
    maxStops: integer(source.maxStops, ROUTE_DEFAULTS.maxStops, { min: 0, max: 50, name: 'maxStops' }),
    maxShiftMinutes: integer(source.maxShiftMinutes, ROUTE_DEFAULTS.maxShiftMinutes, {
      min: 0,
      max: 1440,
      name: 'maxShiftMinutes',
    }),
    payloadKg: integer(source.payloadKg, ROUTE_DEFAULTS.payloadKg, {
      min: 0,
      max: 20000,
      name: 'payloadKg',
    }),
    departureTime: departureTime(source.departureTime, ROUTE_DEFAULTS.departureTime),
  };
}

/**
 * GET /api/routes/optimize
 * Pure arithmetic - no AI, so the planner responds instantly on every change.
 */
export async function optimizeRoute(req, res) {
  const plan = await planCollectionRoute(readRouteParams(req.query));
  res.json({ plan, aiConfigured: isGeminiConfigured() });
}

/**
 * POST /api/routes/analyze
 * The same plan, plus Gemini's dispatch briefing.
 */
export async function analyseCollectionRoute(req, res) {
  const plan = await planCollectionRoute(readRouteParams(req.body));
  const analysis = await analyseRoute(plan);

  res.json({ plan, analysis, aiConfigured: isGeminiConfigured() });
}
