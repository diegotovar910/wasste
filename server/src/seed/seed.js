import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { SmartBin, statusFromFill } from '../models/SmartBin.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { DISTRIBUTION_KEY } from '../config/wasteCategories.js';
import { estimateWeightKg } from '../utils/weight.js';
import { emptyDistribution, round } from '../utils/impact.js';

/**
 * Seeds a month of plausible Toronto data so the dashboard is populated the
 * moment the demo starts (section 38).
 *
 * Bin totals are derived from the generated events, never written by hand, so
 * every chart in the app reconciles with the underlying event log.
 */

const PERIOD_DAYS = 30;

/** Items the vision model realistically returns, per category. */
const ITEMS = {
  LANDFILL: [
    'coffee cup',
    'plastic wrapper',
    'styrofoam container',
    'chip bag',
    'plastic straw',
    'used napkin',
    'disposable cutlery',
    'contaminated takeout container',
    'mixed waste bag',
    'pet waste bag',
  ],
  PAPER: ['cardboard box', 'newspaper', 'paper bag', 'magazine', 'paper sleeve', 'flyer'],
  RECYCLABLE_CONTAINER: ['plastic bottle', 'aluminium can', 'glass bottle', 'plastic container', 'juice can', 'water bottle'],
  ORGANICS: ['apple core', 'banana peel', 'food scraps', 'coffee grounds', 'orange peel', 'tea bag'],
};

/**
 * Each bin has a character: a street of cafes produces different waste from a
 * market. `mix` is the probability of each category, `trend` nudges a stream up
 * over the month so the agent has a real pattern to find.
 */
const BIN_BLUEPRINTS = [
  {
    code: 'WB-01',
    name: 'Wasste Bin #01 - Yonge Street',
    location: { latitude: 43.7615, longitude: -79.4111, address: 'Yonge Street, Toronto', neighbourhood: 'Midtown' },
    capacityKg: 60,
    fillPercentage: 72,
    eventsPerDay: [70, 110],
    mix: { LANDFILL: 0.25, PAPER: 0.2, RECYCLABLE_CONTAINER: 0.35, ORGANICS: 0.2 },
    trend: { category: 'RECYCLABLE_CONTAINER', growth: 0.5 },
  },
  {
    code: 'WB-02',
    name: 'Wasste Bin #02 - Queen Street West',
    location: { latitude: 43.6468, longitude: -79.4009, address: 'Queen Street West, Toronto', neighbourhood: 'West End' },
    capacityKg: 60,
    fillPercentage: 58,
    eventsPerDay: [60, 96],
    mix: { LANDFILL: 0.28, PAPER: 0.22, RECYCLABLE_CONTAINER: 0.3, ORGANICS: 0.2 },
    trend: { category: 'ORGANICS', growth: 0.25 },
  },
  {
    code: 'WB-03',
    name: 'Wasste Bin #03 - Yonge-Dundas Square',
    location: { latitude: 43.6561, longitude: -79.3802, address: 'Dundas Street East, Toronto', neighbourhood: 'Downtown' },
    capacityKg: 72,
    fillPercentage: 93,
    eventsPerDay: [100, 150],
    mix: { LANDFILL: 0.34, PAPER: 0.16, RECYCLABLE_CONTAINER: 0.34, ORGANICS: 0.16 },
    trend: { category: 'LANDFILL', growth: 0.35 },
  },
  {
    code: 'WB-04',
    name: 'Wasste Bin #04 - Bloor Street',
    location: { latitude: 43.6689, longitude: -79.3957, address: 'Bloor Street West, Toronto', neighbourhood: 'Yorkville' },
    capacityKg: 60,
    fillPercentage: 41,
    eventsPerDay: [44, 74],
    mix: { LANDFILL: 0.22, PAPER: 0.3, RECYCLABLE_CONTAINER: 0.28, ORGANICS: 0.2 },
    trend: { category: 'PAPER', growth: 0.2 },
  },
  {
    code: 'WB-05',
    name: 'Wasste Bin #05 - King Street West',
    location: { latitude: 43.6447, longitude: -79.3968, address: 'King Street West, Toronto', neighbourhood: 'Entertainment District' },
    capacityKg: 66,
    fillPercentage: 77,
    eventsPerDay: [76, 120],
    mix: { LANDFILL: 0.26, PAPER: 0.18, RECYCLABLE_CONTAINER: 0.36, ORGANICS: 0.2 },
    trend: { category: 'RECYCLABLE_CONTAINER', growth: 0.4 },
  },
  {
    code: 'WB-06',
    name: 'Wasste Bin #06 - Kensington Market',
    location: { latitude: 43.6547, longitude: -79.4005, address: 'Augusta Avenue, Toronto', neighbourhood: 'Kensington' },
    capacityKg: 54,
    fillPercentage: 64,
    eventsPerDay: [56, 92],
    mix: { LANDFILL: 0.18, PAPER: 0.18, RECYCLABLE_CONTAINER: 0.24, ORGANICS: 0.4 },
    trend: { category: 'ORGANICS', growth: 0.3 },
  },
  {
    code: 'WB-07',
    name: 'Wasste Bin #07 - Harbourfront',
    location: { latitude: 43.6389, longitude: -79.3817, address: 'Queens Quay West, Toronto', neighbourhood: 'Waterfront' },
    capacityKg: 60,
    fillPercentage: 35,
    offline: true,
    eventsPerDay: [30, 58],
    mix: { LANDFILL: 0.3, PAPER: 0.18, RECYCLABLE_CONTAINER: 0.32, ORGANICS: 0.2 },
  },
  {
    code: 'WB-08',
    name: 'Wasste Bin #08 - St. Lawrence Market',
    location: { latitude: 43.6487, longitude: -79.3716, address: 'Front Street East, Toronto', neighbourhood: 'Old Town' },
    capacityKg: 66,
    fillPercentage: 83,
    eventsPerDay: [64, 104],
    mix: { LANDFILL: 0.2, PAPER: 0.2, RECYCLABLE_CONTAINER: 0.22, ORGANICS: 0.38 },
    trend: { category: 'ORGANICS', growth: 0.35 },
  },
];

