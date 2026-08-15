/**
 * Collection fleet parameters.
 *
 * Every number here is an openly stated planning assumption, not a
 * measurement. They are returned by the API so the UI can show exactly how a
 * route estimate was produced (same rule as the impact model).
 */

/** Where a collection round starts and ends. */
export const DEPOT = {
  name: 'Commissioners Street Transfer Station',
  address: '400 Commissioners Street, Toronto',
  latitude: 43.6531,
  longitude: -79.3406,
};

export const FLEET_ASSUMPTIONS = {
  /** Average speed of a refuse truck in city traffic, including stop-start. */
  averageSpeedKmh: 18,
  /** Time to pull up, lift, empty and log one underground bin. */
  serviceMinutesPerStop: 6,
  /**
   * Straight-line distance underestimates driving. 1.35 is a common urban
   * detour factor for a grid city like Toronto.
   */
  roadDistanceFactor: 1.35,

  /** Diesel refuse truck consumption while driving. */
  fuelLitresPerKm: 0.4,
  /** Consumption while idling and running the compactor at a stop. */
  idleFuelLitresPerMinute: 0.03,
  /** Combustion emissions of one litre of diesel. */
  co2KgPerLitreDiesel: 2.68,

  /** Assumed rounds per month when projecting savings. */
  roundsPerMonth: 30,

  notes: [
    'Distances are straight-line, scaled by a 1.35 road factor. This is not a routed street network.',
    'Savings compare a sensor-driven round against a fixed round that visits every bin.',
    'Skipped bins are still collected on a later round, once they are actually full.',
    'Monthly figures assume one round per day and that current fill rates hold.',
  ],
};

/** Default fill level at which a bin earns a place on the round. */
export const DEFAULT_FILL_THRESHOLD = 70;

/** Why a bin is on the route - a stop is never justified by colour alone. */
export const STOP_REASONS = {
  FULL: 'Full - at or above 90%',
  NEEDS_ATTENTION: 'Filling up - at or above the threshold',
  NO_SENSOR_DATA: 'Sensor offline - level unknown, must be checked',
};
