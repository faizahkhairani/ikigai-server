import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import requireAdminAuth from '../middleware/requireAdminAuth.js';

const router = Router();
router.use(requireAdminAuth);

router.get('/me', adminController.getMe);

export default router;