const randomBetween = (min, max) => min + Math.random() * (max - min);
const randomInt = (min, max) => Math.floor(randomBetween(min, max + 1));
const pick = (list) => list[randomInt(0, list.length - 1)];

/** Picks a category using the bin's mix, with the trend ramping over the month. */
function pickCategory(mix, trend, dayProgress) {
  const weights = { ...mix };

  if (trend) {
    weights[trend.category] *= 1 + trend.growth * dayProgress;
  }

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  let roll = Math.random() * total;

  for (const [category, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return category;
  }

  return 'LANDFILL';
}

/** Public bins get used during the day, with a lunchtime peak. */
const HOUR_WEIGHTS = [0, 0, 0, 0, 0, 1, 2, 4, 6, 7, 8, 10, 12, 10, 8, 8, 9, 9, 7, 5, 4, 3, 2, 1];

const sumWeights = (upToHour = 23) =>
  HOUR_WEIGHTS.slice(0, upToHour + 1).reduce((sum, value) => sum + value, 0);

/**
 * Picks a plausible time of day. `maxHour` caps it so that today's events
 * never land in the future - a bin cannot have already received waste that
 * has not happened yet.
 */
function timeOfDay(date, maxHour = 23) {
  const weights = HOUR_WEIGHTS.slice(0, maxHour + 1);
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return new Date(date);

  let roll = Math.random() * total;
  let hour = 0;

  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      hour = i;
      break;
    }
  }

  const stamped = new Date(date);
  const isCurrentHour = hour === maxHour && maxHour < 23;
  stamped.setHours(hour, isCurrentHour ? randomInt(0, new Date().getMinutes()) : randomInt(0, 59), randomInt(0, 59), 0);
  return stamped;
}

