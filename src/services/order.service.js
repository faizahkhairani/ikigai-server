import { nanoid } from 'nanoid';
import prisma from '../lib/prisma.js';
import { normalizePhone } from '../utils/normalizePhone.js';
import { normalizeResi } from '../utils/normalizeResi.js';
import {
  deleteProofImageFile,
  deleteResiImageFile,
  getResiImageSignedUrl,
  uploadProofImage,
  uploadResiImage,
} from '../lib/supabaseStorage.js';
import { getPresetStart } from '../utils/dates.js';
import { normalizeIdentifier } from '../utils/normalizeIdentifier.js';
import { escapeLike } from '../utils/escapeLike.js';
import supabaseAdmin from '../lib/supabaseStorage.js';


const PAYMENT_GATE_STATUSES = ['READY_TO_SHIP', 'SHIPPED', 'COMPLETED'];
const PAYMENT_LOCKED_STATUSES = ['COMPLETED'];

const STATUS_PIPELINE = [
  'WAITING',
  'ARRIVED_THAILAND',
  'ARRIVED_INDONESIA',
  'SORTING',
  'PACKING_QUEUE',
  'PACKING',
  'READY_TO_SHIP',
  'SHIPPED',
  'COMPLETED',
];

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED']; // sudah final

const isValidTransition = (fromStatus, toStatus) => {
  if (TERMINAL_STATUSES.includes(fromStatus)) return false;
  if (toStatus === 'CANCELLED') return true;
  if (toStatus === 'ISSUE') return fromStatus !== 'ISSUE';

  const fromIndex = STATUS_PIPELINE.indexOf(fromStatus);
  const toIndex = STATUS_PIPELINE.indexOf(toStatus);
  if (fromIndex === -1 || toIndex === -1) return false; // termasuk dari ISSUE ke pipeline

  return toIndex === fromIndex + 1; // maju tepat 1 langkah
};

const BULK_CHUNK_SIZE = 10;

// Jalankan handler per kelompok, bukan semua sekaligus, biar koneksi database tidak kehabisan.
// Urutan hasil sama dengan urutan ids.
const runInChunks = async (ids, handler) => {
  const results = [];
  for (let i = 0; i < ids.length; i += BULK_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + BULK_CHUNK_SIZE);
    results.push(...(await Promise.all(chunk.map(handler))));
  }
  return results;
};

// Tolak lebih awal kalau resi sudah dipakai order lain
const assertResiAvailable = async (resiThailand) => {
  const existing = await prisma.order.findUnique({ where: { resiThailand } });
  if (existing) {
    const error = new Error('No resi sudah terdaftar');
    error.statusCode = 409;
    throw error;
  }
};

const conflictError = (message) => Object.assign(new Error(message), { statusCode: 409 });

// Form publik: identifier satu-satunya kunci
const findOrCreateCustomerByIdentifier = (identifier) =>
  prisma.customer.upsert({
    where: { identifier },
    // Sengaja tidak kosong: dengan update {} Prisma tidak memakai ON CONFLICT, dan dua order
    // pertama yang masuk barengan bisa gagal di unique constraint
    update: { identifier },
    create: { identifier },
  });

// Input manual: identifier dan/atau no WA. Kunci yang masih kosong di customer lama dilengkapi,
// tapi kunci yang sudah terisi tidak pernah ditimpa dari sini (ubahnya lewat Edit customer).
const findOrCreateCustomerByContact = async ({ name, identifier, phone: rawPhone }) => {
  const phone = rawPhone ? normalizePhone(rawPhone) : undefined;

  const [byIdentifier, byPhone] = await Promise.all([
    identifier ? prisma.customer.findUnique({ where: { identifier } }) : null,
    phone ? prisma.customer.findUnique({ where: { phone } }) : null,
  ]);

  if (byIdentifier && byPhone && byIdentifier.id !== byPhone.id) {
    throw conflictError('Identifier dan no WA terdaftar di dua customer yang berbeda');
  }

  const existing = byIdentifier ?? byPhone;
  if (identifier && existing?.identifier && existing.identifier !== identifier) {
    throw conflictError(`No WA ini sudah terdaftar dengan identifier "${existing.identifier}"`);
  }
  if (phone && existing?.phone && existing.phone !== phone) {
    throw conflictError(`Identifier ini sudah terdaftar dengan no WA ${existing.phone}`);
  }

  // Yang undefined dilewati Prisma: tidak menimpa data lama, dan jadi NULL untuk customer baru
  const data = { name, identifier, phone };
  try {
    return existing
      ? await prisma.customer.update({ where: { id: existing.id }, data })
      : await prisma.customer.create({ data });
  } catch (err) {
    // Request lain membuat customer yang sama di antara pengecekan dan penyimpanan
    if (err.code === 'P2002') throw conflictError('Customer baru saja dibuat, coba simpan lagi');
    throw err;
  }
};

