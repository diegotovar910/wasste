import { SmartBin } from '../models/SmartBin.js';
import {
  DEFERRAL_REASONS,
  DEPOT,
  FLEET_ASSUMPTIONS,
  OBJECTIVES,
  OFFLINE_URGENCY,
  ROUTE_DEFAULTS,
  ROUTE_MODES,
  STOP_REASONS,
  VEHICLES,
} from '../config/fleet.js';
import { round, sumDistribution } from '../utils/impact.js';
import { DEFAULT_PERIOD_DAYS } from './analyticsService.js';

/**
 * Collection route planner.
 *
 * There is no AI in this file. Bin selection, sequencing, the constraint
 * trade-offs and every cost figure are solved deterministically here; Gemini
 * only reads the finished plan and explains it.
 */

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(a, b) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Straight-line distance scaled to something a vehicle could actually drive. */
const roadKm = (a, b) => haversineKm(a, b) * FLEET_ASSUMPTIONS.roadDistanceFactor;

/** Total length of depot -> stops in order -> depot. */
function routeDistanceKm(stops) {
  if (!stops.length) return 0;

  let total = roadKm(DEPOT, stops[0]);
  for (let i = 0; i < stops.length - 1; i += 1) {
    total += roadKm(stops[i], stops[i + 1]);
  }
  return total + roadKm(stops[stops.length - 1], DEPOT);
}

