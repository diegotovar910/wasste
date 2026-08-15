import { CATEGORY_LABELS, DISTRIBUTION_KEY } from '../config/wasteCategories.js';
import { notFound } from '../utils/errors.js';
import { round } from '../utils/impact.js';
import {
  GeminiUnavailableError,
  generateRouteAnalysis,
  generateSustainabilityAnalysis,
  isGeminiConfigured,
} from './geminiService.js';
import { DEFAULT_PERIOD_DAYS } from './analyticsService.js';
import {
  calculateEstimatedImpact,
  compareWithCity,
  getBinData,
  getCategoryTrend,
  getCityOverview,
  getFillLevels,
  getRecentWasteEvents,
  getWasteStatistics,
} from './agentTools.js';

/**
 * The Wasste sustainability agent (sections 15, 16, 17 and 32).
 *
 *   OBSERVE   - call backend tools to gather real measured data
 *   REASON    - hand that briefing to Gemini for interpretation
 *   RECOMMEND - return actions plus impact numbers the backend computed
 *
 * Impact figures are never taken from the model. They are calculated
 * deterministically here and only shown to Gemini as context, so the AI can
 * explain the numbers but cannot invent them (section 18).
 */

const LABEL_BY_KEY = Object.fromEntries(
  Object.entries(DISTRIBUTION_KEY).map(([category, key]) => [key, CATEGORY_LABELS[category]]),
);

export async function analyseBin(binId, { days = DEFAULT_PERIOD_DAYS } = {}) {
  const bin = await getBinData(binId);
  if (!bin) throw notFound('That Wasste bin does not exist.');

  const [recentEvents, statistics, trend, comparison] = await Promise.all([
    getRecentWasteEvents(binId, 20),
    getWasteStatistics({ binId, days }),
    getCategoryTrend({ binId, days }),
    compareWithCity(bin.wasteDistributionPct),
  ]);

  const impact = calculateEstimatedImpact(bin.wasteByCategoryKg, days);

  const observation = {
    scope: 'SINGLE_BIN',
    bin: {
      name: bin.name,
      address: bin.address,
      status: bin.status,
      fillPercentage: bin.fillPercentage,
      capacityKg: bin.capacityKg,
      totalWasteKg: bin.totalWasteKg,
    },
    wasteByCategoryKg: bin.wasteByCategoryKg,
    wasteDistributionPct: bin.wasteDistributionPct,
    itemsPerCategory: bin.eventCounts,
    itemsClassifiedInPeriod: statistics.counts,
    periodDays: days,
    trend,
    comparisonWithCityAverage: comparison,
    recentItems: recentEvents.slice(0, 10).map((event) => `${event.item} (${event.category})`),
    calculatedImpact: impact,
    itemsClassified: Object.values(bin.eventCounts || {}).reduce((sum, value) => sum + value, 0),
  };

  const reasoning = await reason(observation, () => binHeuristics(observation));

  return {
    scope: 'BIN',
    binId,
    binName: bin.name,
    generatedAt: new Date().toISOString(),
    periodDays: days,
    ...reasoning,
    measured: impact.measured,
    estimatedImpact: {
      wasteAvoidedKgPerMonth: impact.estimated.wasteAvoidableKgPerMonth,
      landfillDiversionKgPerMonth: impact.estimated.landfillDiversionKgPerMonth,
      estimatedCO2AvoidedKgPerMonth: impact.estimated.co2AvoidedKgPerMonth,
    },
    observation,
  };
}