const getActiveBatchOrThrow = async () => {
  const activeBatch = await prisma.batch.findFirst({ where: { status: 'active' } });
  if (!activeBatch) {
    const error = new Error('Batch sedang ditutup, cek info terbaru di WA kami');
    error.statusCode = 400;
    throw error;
  }
  return activeBatch;
};

// export const createPublicOrder = async ({ name, phone, resiThailand, items, image }) => {
//   const resi = normalizeResi(resiThailand);
//   const activeBatch = await getActiveBatchOrThrow();
//   await assertResiAvailable(resi);

//     const resiImagePath = await uploadResiImage({
//     buffer: image.buffer,
//     mimeType: image.mimetype,
//   });

//   const customer = await findOrCreateCustomer({ name, phone, updateName: false });

//   return prisma.order.create({
//     data: {
//       trackingToken: nanoid(21),
//       customerId: customer.id,
//       batchId: activeBatch.id,
//       orderType: 'sharing_bagasi',
//       resiThailand: resi,
//       resiImagePath,
//       items: { create: items.map((i) => ({ name: i.name, qty: i.qty ?? 1, note: i.note })) },
//       statusLogs: { create: { toStatus: 'WAITING' } }, // fromStatus dan admin kosong = dibuat customer
//     },
//     include: { items: true },
//   });
// };

export const deleteResiImage = async (path) => {
  const { error } = await supabaseAdmin.storage.from('resi-images').remove([path]);
  if (error) throw error;
};

export const createPublicOrder = async ({ identifier, resiThailand, items, image }) => {
  const resi = normalizeResi(resiThailand);

  // Dua pengecekan ini tidak saling bergantung, jalan bersamaan
  const [activeBatch] = await Promise.all([
    getActiveBatchOrThrow(),
    assertResiAvailable(resi),
  ]);

  // Upload foto dan customer tidak saling bergantung, jalan bersamaan.
  // allSettled supaya kalau customer gagal tapi foto sudah masuk, fotonya masih bisa dihapus.
  const [uploadResult, customerResult] = await Promise.allSettled([
    uploadResiImage({
      buffer: image.buffer,
      mimeType: image.mimetype,
    }),
    findOrCreateCustomerByIdentifier(identifier),
  ]);

  if (uploadResult.status === 'rejected' || customerResult.status === 'rejected') {
    if (uploadResult.status === 'fulfilled') {
      await deleteResiImage(uploadResult.value).catch(() => {});
    }
    throw uploadResult.status === 'rejected' ? uploadResult.reason : customerResult.reason;
  }

  const resiImagePath = uploadResult.value;
  const customer = customerResult.value;

  try {
    return await prisma.order.create({
      data: {
        trackingToken: nanoid(21),
        customerId: customer.id,
        batchId: activeBatch.id,
        orderType: 'sharing_bagasi',
        resiThailand: resi,
        resiImagePath,
        items: { create: items.map((i) => ({ name: i.name, qty: i.qty ?? 1, note: i.note })) },
        statusLogs: { create: { toStatus: 'WAITING' } }, // fromStatus dan admin kosong = dibuat customer
      },
      include: { items: true },
    });
  } catch (err) {
    // Order gagal dibuat: hapus foto yang terlanjur terupload
    await deleteResiImage(resiImagePath).catch(() => {});
    if (err.code === 'P2002') {
      const error = new Error('No resi sudah terdaftar');
      error.statusCode = 409;
      throw error;
    }
  }
};

