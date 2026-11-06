import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as trackController from '../controllers/track.controller.js';

const router = Router();

const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan, coba lagi beberapa menit lagi' },
});
router.use(trackLimiter);

router.get('/:token', trackController.trackByToken);
router.get('/', trackController.trackByResiOrPhone);

export default router;