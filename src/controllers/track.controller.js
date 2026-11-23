import * as orderService from '../services/order.service.js';
import { normalizeIdentifier } from '../utils/normalizeIdentifier.js';
import { buildPagination, parsePagination } from '../utils/queryParams.js';

export const trackByToken = async (req, res) => {
  const order = await orderService.getOrderByTrackingToken(req.params.token);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  return res.json({ order });
};

// GET /api/track?resi= | ?phone= | ?identifier= (&page=&pageSize=)
export const searchTrackedOrders = async (req, res) => {
  const resi = typeof req.query.resi === 'string' ? req.query.resi.trim() : '';
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';

  // Dinormalisasi sebelum dicek: "@" saja jadi kosong, dan awalan kosong cocok ke semua customer
  const identifier =
    typeof req.query.identifier === 'string' ? normalizeIdentifier(req.query.identifier) : '';

  if (!resi && !phone && !identifier) {
    return res.status(400).json({ error: 'Masukkan nomor resi, nomor WA, atau username' });
  }

  const { page, pageSize } = parsePagination(req.query);
  const { orders, total } = await orderService.findOrdersForTracking({
    resi,
    phone,
    identifier,
    page,
    pageSize,
  });
  return res.json({ orders, pagination: buildPagination({ page, pageSize, total }) });
};
