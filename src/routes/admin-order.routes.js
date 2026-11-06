import { Router } from 'express';
import * as orderController from '../controllers/order.controller.js';
import requireAdminAuth from '../middleware/requireAdminAuth.js';
import { uploadSingleImage } from '../middleware/uploadImage.js';

const router = Router();
router.use(requireAdminAuth); // semua route di sini wajib login admin

router.get('/', orderController.listOrdersForAdmin);

router.post('/', orderController.createManualOrder);

router.patch('/bulk-status', orderController.bulkUpdateOrderStatus);
router.patch('/:id/status', orderController.updateOrderStatus);

router.patch('/bulk-payment-status', orderController.bulkUpdatePaymentStatus);
router.patch('/:id/payment-status', orderController.updatePaymentStatus);

router.post('/:id/proof-images', uploadSingleImage, orderController.uploadProofImage);
router.post('/:id/correct-status', orderController.correctOrderStatus);

router.put('/:id/resi-image', uploadSingleImage, orderController.replaceResiImage);
router.delete('/:id/proof-images/:imageId', orderController.deleteProofImage);

router.get('/:id', orderController.getOrderDetail);

export default router;