export async function analyseCity({ days = DEFAULT_PERIOD_DAYS } = {}) {
  const [overview, fillLevels, statistics, trend, recentEvents] = await Promise.all([
    getCityOverview({ days }),
    getFillLevels(),
    getWasteStatistics({ days }),
    getCategoryTrend({ days }),
    getRecentWasteEvents(null, 20),
  ]);

  const observation = {
    scope: 'CITY',
    binCount: overview.binCount,
    binsNeedingCollection: overview.binsNeedingCollection,
    averageFillPercentage: overview.averageFillPercentage,
    wasteByCategoryKg: overview.distributionKg,
    wasteDistributionPct: overview.distributionPct,
    itemsPerCategory: statistics.counts,
    periodDays: days,
    trend,
    collectionQueue: fillLevels.slice(0, 5).map((bin) => ({
      name: bin.name,
      fillPercentage: bin.fillPercentage,
      status: bin.status,
    })),
    recentItems: recentEvents.slice(0, 10).map((event) => `${event.item} (${event.category})`),
    calculatedImpact: { measured: overview.measured, estimated: overview.estimated },
    itemsClassified: overview.totalEvents,
  };

  const reasoning = await reason(observation, () => cityHeuristics(observation, fillLevels));

  return {
    scope: 'CITY',
    generatedAt: new Date().toISOString(),
    periodDays: days,
    ...reasoning,
    measured: overview.measured,
    estimatedImpact: {
      wasteAvoidedKgPerMonth: overview.estimated.wasteAvoidableKgPerMonth,
      landfillDiversionKgPerMonth: overview.estimated.landfillDiversionKgPerMonth,
      estimatedCO2AvoidedKgPerMonth: overview.estimated.co2AvoidedKgPerMonth,
    },
    collectionPriority: fillLevels.slice(0, 3),
    observation,
  };
}

/**
 * Route briefing. The plan itself is solved by routeService; the agent only
 * explains the plan it was handed and flags operational risk.
 */
export async function analyseRoute(plan) {
  const observation = {
    scope: 'COLLECTION_ROUTE',
    depot: plan.depot.name,
    fillThresholdPct: plan.fillThreshold,
    stops: plan.stops.map((stop) => ({
      order: stop.order,
      name: stop.name,
      fillPercentage: stop.fillPercentage,
      status: stop.status,
      reason: stop.reasonLabel,
      loadKg: stop.loadKg,
      legDistanceKm: stop.legDistanceKm,
      etaMinutes: stop.etaMinutes,
    })),
    skippedBins: plan.skipped.map((bin) => ({
      name: bin.name,
      fillPercentage: bin.fillPercentage,
      daysUntilFull: bin.daysUntilFull,
    })),
    routeCost: plan.optimised,
    fixedRoundCost: plan.baseline,
    savingsVsFixedRound: plan.savings,
    monthlyProjection: plan.monthlyProjection,
    assumptions: plan.assumptions,
  };

  const reasoning = await reason(observation, () => routeHeuristics(plan), generateRouteAnalysis, (raw, fallback) =>
    validateRouteAnalysis(raw, fallback),
  );

  return {
    scope: 'ROUTE',
    generatedAt: new Date().toISOString(),
    ...reasoning,
    observation,
  };
}

/** Calls Gemini, falling back to deterministic rules if it is unavailable. */
async function reason(
  observation,
  fallback,
  generate = generateSustainabilityAnalysis,
  validate = validateAnalysis,
) {
  if (!isGeminiConfigured()) {
    return { ...fallback(), source: 'RULES', notice: 'Generated by built-in rules - no Gemini API key is configured.' };
  }

  try {
    const raw = await generate(observation);
    return { ...validate(raw, fallback), source: 'GEMINI', notice: null };
  } catch (error) {
    if (error instanceof GeminiUnavailableError) {
      console.error('[gemini] sustainability analysis failed:', error.message);
      return {
        ...fallback(),
        source: 'RULES',
        notice: 'AI analysis is temporarily unavailable, so these are rule-based findings.',
      };
    }
    throw error;
  }
}

const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];