// Dipakai form publik buat nentuin tampilkan form atau pesan "batch ditutup"
export const getOrderAvailability = async () => {
  const batch = await prisma.batch.findFirst({
    where: { status: 'active' },
    select: { name: true },
  });
  return { isOpen: Boolean(batch), batchName: batch?.name ?? null };
};

// export const createManualOrder = async ({ name, phone, resiThailand, items, batchId, adminId }) => {
//   const resi = normalizeResi(resiThailand);
//   await assertResiAvailable(resi); 
//   const batch = batchId
//     ? await prisma.batch.findUniqueOrThrow({ where: { id: batchId } })
//     : await getActiveBatchOrThrow();

//   const customer = await findOrCreateCustomer({ name, phone, updateName: true });

//   return prisma.order.create({
//     data: {
//       trackingToken: nanoid(21),
//       customerId: customer.id,
//       batchId: batch.id,
//       orderType: 'wa',
//       resiThailand: resi,
//       // create ke table orderItems 
//       items: { create: items.map((i) => ({ name: i.name, qty: i.qty ?? 1, note: i.note })) },
//       statusLogs: { create: { toStatus: 'WAITING', changedById: adminId } }, // fromStatus dan admin kosong = dibuat customer
//     },
//     // mengembalikan data order dan customer 
//     include: { items: true, customer: true },
//   });
// };

export const createManualOrder = async ({
  name,
  identifier,
  phone,
  resiThailand,
  items,
  batchId,
  adminId,
}) => {
  const resi = normalizeResi(resiThailand);

  // Resi dicek dulu: kalau dobel, tolak sebelum customer dibuat atau namanya ditimpa
  await assertResiAvailable(resi);

  const [batch, customer] = await Promise.all([
    batchId
      ? prisma.batch.findUniqueOrThrow({ where: { id: batchId } })
      : getActiveBatchOrThrow(),
    findOrCreateCustomerByContact({ name, identifier, phone }),
  ]);

  try {
    return await prisma.order.create({
      data: {
        trackingToken: nanoid(21),
        customerId: customer.id,
        batchId: batch.id,
        orderType: 'wa',
        resiThailand: resi,
        // create ke table orderItems
        items: { create: items.map((i) => ({ name: i.name, qty: i.qty ?? 1, note: i.note })) },
        statusLogs: { create: { toStatus: 'WAITING', changedById: adminId } },
      },
      // mengembalikan data order dan customer
      include: { items: true, customer: true },
    });
  } catch (err) {
    // Dua request dengan resi sama masuk barengan: yang kalah ditolak constraint database
    if (err.code === 'P2002') {
      const error = new Error('No resi sudah terdaftar');
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }
};

const ORDER_TRACKING_SELECT = {
  trackingToken: true,
  resiThailand: true,
  status: true,
  paymentStatus: true,
  isHeld: true,
  holdReason: true,
  createdAt: true,
  customer: { select: { name: true, identifier: true } },
  items: { select: { id: true, name: true, qty: true, note: true } },
  statusLogs: { orderBy: { changedAt: 'asc' }, select: { toStatus: true, changedAt: true } },
  proofImages: { orderBy: { uploadedAt: 'asc' }, select: { id: true, imageUrl: true } },
};


export const getOrderByTrackingToken = (token) =>
  prisma.order.findUnique({ where: { trackingToken: token }, select: ORDER_TRACKING_SELECT });

const ORDER_TRACKING_LIST_SELECT = {
  trackingToken: true,
  resiThailand: true,
  status: true,
  createdAt: true,
  batch: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, identifier: true } },
  _count: { select: { items: true } },
};

const trackingWhere = ({ resi, phone, identifier }) => {
  if (resi) return { resiThailand: normalizeResi(resi) };
  if (phone) return { customer: { phone: normalizePhone(phone) } };
  // startsWith sudah termasuk yang persis sama; hasilnya boleh dari beberapa customer
  return { customer: { identifier: { startsWith: escapeLike(identifier) } } };
};

