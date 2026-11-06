import { Router } from 'express';
import * as customerController from '../controllers/customer.controller.js';
import requireAdminAuth from '../middleware/requireAdminAuth.js';

const router = Router();
router.use(requireAdminAuth);

router.get('/', customerController.listCustomers);
router.get('/:id', customerController.getCustomer);
router.patch('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

export default router;