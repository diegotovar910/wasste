import { Router } from 'express';
import { asyncHandler } from '../utils/errors.js';
import { createBin, getBin, listBins, updateSensorReading } from '../controllers/binController.js';

const router = Router();

router.get('/', asyncHandler(listBins));
router.post('/', asyncHandler(createBin));
router.get('/:id', asyncHandler(getBin));
router.post('/:id/sensor', asyncHandler(updateSensorReading));

export default router;
