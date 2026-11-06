import { Router } from 'express';
import * as orderController from '../controllers/order.controller.js';
import rateLimit from 'express-rate-limit';
import { uploadSingleImage } from '../middleware/uploadImage.js';

const router = Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan, coba lagi beberapa menit lagi' },
});

router.get('/availability', orderController.getAvailability);
router.post('/', submitLimiter, uploadSingleImage, orderController.submitPublicOrder);

export default router;
