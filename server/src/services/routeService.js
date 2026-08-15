import { SmartBin } from '../models/SmartBin.js';
import { DEFAULT_FILL_THRESHOLD, DEPOT, FLEET_ASSUMPTIONS, STOP_REASONS } from '../config/fleet.js';
import { round, sumDistribution } from '../utils/impact.js';
import { DEFAULT_PERIOD_DAYS } from './analyticsService.js';

/**
 * Collection route optimisation.
 *
 * This file contains no AI at all. The route, the distances, the times and the
 * emissions are solved deterministically here; Gemini only reads the finished
 * plan and explains it (section 18's rule applied to operations).
 */

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(a, b) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Straight-line distance scaled to something a truck could actually drive. */
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
 * O(n^2) per pass, which is nothing at city-pilot scale.
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

/** Turns an ordered list of stops into distance, time, fuel and emissions. */
function costOfRoute(stops) {
  const distanceKm = routeDistanceKm(stops);
  const {
    averageSpeedKmh,
    serviceMinutesPerStop,
    fuelLitresPerKm,
    idleFuelLitresPerMinute,
    co2KgPerLitreDiesel,
  } = FLEET_ASSUMPTIONS;

  const driveMinutes = averageSpeedKmh > 0 ? (distanceKm / averageSpeedKmh) * 60 : 0;
  const serviceMinutes = stops.length * serviceMinutesPerStop;

  const fuelLitres = distanceKm * fuelLitresPerKm + serviceMinutes * idleFuelLitresPerMinute;

  return {
    stopCount: stops.length,
    distanceKm: round(distanceKm, 2),
    driveMinutes: Math.round(driveMinutes),
    serviceMinutes: Math.round(serviceMinutes),
    totalMinutes: Math.round(driveMinutes + serviceMinutes),
    fuelLitres: round(fuelLitres, 2),
    co2Kg: round(fuelLitres * co2KgPerLitreDiesel, 2),
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

function reasonFor(bin, fillThreshold) {
  if (bin.status === 'OFFLINE') return 'NO_SENSOR_DATA';
  if (bin.currentFillPercentage >= 90) return 'FULL';
  if (bin.currentFillPercentage >= fillThreshold) return 'NEEDS_ATTENTION';
  return null;
}

/**
 * Builds today's collection round.
 *
 * The optimised route visits only bins that have earned a stop. The baseline
 * is the status quo it replaces: a fixed round that drives to every bin in the
 * network regardless of how full it is.
 */
export async function planCollectionRoute({
  fillThreshold = DEFAULT_FILL_THRESHOLD,
  periodDays = DEFAULT_PERIOD_DAYS,
} = {}) {
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
    daysUntilFull: daysUntilFull(bin, periodDays),
  });

  const candidates = [];
  const skipped = [];

  for (const bin of bins) {
    const reason = reasonFor(bin, fillThreshold);
    const stop = toStop(bin);

    if (reason) {
      candidates.push({ ...stop, reason, reasonLabel: STOP_REASONS[reason] });
    } else {
      skipped.push(stop);
    }
  }

  // Solve, then measure. Both routes are costed with the same model so the
  // comparison is apples to apples.
  const ordered = twoOpt(nearestNeighbour(candidates));
  const optimised = costOfRoute(ordered);

  // The status quo: every bin, in the fixed order a printed round sheet lists.
  const baselineStops = bins.map(toStop);
  const baseline = costOfRoute(baselineStops);

  // The same stops in the order a greedy round sheet would take them, to show
  // what the solver itself contributes on top of simply skipping bins.
  const unoptimisedSelected = costOfRoute(candidates);

  const stops = ordered.map((stop, index) => {
    const previous = index === 0 ? DEPOT : ordered[index - 1];
    const legDistanceKm = round(roadKm(previous, stop), 2);
    return { ...stop, order: index + 1, legDistanceKm };
  });

  let cumulativeKm = 0;
  let cumulativeMinutes = 0;
  for (const stop of stops) {
    cumulativeKm += stop.legDistanceKm;
    cumulativeMinutes +=
      (stop.legDistanceKm / FLEET_ASSUMPTIONS.averageSpeedKmh) * 60 +
      FLEET_ASSUMPTIONS.serviceMinutesPerStop;
    stop.cumulativeDistanceKm = round(cumulativeKm, 2);
    stop.etaMinutes = Math.round(cumulativeMinutes);
  }

  const savings = {
    distanceKm: round(baseline.distanceKm - optimised.distanceKm, 2),
    minutes: baseline.totalMinutes - optimised.totalMinutes,
    fuelLitres: round(baseline.fuelLitres - optimised.fuelLitres, 2),
    co2Kg: round(baseline.co2Kg - optimised.co2Kg, 2),
    stopsAvoided: baseline.stopCount - optimised.stopCount,
    percentDistance: baseline.distanceKm > 0
      ? Math.round(((baseline.distanceKm - optimised.distanceKm) / baseline.distanceKm) * 100)
      : 0,
    percentTime: baseline.totalMinutes > 0
      ? Math.round(((baseline.totalMinutes - optimised.totalMinutes) / baseline.totalMinutes) * 100)
      : 0,
    percentCo2: baseline.co2Kg > 0
      ? Math.round(((baseline.co2Kg - optimised.co2Kg) / baseline.co2Kg) * 100)
      : 0,
  };

  const { roundsPerMonth } = FLEET_ASSUMPTIONS;

  return {
    generatedAt: new Date().toISOString(),
    fillThreshold,
    depot: DEPOT,
    stops,
    skipped: skipped.sort((a, b) => b.fillPercentage - a.fillPercentage),
    optimised,
    baseline,
    unoptimisedSelected,
    /** What the 2-opt solver saves beyond simply visiting fewer bins. */
    solverGain: {
      distanceKm: round(unoptimisedSelected.distanceKm - optimised.distanceKm, 2),
      minutes: unoptimisedSelected.totalMinutes - optimised.totalMinutes,
    },
    savings,
    monthlyProjection: {
      roundsPerMonth,
      hoursSaved: round((savings.minutes * roundsPerMonth) / 60, 1),
      co2KgSaved: round(savings.co2Kg * roundsPerMonth),
      fuelLitresSaved: round(savings.fuelLitres * roundsPerMonth),
      distanceKmSaved: round(savings.distanceKm * roundsPerMonth),
    },
    assumptions: FLEET_ASSUMPTIONS,
  };
}