function buildEventsForBin(bin, blueprint) {
  const events = [];
  const distribution = emptyDistribution();
  const counts = emptyDistribution();

  for (let dayOffset = PERIOD_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - dayOffset);

    const dayProgress = (PERIOD_DAYS - 1 - dayOffset) / (PERIOD_DAYS - 1);
    const isWeekend = [0, 6].includes(day.getDay());
    const [minEvents, maxEvents] = blueprint.eventsPerDay;

    // Today is only partly over, so it gets the share of the daily footfall
    // curve that has actually elapsed rather than a full day's volume.
    const isToday = dayOffset === 0;
    const maxHour = isToday ? new Date().getHours() : 23;
    const dayFraction = isToday ? sumWeights(maxHour) / sumWeights() : 1;

    const eventCount = Math.round(
      randomInt(minEvents, maxEvents) * (isWeekend ? 0.75 : 1) * dayFraction,
    );

    for (let i = 0; i < eventCount; i += 1) {
      const category = pickCategory(blueprint.mix, blueprint.trend, dayProgress);
      const item = pick(ITEMS[category]);
      const estimatedWeightKg = round(estimateWeightKg(item, category) * randomBetween(0.8, 1.3), 3);

      events.push({
        smartBinId: bin._id,
        category,
        item,
        confidence: round(randomBetween(0.72, 0.98)),
        estimatedWeightKg,
        reason: `Seeded demo event: ${item} routed to the ${category.toLowerCase().replace(/_/g, ' ')} sub-bin.`,
        source: 'SEED',
        needsReview: false,
        createdAt: timeOfDay(day, maxHour),
      });

      const key = DISTRIBUTION_KEY[category];
      distribution[key] = round(distribution[key] + estimatedWeightKg);
      counts[key] += 1;
    }
  }

  return { events, distribution, counts };
}

/**
 * Works out when the bin was last emptied so that "what is in the bin now"
 * really is the sum of the events since then. Without this the fill level
 * would be a decorative number that contradicts the event log.
 */
function deriveCurrentLoad(events, capacityKg, targetFillPercentage) {
  const targetKg = (targetFillPercentage / 100) * capacityKg;
  const newestFirst = [...events].sort((a, b) => b.createdAt - a.createdAt);

  let accumulated = 0;
  let lastCollectedAt = newestFirst.length
    ? newestFirst[newestFirst.length - 1].createdAt
    : new Date();

  for (const event of newestFirst) {
    if (accumulated + event.estimatedWeightKg > targetKg) {
      lastCollectedAt = event.createdAt;
      break;
    }
    accumulated += event.estimatedWeightKg;
    lastCollectedAt = event.createdAt;
  }

  return {
    estimatedWeightKg: round(accumulated),
    fillPercentage: round(Math.min(100, (accumulated / capacityKg) * 100), 1),
    lastCollectedAt,
  };
}

async function seed() {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log('[seed] connected to MongoDB');

  await Promise.all([SmartBin.deleteMany({}), WasteEvent.deleteMany({})]);
  console.log('[seed] cleared existing bins and waste events');

  let totalEvents = 0;

  for (const blueprint of BIN_BLUEPRINTS) {
    const bin = new SmartBin({
      code: blueprint.code,
      name: blueprint.name,
      location: blueprint.location,
      capacityKg: blueprint.capacityKg,
    });

    const { events, distribution, counts } = buildEventsForBin(bin, blueprint);
    const load = deriveCurrentLoad(events, blueprint.capacityKg, blueprint.fillPercentage);

    // Lifetime collected weight is the whole event log; what is in the bin now
    // is only what has arrived since the last collection round.
    bin.wasteByCategoryKg = distribution;
    bin.eventCounts = counts;
    bin.currentFillPercentage = load.fillPercentage;
    bin.lastCollectedAt = load.lastCollectedAt;
    bin.sensors = {
      lastReadingAt: blueprint.offline
        ? new Date(Date.now() - 26 * 60 * 60 * 1000)
        : new Date(Date.now() - randomInt(2, 45) * 60 * 1000),
      estimatedWeightKg: load.estimatedWeightKg,
      temperatureC: round(randomBetween(14, 24), 1),
      source: 'SIMULATED',
    };
    bin.status = blueprint.offline ? 'OFFLINE' : statusFromFill(load.fillPercentage);
    bin.lastUpdated = bin.sensors.lastReadingAt;

    await bin.save();
    await WasteEvent.insertMany(events);

    totalEvents += events.length;
    const lifetimeKg = round(Object.values(distribution).reduce((sum, value) => sum + value, 0));
    console.log(
      `[seed] ${bin.code}  ${String(events.length).padStart(5)} events  ${String(lifetimeKg).padStart(7)} kg collected  ` +
        `${String(load.estimatedWeightKg).padStart(6)} kg in bin (${load.fillPercentage}%)  ${bin.status}`,
    );
  }

  console.log(`\n[seed] done: ${BIN_BLUEPRINTS.length} bins, ${totalEvents} waste events over ${PERIOD_DAYS} days.`);
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('[seed] failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
