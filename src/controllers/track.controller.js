import * as orderService from '../services/order.service.js';
import { buildPagination, parsePagination } from '../utils/queryParams.js';

export const trackByToken = async (req, res) => {
  const order = await orderService.getOrderByTrackingToken(req.params.token);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  return res.json({ order });
};

export const trackByResiOrPhone = async (req, res) => {
  const resi = typeof req.query.resi === 'string' ? req.query.resi.trim() : '';
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';

  if (!resi && !phone) {
    return res.status(400).json({ error: 'Masukkan nomor resi atau nomor WA' });
  }

  const { page, pageSize } = parsePagination(req.query);
  const { orders, total } = await orderService.findOrdersByResiOrPhone({
    resi,
    phone,
    page,
    pageSize,
  });
  return res.json({ orders, pagination: buildPagination({ page, pageSize, total }) });
};
