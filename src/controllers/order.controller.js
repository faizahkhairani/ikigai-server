import * as orderService from '../services/order.service.js';
import { buildPagination, parsePagination, toOptionalString } from '../utils/queryParams.js';
import { parseOrderInput } from '../utils/orderInput.js';

const MAX_BULK_SIZE = 100;

// orderIds harus array string yang tidak kosong, duplikat dibuang
const parseOrderIds = (value) => {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((id) => typeof id === 'string' && id !== '')) return null;
  return [...new Set(value)];
};  

// GET /api/orders/availability
export const getAvailability = async (req, res) => {
  return res.json(await orderService.getOrderAvailability());
};

// POST /api/orders — form publik (multipart: image + name, phone, resiThailand, items)
export const submitPublicOrder = async (req, res) => {
  let rawItems;
  try {
    rawItems = JSON.parse(req.body.items); // multipart cuma bisa kirim string
  } catch {
    rawItems = null;
  }

  const { data, error } = parseOrderInput({ ...req.body, items: rawItems });
  if (error) return res.status(400).json({ error });
  if (!req.file) return res.status(400).json({ error: 'Foto bukti resi wajib diunggah' });

  try {
    const order = await orderService.createPublicOrder({ ...data, image: req.file });
    // cukup token-nya, data order lain nggak perlu keluar ke publik
    return res.status(201).json({ trackingToken: order.trackingToken });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

// POST /api/admin/orders — input manual oleh admin (order dari WA)
export const createManualOrder = async (req, res) => {
  const { data, error } = parseOrderInput(req.body);
  if (error) return res.status(400).json({ error });

  const batchId =
    typeof req.body.batchId === 'string' && req.body.batchId ? req.body.batchId : undefined;

  try {
    const order = await orderService.createManualOrder({ ...data, batchId, adminId: req.adminUser.id });
    return res.status(201).json({ order });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

// GET /api/admin/orders?page=&pageSize=&batchId=&status=&orderType=&search=
export const listOrdersForAdmin = async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);

  const { orders, total } = await orderService.findOrdersForAdmin({
    batchId: toOptionalString(req.query.batchId),
    status: toOptionalString(req.query.status),
    orderType: toOptionalString(req.query.orderType),
    search: toOptionalString(req.query.search),
    datePreset: toOptionalString(req.query.date),
    page,
    pageSize,
  });

  return res.json({ orders, pagination: buildPagination({ page, pageSize, total }) });
  
};

// POST /api/admin/orders/:id/correct-status
export const correctOrderStatus = async (req, res) => {
  const result = await orderService.correctOrderStatus(req.params.id, req.adminUser.id);
  if (!result.success) return res.status(result.statusCode ?? 400).json({ error: result.error });
  return res.json({ success: true, status: result.status });
};

// PATCH /api/admin/orders/:id/status
export const updateOrderStatus = async (req, res) => {
  const result = await orderService.transitionOrderStatus(
    req.params.id,
    req.body.status,
    req.adminUser.id
  );
  if (!result.success) return res.status(400).json({ error: result.error });
  return res.json({ success: true });
};

// PATCH /api/admin/orders/bulk-status
export const bulkUpdateOrderStatus = async (req, res) => {
  const orderIds = parseOrderIds(req.body.orderIds);
  const { status } = req.body;

  if (!orderIds || typeof status !== 'string' || !status) {
    return res.status(400).json({ error: 'orderIds dan status wajib diisi' });
  }
  if (orderIds.length > MAX_BULK_SIZE) {
    return res.status(400).json({ error: `Maksimal ${MAX_BULK_SIZE} order sekali proses` });
  }

  const result = await orderService.bulkTransitionOrderStatus(orderIds, status, req.adminUser.id);
  return res.json(result);
};

// PATCH /api/admin/orders/:id/payment-status
export const updatePaymentStatus = async (req, res) => {
  const result = await orderService.updatePaymentStatus(req.params.id, req.body.paymentStatus);
  if (!result.success) return res.status(400).json({ error: result.error });
  return res.json({ success: true });
};

// PATCH /api/admin/orders/bulk-payment-status
export const bulkUpdatePaymentStatus = async (req, res) => {
  const orderIds = parseOrderIds(req.body.orderIds);
  const { paymentStatus } = req.body;

  if (!orderIds || typeof paymentStatus !== 'string' || !paymentStatus) {
    return res.status(400).json({ error: 'orderIds dan paymentStatus wajib diisi' });
  }
  if (orderIds.length > MAX_BULK_SIZE) {
    return res.status(400).json({ error: `Maksimal ${MAX_BULK_SIZE} order sekali proses` });
  }

  const result = await orderService.bulkUpdatePaymentStatus(orderIds, paymentStatus);
  return res.json(result);
};

// GET /api/admin/orders/:id
export const getOrderDetail = async (req, res) => {
  const order = await orderService.getOrderDetail(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  return res.json({ order });
};

// POST /api/admin/orders/:id/proof-images (multipart: image)
export const uploadProofImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Foto bukti wajib diunggah' });

  try {
    const result = await orderService.attachProofImage({
      file: req.file,
      orderId: req.params.id,
      adminId: req.adminUser.id,
    });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

// DELETE /api/admin/orders/:id/proof-images/:imageId
export const deleteProofImage = async (req, res) => {
  const result = await orderService.deleteProofImage({
    orderId: req.params.id,
    imageId: req.params.imageId,
  });
  if (!result.success) return res.status(result.statusCode ?? 400).json({ error: result.error });
  return res.json({ success: true });
};

// PUT /api/admin/orders/:id/resi-image (multipart: image)
export const replaceResiImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Foto wajib diunggah' });

  const result = await orderService.replaceResiImage({
    orderId: req.params.id,
    file: req.file,
  });
  if (!result.success) return res.status(result.statusCode ?? 400).json({ error: result.error });
  return res.json({ success: true });
};