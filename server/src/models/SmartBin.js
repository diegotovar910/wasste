import mongoose from 'mongoose';
import { DISTRIBUTION_KEY } from '../config/wasteCategories.js';
import { round, sumDistribution, toPercentages } from '../utils/impact.js';

/** Section 22: bin status is always derived from fill level, never set by hand. */
export const BIN_STATUSES = ['ACTIVE', 'NEEDS_ATTENTION', 'FULL', 'OFFLINE'];

export function statusFromFill(fillPercentage) {
  if (fillPercentage >= 90) return 'FULL';
  if (fillPercentage >= 70) return 'NEEDS_ATTENTION';
  return 'ACTIVE';
}

const distributionSchema = new mongoose.Schema(
  {
    landfill: { type: Number, default: 0, min: 0 },
    paper: { type: Number, default: 0, min: 0 },
    recyclableContainers: { type: Number, default: 0, min: 0 },
    organics: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const smartBinSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    location: {
      latitude: { type: Number, required: true, min: -90, max: 90 },
      longitude: { type: Number, required: true, min: -180, max: 180 },
      address: { type: String, required: true, trim: true },
      neighbourhood: { type: String, trim: true },
    },

    capacityKg: { type: Number, default: 200, min: 1 },
    currentFillPercentage: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: BIN_STATUSES, default: 'ACTIVE' },

    /** Measured kg per sub-bin - the source of truth for every chart. */
    wasteByCategoryKg: { type: distributionSchema, default: () => ({}) },
    /** How many classified items landed in each sub-bin. */
    eventCounts: { type: distributionSchema, default: () => ({}) },

    sensors: {
      lastReadingAt: { type: Date, default: Date.now },
      estimatedWeightKg: { type: Number, default: 0, min: 0 },
      temperatureC: { type: Number, default: 18 },
      /** Honest labelling: this prototype has no hardware (section 11). */
      source: { type: String, default: 'SIMULATED' },
    },

    /** When the bin was last emptied. Current fill is everything since then. */
    lastCollectedAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

smartBinSchema.virtual('totalWasteKg').get(function totalWasteKg() {
  return sumDistribution(this.wasteByCategoryKg);
});

/** Percentage split, matching the shape shown in the dashboard (section 13). */
smartBinSchema.virtual('wasteDistribution').get(function wasteDistribution() {
  return toPercentages(this.wasteByCategoryKg);
});

smartBinSchema.virtual('totalEvents').get(function totalEvents() {
  const counts = this.eventCounts || {};
  return Object.values(DISTRIBUTION_KEY).reduce((sum, key) => sum + (counts[key] || 0), 0);
});

/** Records one classified item and lets the fill level drift up accordingly. */
smartBinSchema.methods.applyWasteEvent = function applyWasteEvent(category, weightKg = 0) {
  const key = DISTRIBUTION_KEY[category];
  if (!key) return this; // UNKNOWN items are logged but never sorted into a sub-bin.

  this.wasteByCategoryKg[key] = round((this.wasteByCategoryKg[key] || 0) + weightKg);
  this.eventCounts[key] = (this.eventCounts[key] || 0) + 1;

  const fillDelta = (weightKg / this.capacityKg) * 100;
  this.currentFillPercentage = Math.min(100, round(this.currentFillPercentage + fillDelta, 1));
  this.sensors.estimatedWeightKg = round(this.sensors.estimatedWeightKg + weightKg);
  this.sensors.lastReadingAt = new Date();
  this.status = statusFromFill(this.currentFillPercentage);
  this.lastUpdated = new Date();

  return this;
};

smartBinSchema.pre('save', function syncStatus(next) {
  if (this.status !== 'OFFLINE') {
    this.status = statusFromFill(this.currentFillPercentage);
  }
  next();
});

export const SmartBin = mongoose.model('SmartBin', smartBinSchema);