// identifier harus sudah dinormalisasi dan tidak kosong
export const findOrdersForTracking = async ({ resi, phone, identifier, page, pageSize }) => {
  const where = trackingWhere({ resi, phone, identifier });

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      select: ORDER_TRACKING_LIST_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
};

export const findOrdersForAdmin = async ({
  batchId,
  status,
  orderType,
  search,
  datePreset,
  page,
  pageSize,
}) => {
  const createdFrom = getPresetStart(datePreset);
  const identifierQuery = search ? normalizeIdentifier(search) : '';
  const where = {
    ...(batchId && { batchId }),
    ...(status && { status }),
    ...(orderType && { orderType }),
    ...(createdFrom && { createdAt: { gte: createdFrom } }),
    ...(search && {
      OR: [
        { resiThailand: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search } } },
        ...(identifierQuery
          ? [{ customer: { identifier: { contains: escapeLike(identifierQuery) } } }]
          : []),
      ],
    }),
  };

  // Dua query dijalankan bareng: potongan data halaman ini + total semua hasil filter
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: { customer: true, items: true, batch: { select: { id: true, name: true } } },
      // id sebagai pembeda kedua: tanpa ini, order dengan waktu sama bisa dobel/hilang antar halaman
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
};

export const transitionOrderStatus = async (orderId, newStatus, adminId) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { success: false, error: `Order ${orderId} tidak ditemukan` };

  // if (!isValidTransition(order.status, newStatus)) {
  //   return {
  //     success: false,
  //     error: `Order ${orderId} tidak dapat diubah dari "${order.status}" ke "${newStatus}" karena status harus mengikuti urutan proses.`,
  //   };
  // }

  if (newStatus === 'ARRIVED_THAILAND') {
    const proofCount = await prisma.proofImage.count({ where: { orderId } });
    if (proofCount === 0) {
      return { success: false, error: `Order ${orderId} belum punya foto bukti` };
    }
  }

  if (PAYMENT_GATE_STATUSES.includes(newStatus) && order.paymentStatus !== 'lunas') {
    await prisma.order.update({
      where: { id: orderId },
      data: { isHeld: true, holdReason: 'Menunggu pelunasan' },
    });
    return { success: false, error: `Order ${orderId} di-hold, payment belum lunas` };
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus, isHeld: false, holdReason: null },
    }),
    prisma.orderStatusLog.create({
      data: { orderId, fromStatus: order.status, toStatus: newStatus, changedById: adminId },
    }),
  ]);

  return { success: true };
};

export const correctOrderStatus = async (orderId, adminId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      statusLogs: { orderBy: { changedAt: 'asc' }, select: { fromStatus: true, toStatus: true } },
    },
  });
  if (!order) return { success: false, statusCode: 404, error: 'Order tidak ditemukan' };

  const target = getCorrectionTarget(order, order.statusLogs);
  if (!target) {
    return { success: false, statusCode: 400, error: 'Status order ini tidak bisa dikoreksi' };
  }

  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: target } }),
    prisma.orderStatusLog.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: target,
        changedById: adminId,
        isCorrection: true,
      },
    }),
  ]);

  return { success: true, status: target };
};

const toResiViewUrl = async (value) => {
  if (!value) return null;
  if (value.startsWith('http')) return value;
  return getResiImageSignedUrl(value);
};

export const getOrderDetail = async (orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      batch: { select: { id: true, name: true } },
      items: true,
      statusLogs: {
        orderBy: { changedAt: 'asc' },
        include: { changedBy: { select: { name: true } } },
      },
      proofImages: {
        orderBy: { uploadedAt: 'asc' },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if(!order) return null;
  
  const { resiImagePath, ...rest } = order;
  return { ...rest, resiImageUrl: await toResiViewUrl(resiImagePath), correctionTarget: getCorrectionTarget(order, order.statusLogs), };

}


export const attachProofImage = async ({ file, orderId, adminId }) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!order) {
    const error = new Error('Order tidak ditemukan');
    error.statusCode = 404;
    throw error;
  }
  const imageUrl = await uploadProofImage({
    buffer: file.buffer,
    mimeType: file.mimetype,
  });

  await prisma.proofImage.create({
    data: { imageUrl, orderId, uploadedById: adminId },
  });

  let statusFailed = false;
  if (order.status === 'WAITING') {
    const result = await transitionOrderStatus(orderId, 'ARRIVED_THAILAND', adminId);
    statusFailed = !result.success;
  }

  return { imageUrl, statusFailed };
};

