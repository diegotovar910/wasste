import mongoose from 'mongoose';
import { ALL_CATEGORIES } from '../config/wasteCategories.js';

/**
 * One disposal event: the atomic record every analytic in Wasste is built from
 * (sections 10 and 34).
 */
const wasteEventSchema = new mongoose.Schema(
  {
    smartBinId: { type: mongoose.Schema.Types.ObjectId, ref: 'SmartBin', required: true, index: true },
    category: { type: String, enum: ALL_CATEGORIES, required: true, index: true },
    item: { type: String, required: true, trim: true },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    estimatedWeightKg: { type: Number, min: 0, default: 0 },
    reason: { type: String, trim: true },
    imageUrl: { type: String, default: null },

    /** Where the classification came from, so the UI never overstates the AI. */
    source: { type: String, enum: ['GEMINI', 'DEMO', 'SEED'], default: 'GEMINI' },
    /** True when confidence fell below the threshold and a human should verify. */
    needsReview: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: true }, toJSON: { virtuals: true } },
);

wasteEventSchema.index({ smartBinId: 1, createdAt: -1 });

export const WasteEvent = mongoose.model('WasteEvent', wasteEventSchema);
