import { Router } from 'express';
import { asyncHandler } from '../utils/errors.js';
import { analyseCollectionRoute, optimizeRoute } from '../controllers/routeController.js';

const router = Router();

router.get('/optimize', asyncHandler(optimizeRoute));
router.post('/analyze', asyncHandler(analyseCollectionRoute));

export default router;