export const bulkTransitionOrderStatus = async (orderIds, newStatus, adminId) => {
  const results = await runInChunks(orderIds, (id) =>
    transitionOrderStatus(id, newStatus, adminId)
  );
  const failed = results
    .map((r, i) => ({ ...r, orderId: orderIds[i] }))
    .filter((r) => !r.success);

  return { updatedCount: results.length - failed.length, failed };
};

const PAYMENT_STATUSES = ['unpaid', 'dp', 'lunas'];

export const updatePaymentStatus = async (orderId, newPaymentStatus) => {
  if (!PAYMENT_STATUSES.includes(newPaymentStatus)) {
    return { success: false, error: `Payment status "${newPaymentStatus}" tidak valid` };
  }

  
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { success: false, error: `Order ${orderId} tidak ditemukan` };
  
  if (PAYMENT_LOCKED_STATUSES.includes(order.status)) {
    return {
      success: false,
      error: `Order ${orderId} pembayaran tidak dapat diubah karena status order ${order.status}`,
    };
  }
  const shouldReleaseHold = newPaymentStatus === 'lunas' && order.isHeld && order.holdReason === 'Menunggu pelunasan';

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: newPaymentStatus,
      ...(shouldReleaseHold && { isHeld: false, holdReason: null }),
    },
  });

  return { success: true };
};

export const bulkUpdatePaymentStatus = async (orderIds, newPaymentStatus) => {
  const results = await runInChunks(orderIds, (id) =>
    updatePaymentStatus(id, newPaymentStatus)
  );
  const failed = results
    .map((r, i) => ({ ...r, orderId: orderIds[i] }))
    .filter((r) => !r.success);

  return { updatedCount: results.length - failed.length, failed };
};

const getCorrectionTarget = (order, statusLogs) => {
  if (order.status === 'ISSUE') {
    // kembali ke status sebelum ditandai Issue
    const issueLog = [...statusLogs].reverse().find((log) => log.toStatus === 'ISSUE');
    return issueLog?.fromStatus ?? null;
  }
  if (TERMINAL_STATUSES.includes(order.status)) return null;

  const index = STATUS_PIPELINE.indexOf(order.status);
  return index > 0 ? STATUS_PIPELINE[index - 1] : null;
};

export const deleteProofImage = async ({ orderId, imageId }) => {
  const image = await prisma.proofImage.findFirst({
    where: { id: imageId, orderId },
    include: { order: { select: { status: true } } },
  });
  if (!image) return { success: false, statusCode: 404, error: 'Foto tidak ditemukan' };

  const photoCount = await prisma.proofImage.count({ where: { orderId } });
  if (photoCount <= 1 && image.order.status !== 'WAITING') {
    return {
      success: false,
      statusCode: 400,
      error:
        'Foto terakhir tidak bisa dihapus karena order sudah melewati Arrived Thailand. ' +
        'Unggah foto pengganti dulu, atau koreksi status order.',
    };
  }

  // Database dulu, baru file: kalau hapus file gagal, order tetap konsisten
  await prisma.proofImage.delete({ where: { id: imageId } });
  await deleteProofImageFile(image.imageUrl);

  return { success: true };
};

// Ganti (atau tambah, untuk order manual yang belum punya) foto resi dari customer
export const replaceResiImage = async ({ orderId, file }) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, resiImagePath: true },
  });
  if (!order) return { success: false, statusCode: 404, error: 'Order tidak ditemukan' };

  // Urutan: file baru, simpan path baru, baru hapus file lama
  const newPath = await uploadResiImage({ buffer: file.buffer, mimeType: file.mimetype });
  await prisma.order.update({ where: { id: orderId }, data: { resiImagePath: newPath } });
  if (order.resiImagePath) await deleteResiImageFile(order.resiImagePath);

  return { success: true };
};


