import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import requireAdminAuth from '../middleware/requireAdminAuth.js';

const router = Router();
router.use(requireAdminAuth);

router.get('/', dashboardController.getDashboard);

export default router;