/** Greedy first pass: always drive to the closest bin not yet visited. */
function nearestNeighbour(stops) {
  const remaining = [...stops];
  const ordered = [];
  let current = DEPOT;

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;

    remaining.forEach((stop, index) => {
      const distance = roadKm(current, stop);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    current = remaining[bestIndex];
    ordered.push(current);
    remaining.splice(bestIndex, 1);
  }

  return ordered;
}

/**
 * 2-opt improvement: repeatedly reverse a segment when doing so shortens the
 * round. Greedy routes often cross over themselves; this untangles them.
 */
function twoOpt(stops) {
  if (stops.length < 4) return stops;

  let best = [...stops];
  let bestDistance = routeDistanceKm(best);
  let improved = true;
  let passes = 0;

  while (improved && passes < 50) {
    improved = false;
    passes += 1;

    for (let i = 0; i < best.length - 1; i += 1) {
      for (let k = i + 1; k < best.length; k += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        const distance = routeDistanceKm(candidate);

        if (distance < bestDistance - 1e-9) {
          best = candidate;
          bestDistance = distance;
          improved = true;
        }
      }
    }
  }

  return best;
}

const solve = (stops) => twoOpt(nearestNeighbour(stops));

/** Turns an ordered list of stops into distance, time, fuel, cost and emissions. */
function costOfRoute(stops, vehicle) {
  const distanceKm = routeDistanceKm(stops);
  const { co2KgPerLitreDiesel, fuelCostPerLitre } = FLEET_ASSUMPTIONS;

  const driveMinutes = vehicle.averageSpeedKmh > 0 ? (distanceKm / vehicle.averageSpeedKmh) * 60 : 0;
  const serviceMinutes = stops.length * vehicle.serviceMinutesPerStop;
  const fuelLitres =
    distanceKm * vehicle.fuelLitresPerKm + serviceMinutes * vehicle.idleFuelLitresPerMinute;

  return {
    stopCount: stops.length,
    distanceKm: round(distanceKm, 2),
    driveMinutes: Math.round(driveMinutes),
    serviceMinutes: Math.round(serviceMinutes),
    totalMinutes: Math.round(driveMinutes + serviceMinutes),
    fuelLitres: round(fuelLitres, 2),
    co2Kg: round(fuelLitres * co2KgPerLitreDiesel, 2),
    fuelCost: round(fuelLitres * fuelCostPerLitre, 2),
    collectedKg: round(stops.reduce((sum, stop) => sum + (stop.loadKg || 0), 0)),
  };
}

/** How long before this bin fills up at its recent average intake. */
function daysUntilFull(bin, periodDays) {
  const lifetimeKg = sumDistribution(bin.wasteByCategoryKg);
  const kgPerDay = periodDays > 0 ? lifetimeKg / periodDays : 0;
  if (kgPerDay <= 0) return null;

  const remainingKg = Math.max(0, bin.capacityKg - (bin.sensors?.estimatedWeightKg || 0));
  return round(remainingKg / kgPerDay, 1);
}

/**
 * Decides whether a bin belongs on this round, and why.
 * Returns null when it does not qualify, with the reason recorded separately.
 */
function qualify(bin, { mode, fillThreshold, includeOffline, alwaysCollectFull }) {
  const isOffline = bin.status === 'OFFLINE';
  const fill = bin.currentFillPercentage;

  if (mode === 'MAINTENANCE') {
    return isOffline
      ? { reason: 'NO_SENSOR_DATA', urgency: OFFLINE_URGENCY }
      : { deferred: 'SENSOR_ONLINE' };
  }

  if (isOffline) {
    return includeOffline
      ? { reason: 'NO_SENSOR_DATA', urgency: OFFLINE_URGENCY }
      : { deferred: 'SENSOR_ONLINE' };
  }

  if (mode === 'URGENT') {
    return fill >= 90 ? { reason: 'FULL', urgency: fill } : { deferred: 'NOT_URGENT' };
  }

  // Standard collection round.
  if (alwaysCollectFull && fill >= 90) return { reason: 'FULL', urgency: fill };
  if (fill >= fillThreshold) {
    return { reason: fill >= 90 ? 'FULL' : 'NEEDS_ATTENTION', urgency: fill };
  }

  return { deferred: 'BELOW_THRESHOLD' };
}

/**
 * Trims the candidate list until the round fits the shift, the stop limit and
 * the payload. The stop that gets dropped is the least urgent one - or under
 * the DISTANCE objective, the one whose detour buys the least urgency.
 */
function applyConstraints(candidates, vehicle, { maxStops, maxShiftMinutes, payloadKg, objective }) {
  let kept = [...candidates];
  const dropped = [];

  const limitPayload = payloadKg > 0 ? payloadKg : vehicle.payloadKg;

  const violation = (route, cost) => {
    if (maxStops > 0 && route.length > maxStops) return 'MAX_STOPS';
    if (maxShiftMinutes > 0 && cost.totalMinutes > maxShiftMinutes) return 'SHIFT_LIMIT';
    if (limitPayload > 0 && cost.collectedKg > limitPayload) return 'PAYLOAD_LIMIT';
    return null;
  };

  // Re-solve after each drop: removing a stop changes the best sequence.
  let ordered = solve(kept);
  let cost = costOfRoute(ordered, vehicle);
  let guard = 0;

  while (kept.length && guard < 100) {
    const reason = violation(ordered, cost);
    if (!reason) break;
    guard += 1;

    const victim = chooseDropCandidate(ordered, objective);
    kept = kept.filter((stop) => stop.binId !== victim.binId);
    dropped.push({ ...victim, deferralReason: reason });

    ordered = solve(kept);
    cost = costOfRoute(ordered, vehicle);
  }

  return { ordered, cost, dropped };
}

/**
 * Picks the stop to sacrifice.
 *
 * URGENCY keeps the fullest bins no matter the detour. DISTANCE weighs each
 * stop's detour cost against its urgency, so a nearly-empty bin at the far end
 * of the city goes first.
 */
function chooseDropCandidate(ordered, objective) {
  if (objective === OBJECTIVES.URGENCY.id) {
    return [...ordered].sort((a, b) => a.urgency - b.urgency)[0];
  }

  const baseline = routeDistanceKm(ordered);

  const scored = ordered.map((stop) => {
    const without = routeDistanceKm(ordered.filter((other) => other.binId !== stop.binId));
    const detourKm = Math.max(0.01, baseline - without);
    // High detour and low urgency = the worst value on the round.
    return { stop, value: stop.urgency / detourKm };
  });

  return scored.sort((a, b) => a.value - b.value)[0].stop;
}

/** "07:00" + 43 minutes -> "07:43". */
function clockTime(departureTime, minutesFromStart) {
  const [hours, minutes] = String(departureTime).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const total = hours * 60 + minutes + minutesFromStart;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/**
 * Builds a round from the supplied parameters.
 *
 * The baseline it is measured against is the status quo it replaces: a fixed
 * round that visits every bin in the network with the same vehicle.
 */
export async function planCollectionRoute(options = {}) {
  const params = { ...ROUTE_DEFAULTS, ...options };
  const { periodDays = DEFAULT_PERIOD_DAYS } = options;

  const mode = ROUTE_MODES[params.mode] ? params.mode : ROUTE_DEFAULTS.mode;
  const objective = OBJECTIVES[params.objective] ? params.objective : ROUTE_DEFAULTS.objective;
  const vehicle = VEHICLES[ROUTE_MODES[mode].vehicle];

  const bins = await SmartBin.find().sort({ code: 1 });

  const toStop = (bin) => ({
    binId: String(bin._id),
    code: bin.code,
    name: bin.name,
    address: bin.location.address,
    latitude: bin.location.latitude,
    longitude: bin.location.longitude,
    fillPercentage: bin.currentFillPercentage,
    status: bin.status,
    loadKg: round(bin.sensors?.estimatedWeightKg || 0),
    capacityKg: bin.capacityKg,
    lastReadingAt: bin.sensors?.lastReadingAt || null,
    daysUntilFull: daysUntilFull(bin, periodDays),
    needsTechnician: bin.status === 'OFFLINE',
  });

  const candidates = [];
  const notSelected = [];

  for (const bin of bins) {
    const verdict = qualify(bin, { ...params, mode });
    const stop = toStop(bin);

    if (verdict.deferred) {
      notSelected.push({ ...stop, deferralReason: verdict.deferred });
    } else {
      candidates.push({
        ...stop,
        reason: verdict.reason,
        reasonLabel: STOP_REASONS[verdict.reason],
        urgency: verdict.urgency,
      });
    }
  }

  const { ordered, cost, dropped } = applyConstraints(candidates, vehicle, {
    maxStops: params.maxStops,
    maxShiftMinutes: params.maxShiftMinutes,
    payloadKg: params.payloadKg,
    objective,
  });

  // The status quo: every bin, in the fixed order a printed round sheet lists.
  const baseline = costOfRoute(bins.map(toStop), vehicle);
  // The same selected stops in bin-code order, to show what the solver adds.
  const unoptimisedSelected = costOfRoute(
    candidates.filter((stop) => ordered.some((kept) => kept.binId === stop.binId)),
    vehicle,
  );

  let cumulativeKm = 0;
  let cumulativeMinutes = 0;

  const stops = ordered.map((stop, index) => {
    const previous = index === 0 ? DEPOT : ordered[index - 1];
    const legDistanceKm = round(roadKm(previous, stop), 2);

    cumulativeKm += legDistanceKm;
    cumulativeMinutes +=
      (legDistanceKm / vehicle.averageSpeedKmh) * 60 + vehicle.serviceMinutesPerStop;

    return {
      ...stop,
      order: index + 1,
      legDistanceKm,
      cumulativeDistanceKm: round(cumulativeKm, 2),
      etaMinutes: Math.round(cumulativeMinutes),
      etaClock: clockTime(params.departureTime, Math.round(cumulativeMinutes)),
    };
  });

  const returnMinutes = stops.length
    ? Math.round(cumulativeMinutes + (roadKm(ordered[ordered.length - 1], DEPOT) / vehicle.averageSpeedKmh) * 60)
    : 0;

  const savings = {
    distanceKm: round(baseline.distanceKm - cost.distanceKm, 2),
    minutes: baseline.totalMinutes - cost.totalMinutes,
    fuelLitres: round(baseline.fuelLitres - cost.fuelLitres, 2),
    co2Kg: round(baseline.co2Kg - cost.co2Kg, 2),
    fuelCost: round(baseline.fuelCost - cost.fuelCost, 2),
    stopsAvoided: baseline.stopCount - cost.stopCount,
    percentDistance: percentSaved(baseline.distanceKm, cost.distanceKm),
    percentTime: percentSaved(baseline.totalMinutes, cost.totalMinutes),
    percentCo2: percentSaved(baseline.co2Kg, cost.co2Kg),
  };

  const { roundsPerMonth } = FLEET_ASSUMPTIONS;

  return {
    generatedAt: new Date().toISOString(),
    params: {
      mode,
      modeLabel: ROUTE_MODES[mode].label,
      modeDescription: ROUTE_MODES[mode].description,
      objective,
      objectiveLabel: OBJECTIVES[objective].label,
      fillThreshold: params.fillThreshold,
      includeOffline: params.includeOffline,
      alwaysCollectFull: params.alwaysCollectFull,
      maxStops: params.maxStops,
      maxShiftMinutes: params.maxShiftMinutes,
      payloadKg: params.payloadKg,
      departureTime: params.departureTime,
    },
    vehicle: {
      ...vehicle,
      effectivePayloadKg: params.payloadKg > 0 ? params.payloadKg : vehicle.payloadKg,
    },
    depot: DEPOT,
    stops,
    /** Bins that qualified but were cut to satisfy a limit. */
    droppedByConstraint: dropped.map((stop) => ({
      ...stop,
      deferralLabel: DEFERRAL_REASONS[stop.deferralReason],
    })),
    /** Bins that never qualified under these parameters. */
    notSelected: notSelected
      .map((stop) => ({ ...stop, deferralLabel: DEFERRAL_REASONS[stop.deferralReason] }))
      .sort((a, b) => b.fillPercentage - a.fillPercentage),
    technicianStops: stops.filter((stop) => stop.needsTechnician).length,
    optimised: cost,
    baseline,
    unoptimisedSelected,
    solverGain: {
      distanceKm: round(unoptimisedSelected.distanceKm - cost.distanceKm, 2),
      minutes: unoptimisedSelected.totalMinutes - cost.totalMinutes,
    },
    returnToDepotMinutes: returnMinutes,
    returnToDepotClock: clockTime(params.departureTime, returnMinutes),
    savings,
    monthlyProjection: {
      roundsPerMonth,
      hoursSaved: round((savings.minutes * roundsPerMonth) / 60, 1),
      co2KgSaved: round(savings.co2Kg * roundsPerMonth),
      fuelLitresSaved: round(savings.fuelLitres * roundsPerMonth),
      distanceKmSaved: round(savings.distanceKm * roundsPerMonth),
      fuelCostSaved: round(savings.fuelCost * roundsPerMonth),
    },
    assumptions: FLEET_ASSUMPTIONS,
    options: {
      modes: Object.values(ROUTE_MODES),
      objectives: Object.values(OBJECTIVES),
      defaults: ROUTE_DEFAULTS,
    },
  };
}

/**
 * Costs a stop order somebody else proposed - in practice, Gemini's.
 *
 * The proposal is measured with exactly the same distance and cost model as
 * the solver's own route, so the comparison is fair. The AI may reorder the
 * round; it may not add or remove bins, because that would change what is
 * being compared. Anything missing is appended in the solver's order and the
 * result is flagged as repaired.
 */
export function evaluateProposedOrder(plan, proposedCodes = []) {
  const byCode = new Map(plan.stops.map((stop) => [stop.code, stop]));

  const seen = new Set();
  const unknownCodes = [];
  const ordered = [];

  for (const rawCode of proposedCodes) {
    const code = String(rawCode || '').trim().toUpperCase();
    const stop = byCode.get(code);

    if (!stop) {
      if (code) unknownCodes.push(code);
      continue;
    }
    if (seen.has(code)) continue;

    seen.add(code);
    ordered.push(stop);
  }

  // Anything the proposal forgot still has to be visited.
  const missing = plan.stops.filter((stop) => !seen.has(stop.code));
  const repaired = missing.length > 0 || unknownCodes.length > 0;
  const finalOrder = [...ordered, ...missing];

  if (!finalOrder.length) return null;

  const vehicle = plan.vehicle;
  const cost = costOfRoute(finalOrder, vehicle);

  let cumulativeKm = 0;
  let cumulativeMinutes = 0;

  const stops = finalOrder.map((stop, index) => {
    const previous = index === 0 ? DEPOT : finalOrder[index - 1];
    const legDistanceKm = round(roadKm(previous, stop), 2);

    cumulativeKm += legDistanceKm;
    cumulativeMinutes +=
      (legDistanceKm / vehicle.averageSpeedKmh) * 60 + vehicle.serviceMinutesPerStop;

    return {
      binId: stop.binId,
      code: stop.code,
      name: stop.name,
      fillPercentage: stop.fillPercentage,
      order: index + 1,
      legDistanceKm,
      cumulativeDistanceKm: round(cumulativeKm, 2),
      etaClock: clockTime(plan.params.departureTime, Math.round(cumulativeMinutes)),
    };
  });

  const distanceDeltaKm = round(cost.distanceKm - plan.optimised.distanceKm, 2);

  return {
    stops,
    cost,
    repaired,
    unknownCodes,
    missingCodes: missing.map((stop) => stop.code),
    comparison: {
      distanceDeltaKm,
      minutesDelta: cost.totalMinutes - plan.optimised.totalMinutes,
      co2DeltaKg: round(cost.co2Kg - plan.optimised.co2Kg, 2),
      // A tie is genuinely common: a round trip measures the same in reverse.
      verdict:
        Math.abs(distanceDeltaKm) < 0.01
          ? 'EQUAL'
          : distanceDeltaKm < 0
            ? 'AI_SHORTER'
            : 'SOLVER_SHORTER',
    },
  };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, Math.round(value)));

const SETTING_LABELS = {
  mode: 'Round type',
  objective: 'Drop rule',
  fillThreshold: 'Fill threshold',
  includeOffline: 'Visit offline sensors',
  alwaysCollectFull: 'Always collect 90%+',
  maxStops: 'Maximum stops',
  maxShiftMinutes: 'Shift length',
  payloadKg: 'Payload limit',
  departureTime: 'Departure time',
};

/**
 * Cleans up a settings proposal from the model.
 *
 * Unlike the API's own parameter parsing this never throws: a nonsense value
 * from Gemini is dropped, not surfaced as a user-facing error. Anything the
 * model omits keeps the dispatcher's current value.
 */
export function sanitiseRecommendedSettings(raw = {}, current = {}) {
  const proposed = {};

  const takeEnum = (key, allowed) => {
    const value = String(raw?.[key] || '').toUpperCase();
    if (allowed.includes(value)) proposed[key] = value;
  };

  const takeNumber = (key, min, max) => {
    const value = Number(raw?.[key]);
    if (Number.isFinite(value)) proposed[key] = clamp(value, min, max);
  };

  const takeBoolean = (key) => {
    if (typeof raw?.[key] === 'boolean') proposed[key] = raw[key];
  };

  takeEnum('mode', Object.keys(ROUTE_MODES));
  takeEnum('objective', Object.keys(OBJECTIVES));
  takeNumber('fillThreshold', 0, 100);
  takeNumber('maxStops', 0, 50);
  takeNumber('maxShiftMinutes', 0, 1440);
  takeNumber('payloadKg', 0, 20000);
  takeBoolean('includeOffline');
  takeBoolean('alwaysCollectFull');

  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw?.departureTime || ''))) {
    proposed.departureTime = String(raw.departureTime);
  }

  // Only real parameters survive: `current` arrives as plan.params, which also
  // carries display labels that must never be sent back as settings.
  const base = {};
  for (const key of Object.keys(ROUTE_DEFAULTS)) {
    base[key] = current[key] !== undefined ? current[key] : ROUTE_DEFAULTS[key];
  }

  const settings = { ...base, ...proposed };

  // Only report fields that actually differ from what is on screen now.
  const changes = Object.keys(proposed)
    .filter((key) => proposed[key] !== current[key])
    .map((key) => ({
      key,
      label: SETTING_LABELS[key] || key,
      from: current[key],
      to: proposed[key],
    }));

  return { settings, changes };
}

function percentSaved(baselineValue, optimisedValue) {
  if (!baselineValue || baselineValue <= 0) return 0;
  return Math.round(((baselineValue - optimisedValue) / baselineValue) * 100);
}