/** Never trust the shape of a model response (section 7). */
function validateAnalysis(raw, fallback) {
  const backup = fallback();

  const recommendations = Array.isArray(raw?.recommendations)
    ? raw.recommendations
        .filter((item) => item && typeof item.title === 'string' && typeof item.description === 'string')
        .slice(0, 4)
        .map((item) => ({
          title: item.title.trim().slice(0, 120),
          description: item.description.trim().slice(0, 600),
          priority: PRIORITIES.includes(String(item.priority).toUpperCase())
            ? String(item.priority).toUpperCase()
            : 'MEDIUM',
        }))
    : [];

  const resourceRecovery = Array.isArray(raw?.resourceRecovery)
    ? raw.resourceRecovery.filter((entry) => typeof entry === 'string').slice(0, 5).map((entry) => entry.trim().slice(0, 300))
    : [];

  return {
    // Generous caps: these only exist to stop a runaway response, not to edit
    // one. Cutting at 300 chars truncated real answers mid-sentence.
    summary: text(raw?.summary, backup.summary, 1000),
    keyFinding: text(raw?.keyFinding, backup.keyFinding, 700),
    recommendations: recommendations.length ? recommendations : backup.recommendations,
    resourceRecovery: resourceRecovery.length ? resourceRecovery : backup.resourceRecovery,
  };
}

/** Same defensive treatment for the route briefing's own shape. */
function validateRouteAnalysis(raw, fallback) {
  const backup = fallback();

  const recommendations = Array.isArray(raw?.recommendations)
    ? raw.recommendations
        .filter((item) => item && typeof item.title === 'string' && typeof item.description === 'string')
        .slice(0, 4)
        .map((item) => ({
          title: item.title.trim().slice(0, 120),
          description: item.description.trim().slice(0, 600),
          priority: PRIORITIES.includes(String(item.priority).toUpperCase())
            ? String(item.priority).toUpperCase()
            : 'MEDIUM',
        }))
    : [];

  const risks = Array.isArray(raw?.risks)
    ? raw.risks.filter((entry) => typeof entry === 'string').slice(0, 5).map((entry) => entry.trim().slice(0, 300))
    : [];

  return {
    summary: text(raw?.summary, backup.summary, 1000),
    sequenceRationale: text(raw?.sequenceRationale, backup.sequenceRationale, 900),
    recommendations: recommendations.length ? recommendations : backup.recommendations,
    risks: risks.length ? risks : backup.risks,
  };
}

const text = (value, fallbackValue, max) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallbackValue;

/* ------------------------------------------------------------------ */
/* Deterministic fallbacks - the system stays useful without the model */
/* ------------------------------------------------------------------ */

const dominantStream = (distributionPct) =>
  Object.entries(distributionPct).sort((a, b) => b[1] - a[1])[0] || ['landfill', 0];

const fastestGrowing = (changePct) =>
  Object.entries(changePct)
    .filter(([, value]) => typeof value === 'number')
    .sort((a, b) => b[1] - a[1])[0];

function binHeuristics(observation) {
  const { bin, wasteDistributionPct, trend, calculatedImpact, comparisonWithCityAverage } = observation;
  const [topKey, topPct] = dominantStream(wasteDistributionPct);
  const growing = fastestGrowing(trend.changePct);
  const diversion = calculatedImpact.measured.diversionRatePct;

  const recommendations = [];

  if (bin.fillPercentage >= 70) {
    recommendations.push({
      title: 'Schedule collection for this bin',
      description: `${bin.name} is ${bin.fillPercentage}% full and marked ${bin.status.replace('_', ' ').toLowerCase()}. Empty it before it stops accepting waste.`,
      priority: bin.fillPercentage >= 90 ? 'HIGH' : 'MEDIUM',
    });
  }

  if (growing && growing[1] > 15) {
    recommendations.push({
      title: `Respond to rising ${LABEL_BY_KEY[growing[0]].toLowerCase()} volume`,
      description: `${LABEL_BY_KEY[growing[0]]} grew about ${growing[1]}% between the first and second half of the last ${trend.windowDays} days at this location.`,
      priority: 'MEDIUM',
    });
  }

  if (wasteDistributionPct.landfill > 30) {
    recommendations.push({
      title: 'Reduce landfill contamination at this location',
      description: `${wasteDistributionPct.landfill}% of what this bin receives is landfill waste. Clearer signage and a nearby organics option are the cheapest interventions.`,
      priority: 'HIGH',
    });
  }

  if (wasteDistributionPct.recyclableContainers >= 30) {
    recommendations.push({
      title: 'Promote reusable containers nearby',
      description: `Containers make up ${wasteDistributionPct.recyclableContainers}% of this bin's volume, which usually means single-use drink and takeaway packaging from nearby vendors.`,
      priority: 'MEDIUM',
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      title: 'Maintain the current collection schedule',
      description: `This bin is behaving normally at ${bin.fillPercentage}% full with a ${diversion}% diversion rate. No intervention is needed this week.`,
      priority: 'LOW',
    });
  }

  const delta = comparisonWithCityAverage?.deltaVsCityPct?.[topKey];
  const comparisonSentence =
    typeof delta === 'number' && Math.abs(delta) >= 3
      ? ` That is ${Math.abs(delta)} percentage points ${delta > 0 ? 'above' : 'below'} the city average.`
      : '';

  return {
    summary: `${bin.name} has collected ${bin.totalWasteKg} kg across ${observation.itemsClassified} classified items and is currently ${bin.fillPercentage}% full. ${LABEL_BY_KEY[topKey]} is the largest stream at ${topPct}%.${comparisonSentence}`,
    keyFinding: `${diversion}% of the waste at this bin is being diverted from landfill.`,
    recommendations: recommendations.slice(0, 4),
    resourceRecovery: resourceRecoveryFor(observation.wasteByCategoryKg),
  };
}

