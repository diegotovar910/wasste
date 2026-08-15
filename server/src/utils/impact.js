import { CATEGORIES, DISTRIBUTION_KEY, DIVERTED_CATEGORIES } from '../config/wasteCategories.js';

/**
 * Section 18: the backend owns the arithmetic, Gemini owns the reasoning.
 * Every coefficient below is an openly stated, order-of-magnitude planning
 * assumption - not a measurement. The API ships these numbers to the client so
 * the UI can show exactly how an estimate was produced.
 */
export const IMPACT_ASSUMPTIONS = {
  co2AvoidedKgPerKgDiverted: {
    // Approximate life-cycle emissions avoided by recycling/composting one kg
    // instead of landfilling it. Rounded planning figures.
    paper: 1.1,
    recyclableContainers: 1.5,
    organics: 0.5,
    landfill: 0,
  },
  // Share of each stream that a reuse programme could plausibly avoid in the
  // first place (reusable cups, refill stations, packaging reduction).
  avoidableShare: {
    paper: 0.1,
    recyclableContainers: 0.25,
    organics: 0.15,
    landfill: 0.05,
  },
  notes: [
    'CO2 factors are rounded life-cycle planning estimates, not measured values.',
    'Avoidable share models a reuse/refill programme; it is a projection, not observed data.',
  ],
};

export const emptyDistribution = () => ({
  landfill: 0,
  paper: 0,
  recyclableContainers: 0,
  organics: 0,
});

/**
 * Copies a distribution field by field.
 *
 * Object spread does NOT work here: these values often arrive as Mongoose
 * subdocuments, whose schema paths live behind getters rather than own
 * properties, so `{ ...subdoc }` silently produces zeros.
 */
export function toPlainDistribution(byCategoryKg = {}) {
  const distribution = emptyDistribution();
  for (const key of Object.values(DISTRIBUTION_KEY)) {
    distribution[key] = Number(byCategoryKg?.[key]) || 0;
  }
  return distribution;
}

export const sumDistribution = (byCategoryKg = {}) =>
  round(Object.values(DISTRIBUTION_KEY).reduce((total, key) => total + (byCategoryKg[key] || 0), 0));

export function addDistributions(a = {}, b = {}) {
  const result = emptyDistribution();
  for (const key of Object.values(DISTRIBUTION_KEY)) {
    result[key] = round((a[key] || 0) + (b[key] || 0));
  }
  return result;
}

/** Percentage split of a kg distribution, rounded so the parts still total 100. */
export function toPercentages(byCategoryKg = {}) {
  const keys = Object.values(DISTRIBUTION_KEY);
  const total = sumDistribution(byCategoryKg);
  if (total <= 0) return emptyDistribution();

  const exact = keys.map((key) => ({ key, value: ((byCategoryKg[key] || 0) / total) * 100 }));
  const result = emptyDistribution();
  for (const { key, value } of exact) result[key] = Math.floor(value);

  // Hand the rounding remainder to the largest fractional parts.
  let remainder = 100 - keys.reduce((sum, key) => sum + result[key], 0);
  const byFraction = [...exact].sort(
    (a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)),
  );
  for (let i = 0; remainder > 0 && i < byFraction.length; i += 1, remainder -= 1) {
    result[byFraction[i].key] += 1;
  }

  return result;
}

/**
 * Turns a kg distribution into the metric set the dashboards display.
 * `measured` is derived only from recorded waste events; `estimated` is
 * explicitly modelled and labelled as such in the UI (section 19).
 */
export function computeImpact(byCategoryKg = {}, { periodDays = 30 } = {}) {
  const distribution = toPlainDistribution(byCategoryKg);
  const totalWasteKg = sumDistribution(distribution);

  const landfillDivertedKg = round(
    DIVERTED_CATEGORIES.reduce((sum, category) => sum + (distribution[DISTRIBUTION_KEY[category]] || 0), 0),
  );

  const co2 = IMPACT_ASSUMPTIONS.co2AvoidedKgPerKgDiverted;
  const co2AvoidedKg = round(
    Object.entries(co2).reduce((sum, [key, factor]) => sum + (distribution[key] || 0) * factor, 0),
  );

  const avoidable = IMPACT_ASSUMPTIONS.avoidableShare;
  const wasteAvoidableKg = round(
    Object.entries(avoidable).reduce((sum, [key, share]) => sum + (distribution[key] || 0) * share, 0),
  );

  const monthlyScale = periodDays > 0 ? 30 / periodDays : 1;

  return {
    measured: {
      totalWasteKg,
      landfillWasteKg: round(distribution.landfill),
      landfillDivertedKg,
      diversionRatePct: totalWasteKg > 0 ? Math.round((landfillDivertedKg / totalWasteKg) * 100) : 0,
      recyclableContainersKg: round(distribution.recyclableContainers),
      paperKg: round(distribution.paper),
      organicsKg: round(distribution.organics),
      periodDays,
    },
    estimated: {
      co2AvoidedKg,
      co2AvoidedKgPerMonth: round(co2AvoidedKg * monthlyScale),
      wasteAvoidableKg,
      wasteAvoidableKgPerMonth: round(wasteAvoidableKg * monthlyScale),
      landfillDiversionKgPerMonth: round(landfillDivertedKg * monthlyScale),
    },
    distributionKg: distribution,
    distributionPct: toPercentages(distribution),
    assumptions: IMPACT_ASSUMPTIONS,
  };
}

/** Groups an array of waste events into a kg distribution. */
export function distributionFromEvents(events = []) {
  const distribution = emptyDistribution();
  for (const event of events) {
    const key = DISTRIBUTION_KEY[event.category];
    if (key) distribution[key] = round(distribution[key] + (event.estimatedWeightKg || 0));
  }
  return distribution;
}

/** Event counts per category, including UNKNOWN which carries no weight. */
export function countsFromEvents(events = []) {
  const counts = { ...emptyDistribution(), unknown: 0 };
  for (const event of events) {
    const key = DISTRIBUTION_KEY[event.category] || 'unknown';
    counts[key] += 1;
  }
  return counts;
}

export const categoryKeys = CATEGORIES.map((category) => DISTRIBUTION_KEY[category]);

export function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
}
