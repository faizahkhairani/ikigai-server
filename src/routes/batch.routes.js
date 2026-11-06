import { Router } from 'express';
import * as batchController from '../controllers/batch.controller.js';
import requireAdminAuth from '../middleware/requireAdminAuth.js';

const router = Router();
router.use(requireAdminAuth);

router.get('/', batchController.listBatches);
router.post('/', batchController.openBatch);
router.patch('/:id/close', batchController.closeBatch);
router.patch('/:id/open', batchController.reopenBatch);

export default router;