function cityHeuristics(observation, fillLevels) {
  const [topKey, topPct] = dominantStream(observation.wasteDistributionPct);
  const growing = fastestGrowing(observation.trend.changePct);
  const fullest = fillLevels[0];
  const diversion = observation.calculatedImpact.measured.diversionRatePct;

  const recommendations = [];

  if (observation.binsNeedingCollection > 0) {
    recommendations.push({
      title: 'Prioritise the fullest bins on the next route',
      description: `${observation.binsNeedingCollection} of ${observation.binCount} bins are at or above 70% capacity${fullest ? `, starting with ${fullest.name} at ${fullest.fillPercentage}%` : ''}. Collecting by fill level instead of a fixed loop cuts unnecessary trips.`,
      priority: 'HIGH',
    });
  }

  if (growing && growing[1] > 15) {
    recommendations.push({
      title: `Plan for growing ${LABEL_BY_KEY[growing[0]].toLowerCase()} volume`,
      description: `Across the network, ${LABEL_BY_KEY[growing[0]].toLowerCase()} rose roughly ${growing[1]}% in the second half of the last ${observation.trend.windowDays} days.`,
      priority: 'MEDIUM',
    });
  }

  if (observation.wasteDistributionPct.landfill > 25) {
    recommendations.push({
      title: 'Target landfill share with signage and outreach',
      description: `${observation.wasteDistributionPct.landfill}% of city-wide volume still goes to landfill. Bins with the highest landfill share are the best place to test new signage.`,
      priority: 'HIGH',
    });
  }

  recommendations.push({
    title: 'Expand organics capture',
    description: `Organics are ${observation.wasteDistributionPct.organics}% of collected volume. Every additional kilogram composted avoids landfill methane and returns nutrients to soil.`,
    priority: 'MEDIUM',
  });

  return {
    summary: `The network of ${observation.binCount} Wasste bins has collected ${observation.calculatedImpact.measured.totalWasteKg} kg from ${observation.itemsClassified} classified items, diverting ${diversion}% from landfill. ${LABEL_BY_KEY[topKey]} is the largest stream at ${topPct}%.`,
    keyFinding: `${observation.binsNeedingCollection} bins need collection and average fill across the city is ${observation.averageFillPercentage}%.`,
    recommendations: recommendations.slice(0, 4),
    resourceRecovery: resourceRecoveryFor(observation.wasteByCategoryKg),
  };
}

