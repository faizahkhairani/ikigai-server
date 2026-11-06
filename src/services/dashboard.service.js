import prisma from '../lib/prisma.js';
import { startOfTodayJakarta } from '../utils/dates.js';

const ORDER_STATUSES = [
  'WAITING',
  'ARRIVED_THAILAND',
  'ARRIVED_INDONESIA',
  'SORTING',
  'PACKING_QUEUE',
  'PACKING',
  'READY_TO_SHIP',
  'SHIPPED',
  'COMPLETED',
  'ISSUE',
  'CANCELLED',
];
const PAYMENT_STATUSES = ['unpaid', 'dp', 'lunas'];
const RECENT_ACTIVITY_LIMIT = 8;
const TODAY_ORDERS_LIMIT = 10;

const BATCH_SELECT = { id: true, name: true, status: true, startDate: true };

const zeroCounts = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));

// Tanpa batchId: batch aktif, kalau tidak ada yang aktif ambil batch terbaru
const resolveBatch = async (batchId) => {
  if (batchId) return prisma.batch.findUnique({ where: { id: batchId }, select: BATCH_SELECT });

  const active = await prisma.batch.findFirst({
    where: { status: 'active' },
    select: BATCH_SELECT,
  });
  return active ?? prisma.batch.findFirst({ orderBy: { createdAt: 'desc' }, select: BATCH_SELECT });
};

export const getDashboardSummary = async (batchId) => {
  const batch = await resolveBatch(batchId);

  if (!batch) {
    if (batchId) {
      const error = new Error('Batch tidak ditemukan');
      error.statusCode = 404;
      throw error;
    }
    // Belum ada batch sama sekali: ringkasan kosong
    return {
      batch: null,
      totalOrders: 0,
      todayCount: 0,
      heldCount: 0,
      byStatus: zeroCounts(ORDER_STATUSES),
      byPayment: zeroCounts(PAYMENT_STATUSES),
      recentActivity: [],
      todayOrders: [],
    };
  }

  const todayStart = startOfTodayJakarta();

  const [groups, todayCount, todayOrders, recentLogs] = await Promise.all([
    prisma.order.groupBy({
      by: ['status', 'paymentStatus', 'isHeld'],
      where: { batchId: batch.id },
      _count: { _all: true },
    }),
    prisma.order.count({
      where: { batchId: batch.id, createdAt: { gte: todayStart } },
    }),
    prisma.order.findMany({
      where: { batchId: batch.id, createdAt: { gte: todayStart } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: TODAY_ORDERS_LIMIT,
      select: {
        id: true,
        resiThailand: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.orderStatusLog.findMany({
      where: { order: { batchId: batch.id } },
      orderBy: { changedAt: 'desc' },
      take: RECENT_ACTIVITY_LIMIT,
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        // isCorrection: true,
        changedAt: true,
        changedBy: { select: { name: true } },
        order: { select: { id: true, resiThailand: true } },
      },
    }),
  ]);

  const byStatus = zeroCounts(ORDER_STATUSES);
  const byPayment = zeroCounts(PAYMENT_STATUSES);
  let totalOrders = 0;
  let heldCount = 0;

  for (const group of groups) {
    const count = group._count._all;
    totalOrders += count;
    byStatus[group.status] = (byStatus[group.status] ?? 0) + count;

    // Order batal tidak dihitung di pembayaran dan Hold
    if (group.status !== 'CANCELLED') {
      byPayment[group.paymentStatus] = (byPayment[group.paymentStatus] ?? 0) + count;
      if (group.isHeld) heldCount += count;
    }
  }

  return {
    batch,
    totalOrders,
    todayCount,
    heldCount,
    byStatus,
    byPayment,
    recentActivity: recentLogs.map((log) => ({
      id: log.id,
      orderId: log.order.id,
      resi: log.order.resiThailand,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      // isCorrection: log.isCorrection,
      changedAt: log.changedAt,
      changedBy: log.changedBy?.name ?? null, // kosong = customer (form publik)
    })),
    todayOrders: todayOrders.map((order) => ({
      id: order.id,
      resi: order.resiThailand,
      customerName: order.customer.name,
      itemCount: order._count.items,
      status: order.status,
      createdAt: order.createdAt,
    })),
  };
};