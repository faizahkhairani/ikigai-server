import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import requireAdminAuth from '../middleware/requireAdminAuth.js';
import * as c from '../controllers/auth.controller.js';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

router.post('/login', loginLimiter, c.login);
router.post('/refresh', c.refresh);
router.post('/logout', c.logout);
router.get('/me', requireAdminAuth, c.me);

export default router;