function routeHeuristics(plan) {
  const { stops, skipped, optimised, baseline, savings, monthlyProjection } = plan;

  const recommendations = [];
  const risks = [];

  if (!stops.length) {
    return {
      summary: `No bin is at or above ${plan.fillThreshold}% yet, so no round is needed today. A fixed round would have driven ${baseline.distanceKm} km to empty bins that are not full.`,
      sequenceRationale: 'There is nothing to sequence.',
      recommendations: [
        {
          title: 'Skip today’s round',
          description: `Every bin is below the ${plan.fillThreshold}% threshold. Re-check tomorrow, or lower the threshold if you want to collect earlier.`,
          priority: 'LOW',
        },
      ],
      risks: [],
    };
  }

  const first = stops[0];
  const fullest = [...stops].sort((a, b) => b.fillPercentage - a.fillPercentage)[0];
  const noSensor = stops.filter((stop) => stop.reason === 'NO_SENSOR_DATA');
  const soon = skipped.filter((bin) => typeof bin.daysUntilFull === 'number' && bin.daysUntilFull <= 2);

  recommendations.push({
    title: `Run the ${optimised.stopCount}-stop round as sequenced`,
    description: `${optimised.distanceKm} km and about ${Math.round(optimised.totalMinutes / 60 * 10) / 10} hours, collecting roughly ${optimised.collectedKg} kg. That is ${savings.distanceKm} km and ${savings.minutes} minutes less than driving the full fixed round.`,
    priority: 'HIGH',
  });

  if (fullest.fillPercentage >= 90) {
    recommendations.push({
      title: `Do not let ${fullest.name} slip to tomorrow`,
      description: `It is at ${fullest.fillPercentage}% and will start rejecting waste. It is stop ${fullest.order} on this round, about ${fullest.etaMinutes} minutes in.`,
      priority: 'HIGH',
    });
  }

  if (soon.length) {
    recommendations.push({
      title: 'Watch the bins skipped today',
      description: `${soon.map((bin) => `${bin.name} (${bin.fillPercentage}%, full in about ${bin.daysUntilFull} days)`).join('; ')}. Expect them on tomorrow's round.`,
      priority: 'MEDIUM',
    });
  }

  if (noSensor.length) {
    risks.push(
      `${noSensor.map((stop) => stop.name).join(', ')} has no sensor reading, so its level is unknown. It is on the round as a precaution and the load estimate for it may be wrong.`,
    );
  }

  if (optimised.totalMinutes > 480) {
    risks.push(`The round is about ${Math.round(optimised.totalMinutes / 60)} hours, which exceeds a standard eight-hour shift.`);
  }

  risks.push(
    'Distances are straight-line with a 1.35 road factor, not a routed street network, so real driving time will differ.',
  );

  return {
    summary: `${optimised.stopCount} of ${baseline.stopCount} bins have earned a stop today, covering ${optimised.distanceKm} km in about ${optimised.totalMinutes} minutes and collecting roughly ${optimised.collectedKg} kg. Skipping the ${savings.stopsAvoided} bins that are not full saves ${savings.distanceKm} km, ${savings.minutes} minutes and ${savings.co2Kg} kg of CO₂ against a fixed round, or about ${monthlyProjection.co2KgSaved} kg of CO₂ a month.`,
    sequenceRationale: `The round leaves the depot for ${first.name} first because it is the closest stop at ${first.legDistanceKm} km, then follows a nearest-neighbour order improved by a 2-opt pass to remove crossings. ${fullest.name} at ${fullest.fillPercentage}% is the most urgent bin on the list.`,
    recommendations: recommendations.slice(0, 4),
    risks: risks.slice(0, 5),
  };
}

function resourceRecoveryFor(wasteByCategoryKg = {}) {
  const entries = [];

  if (wasteByCategoryKg.recyclableContainers > 0) {
    entries.push(
      `${round(wasteByCategoryKg.recyclableContainers)} kg of containers - aluminium and PET have the highest resale value of anything in this stream and can go straight to a materials recovery facility.`,
    );
  }
  if (wasteByCategoryKg.organics > 0) {
    entries.push(
      `${round(wasteByCategoryKg.organics)} kg of organics - suitable for municipal composting or anaerobic digestion for biogas.`,
    );
  }
  if (wasteByCategoryKg.paper > 0) {
    entries.push(`${round(wasteByCategoryKg.paper)} kg of paper and cardboard - clean fibre is directly recyclable.`);
  }

  return entries.length ? entries : ['Not enough material has been collected yet to identify recovery opportunities.'];
}
