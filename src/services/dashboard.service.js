import { customerLabel } from '../utils/customerLabel.js';
import prisma from '../lib/prisma.js';
import { startOfTodayJakarta, DAY_MS } from '../utils/dates.js';

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
// const RECENT_ACTIVITY_LIMIT = 8;
const TODAY_ORDERS_LIMIT = 10;
const ATTENTION_LIMIT = 5;

// Order yang butuh tindakan admin: Hold atau Issue (order batal tidak dihitung)
const attentionWhere = (batchId) => ({
  batchId,
  status: { not: 'CANCELLED' },
  OR: [{ isHeld: true }, { status: 'ISSUE' }],
});

// comparing orders batch

// batch.id -> { id, createdAt } batch sebelumnya, atau null. Berubah hanya saat ada batch baru.
const previousBatchCache = new Map();

const getPreviousBatch = async (batch) => {
  if (previousBatchCache.has(batch.id)) return previousBatchCache.get(batch.id);

  const prev =
    (await prisma.batch.findFirst({
      where: { createdAt: { lt: batch.createdAt } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    })) ?? null;

  previousBatchCache.set(batch.id, prev);
  return prev;
};

// Order batch lalu pada durasi yang sama dengan umur batch ini (apple to apple)
const getPreviousBatchComparison = async (batch, now) => {
  const elapsedMs = Math.max(0, (batch.closedAt ?? now) - batch.createdAt);
  const elapsedDays = Math.max(1, Math.ceil(elapsedMs / DAY_MS));

  const prev = await getPreviousBatch(batch);
  if (!prev) return { previous: null, elapsedDays };

  const cutoff = new Date(prev.createdAt.getTime() + elapsedMs);
  const previous = await prisma.order.count({
    where: { batchId: prev.id, createdAt: { lt: cutoff } },
  });
  return { previous, elapsedDays };
};

const BATCH_SELECT = { id: true, name: true, status: true, startDate: true, closedAt: true, createdAt: true };

const zeroCounts = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));

const TTL_MS = 60_000;

let defaultEntry = null; // hasil resolveBatch() tanpa batchId
const byId = new Map(); // hasil resolveBatch(batchId)

const isFresh = (entry) => entry && entry.expiresAt > Date.now();
const wrap = (value) => ({ value, expiresAt: Date.now() + TTL_MS });

// Panggil ini setiap batch berubah
export const invalidateBatchCache = () => {
  defaultEntry = null;
  byId.clear();
  previousBatchCache.clear();
};

// Tanpa batchId: batch aktif, kalau tidak ada yang aktif ambil batch terbaru
export const resolveBatch = async (batchId) => {
  if (batchId) {
    const hit = byId.get(batchId);
    if (isFresh(hit)) return hit.value;

    const value = await prisma.batch.findUnique({ where: { id: batchId }, select: BATCH_SELECT });
    if (value) byId.set(batchId, wrap(value)); // null tidak di-cache, supaya id acak tidak menumpuk
    return value;
  }

  if (isFresh(defaultEntry)) return defaultEntry.value;

  const active = await prisma.batch.findFirst({
    where: { status: 'active' },
    select: BATCH_SELECT,
  });
  const value =
    active ??
    (await prisma.batch.findFirst({ orderBy: { createdAt: 'desc' }, select: BATCH_SELECT }));

  defaultEntry = wrap(value);
  return value;
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
      // recentActivity: [],
      todayOrders: [],
      comparison: null,
      needsAttention: { total: 0, items: [] },
    };
  }

  const now = new Date();
  const todayStart = startOfTodayJakarta();
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  const yesterdaySameTime = new Date(now.getTime() - DAY_MS); // Jakarta tidak ada DST

  const [groups, todayCount, yesterdayCount, batchComparison, todayOrders, attentionTotal, attentionOrders, recentLogs] =
    await Promise.all([
      prisma.order.groupBy({
        by: ['status', 'paymentStatus', 'isHeld'],
        where: { batchId: batch.id },
        _count: { _all: true },
      }),
      // todayCount
      prisma.order.count({
        where: { batchId: batch.id, createdAt: { gte: todayStart } },
      }),
      // kemarin dari 00:00 sampai jam yang sama dengan sekarang (yesterdayCount)
      prisma.order.count({
        where: { batchId: batch.id, createdAt: { gte: yesterdayStart, lt: yesterdaySameTime } },
      }),
      // batchComparison
      getPreviousBatchComparison(batch, now), 
      // todayOrders
      prisma.order.findMany({
        where: { batchId: batch.id, createdAt: { gte: todayStart } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: TODAY_ORDERS_LIMIT,
        select: {
          id: true,
          resiThailand: true,
          status: true,
          createdAt: true,
          customer: { select: { name: true, identifier: true, phone: true } },
          _count: { select: { items: true } },
        },
      }),
      // attentionTotal
      prisma.order.count({ where: attentionWhere(batch.id) }),
      // attentionOrders
      prisma.order.findMany({
        where: attentionWhere(batch.id),
        orderBy: { createdAt: 'asc' }, // yang paling lama menunggu dulu
        take: ATTENTION_LIMIT,
        select: {
          id: true,
          resiThailand: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          customer: { select: { name: true, identifier: true, phone: true } },
          statusLogs: {
            orderBy: { changedAt: 'desc' },
            take: 1,
            select: { changedAt: true },
          },
        },
      }),
    // prisma.orderStatusLog.findMany({
    //   where: { order: { batchId: batch.id } },
    //   orderBy: { changedAt: 'desc' },
    //   take: RECENT_ACTIVITY_LIMIT,
    //   select: {
    //     id: true,
    //     fromStatus: true,
    //     toStatus: true,
    //     // isCorrection: true,
    //     changedAt: true,
    //     changedBy: { select: { name: true } },
    //     order: { select: { id: true, resiThailand: true } },
    //   },
    // }),
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
    comparison: {
    totalOrders: {
      current: totalOrders,
      previous: batchComparison.previous, // null = belum ada batch sebelumnya
      elapsedDays: batchComparison.elapsedDays,
    },
    // "hari ini" priceless untuk batch yang sudah ditutup
    today:
      batch.status === 'active' ? { current: todayCount, previous: yesterdayCount } : null,
    },
    // recentActivity: recentLogs.map((log) => ({
    //   id: log.id,
    //   orderId: log.order.id,
    //   resi: log.order.resiThailand,
    //   fromStatus: log.fromStatus,
    //   toStatus: log.toStatus,
    //   // isCorrection: log.isCorrection,
    //   changedAt: log.changedAt,
    //   changedBy: log.changedBy?.name ?? null, // kosong = customer (form publik)
    // })),
    todayOrders: todayOrders.map((order) => ({
      id: order.id,
      resi: order.resiThailand,
      customerName: customerLabel(order.customer),
      itemCount: order._count.items,
      status: order.status,
      createdAt: order.createdAt,
    })),
    needsAttention: {
    total: attentionTotal,
    items: attentionOrders
      .map((order) => ({
        id: order.id,
        resi: order.resiThailand,
        customerName: customerLabel(order.customer),
        status: order.status,
        paymentStatus: order.paymentStatus,
        reason: order.status === 'ISSUE' ? 'ISSUE' : 'HOLD',
        // Waktu status terakhir berubah. Untuk Hold ini pendekatan: belum ada log kapan Hold mulai.
        since: order.statusLogs[0]?.changedAt ?? order.createdAt,
      }))
      // Issue di atas Hold, di dalam tiap kelompok tetap urut yang terlama
      .sort((a, b) => (a.reason === b.reason ? 0 : a.reason === 'ISSUE' ? -1 : 1)),
  },
  };
};