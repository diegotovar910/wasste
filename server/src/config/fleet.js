/**
 * Collection fleet parameters.
 *
 * Every number here is an openly stated planning assumption, not a
 * measurement. They are returned by the API so the UI can show exactly how a
 * route estimate was produced (same rule as the impact model).
 */

/** Where a round starts and ends. */
export const DEPOT = {
  name: 'Commissioners Street Transfer Station',
  address: '400 Commissioners Street, Toronto',
  latitude: 43.6531,
  longitude: -79.3406,
};

/**
 * What the round is for. Each mode selects different bins AND sends a
 * different vehicle, so its time and emissions are costed differently.
 */
export const ROUTE_MODES = {
  COLLECTION: {
    id: 'COLLECTION',
    label: 'Collection round',
    description: 'Empty every bin at or above the fill threshold.',
    vehicle: 'REFUSE_TRUCK',
  },
  URGENT: {
    id: 'URGENT',
    label: 'Urgent overflow run',
    description: 'Only bins at risk of overflowing right now.',
    vehicle: 'REFUSE_TRUCK',
  },
  MAINTENANCE: {
    id: 'MAINTENANCE',
    label: 'Technician run',
    description: 'Visit bins whose sensors have stopped reporting.',
    vehicle: 'TECHNICIAN_VAN',
  },
};

export const VEHICLES = {
  REFUSE_TRUCK: {
    id: 'REFUSE_TRUCK',
    label: 'Refuse truck',
    averageSpeedKmh: 18,
    serviceMinutesPerStop: 6,
    fuelLitresPerKm: 0.4,
    idleFuelLitresPerMinute: 0.03,
    payloadKg: 800,
  },
  TECHNICIAN_VAN: {
    id: 'TECHNICIAN_VAN',
    label: 'Technician van',
    averageSpeedKmh: 25,
    // Diagnosing a sensor takes far longer than tipping a bin.
    serviceMinutesPerStop: 20,
    fuelLitresPerKm: 0.11,
    idleFuelLitresPerMinute: 0.01,
    payloadKg: 0,
  },
};

export const FLEET_ASSUMPTIONS = {
  /**
   * Straight-line distance underestimates driving. 1.35 is a common urban
   * detour factor for a grid city like Toronto.
   */
  roadDistanceFactor: 1.35,
  /** Combustion emissions of one litre of diesel. */
  co2KgPerLitreDiesel: 2.68,
  /** For the running-cost figure. */
  fuelCostPerLitre: 1.65,
  currency: 'CAD',
  /** Assumed rounds per month when projecting savings. */
  roundsPerMonth: 30,

  notes: [
    'Distances are straight-line, scaled by a 1.35 road factor. This is not a routed street network.',
    'Savings compare this round against a fixed round that visits every bin with the same vehicle.',
    'Bins left out today are still collected on a later round, once they are actually full.',
    'Monthly figures assume one round per day and that current fill rates hold.',
  ],
};

/** The planner's defaults - what you get before touching any control. */
export const ROUTE_DEFAULTS = {
  mode: 'COLLECTION',
  fillThreshold: 70,
  includeOffline: true,
  alwaysCollectFull: true,
  /** 0 means "no limit" for all three constraints. */
  maxStops: 0,
  maxShiftMinutes: 480,
  payloadKg: 0,
  departureTime: '07:00',
  objective: 'DISTANCE',
};

/** How the solver decides which stop to drop when a limit is hit. */
export const OBJECTIVES = {
  DISTANCE: {
    id: 'DISTANCE',
    label: 'Shortest route',
    description: 'Drop whichever stop costs the most detour for the least urgency.',
  },
  URGENCY: {
    id: 'URGENCY',
    label: 'Fullest bins first',
    description: 'Always keep the fullest bins, even if they are far apart.',
  },
};

/** A bin with a dead sensor has an unknown level, so treat it as fairly urgent. */
export const OFFLINE_URGENCY = 85;

/** Why a bin earned a stop - a stop is never justified by colour alone. */
export const STOP_REASONS = {
  FULL: 'Full - at or above 90%',
  NEEDS_ATTENTION: 'Filling up - at or above the threshold',
  NO_SENSOR_DATA: 'Sensor offline - level unknown, needs a technician',
};

/** Why a bin that qualified did not make today's round. */
export const DEFERRAL_REASONS = {
  BELOW_THRESHOLD: 'Below the fill threshold',
  NOT_URGENT: 'Not at overflow risk',
  SENSOR_ONLINE: 'Sensor is reporting normally',
  MAX_STOPS: 'Beyond the stop limit for this round',
  SHIFT_LIMIT: 'Would push the round past the shift limit',
  PAYLOAD_LIMIT: 'Would exceed the vehicle payload',
};
