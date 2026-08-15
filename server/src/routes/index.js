import { Router } from 'express';
import { isDatabaseReady } from '../config/db.js';
import { isGeminiConfigured } from '../services/geminiService.js';
import { CATEGORY_LABELS, CATEGORIES, LOW_CONFIDENCE_THRESHOLD } from '../config/wasteCategories.js';
import { IMPACT_ASSUMPTIONS } from '../utils/impact.js';
import { asyncHandler, serviceUnavailable } from '../utils/errors.js';
import { getDashboard } from '../controllers/dashboardController.js';
import binRoutes from './binRoutes.js';
import wasteRoutes from './wasteRoutes.js';
import aiRoutes from './aiRoutes.js';

const router = Router();

/** Health and capability probe - the client uses this to show honest banners. */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: isDatabaseReady() ? 'connected' : 'unavailable',
    gemini: isGeminiConfigured() ? 'configured' : 'not configured',
    categories: CATEGORIES,
    categoryLabels: CATEGORY_LABELS,
    lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
    impactAssumptions: IMPACT_ASSUMPTIONS,
  });
});

/** Every data route needs MongoDB; fail with a clear 503 instead of a stack trace. */
router.use((req, res, next) => {
  if (!isDatabaseReady()) {
    next(serviceUnavailable('The Wasste database is unavailable. Check that MongoDB is running.'));
    return;
  }
  next();
});

router.get('/dashboard', asyncHandler(getDashboard));
router.use('/bins', binRoutes);
router.use('/waste', wasteRoutes);
router.use('/ai', aiRoutes);

export default router;
