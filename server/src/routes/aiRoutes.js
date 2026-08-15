import { Router } from 'express';
import { asyncHandler } from '../utils/errors.js';
import { analyse, getBinRecommendations } from '../controllers/aiController.js';

const router = Router();

router.post('/analyze', asyncHandler(analyse));
router.get('/recommendations/:binId', asyncHandler(getBinRecommendations));

export default router;
