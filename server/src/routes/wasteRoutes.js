import { Router } from 'express';
import { asyncHandler } from '../utils/errors.js';
import { handleImageUpload } from '../utils/upload.js';
import { classifyWaste, getWasteStats, listWasteEvents } from '../controllers/wasteController.js';

const router = Router();

router.post('/classify', handleImageUpload, asyncHandler(classifyWaste));
router.get('/events', asyncHandler(listWasteEvents));
router.get('/stats', asyncHandler(getWasteStats));

export default router;
