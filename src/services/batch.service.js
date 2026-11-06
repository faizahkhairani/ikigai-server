import prisma from '../lib/prisma.js';

export const listBatches = () => prisma.batch.findMany({ orderBy: { createdAt: 'desc' } });

export const openNewBatch = async ({ name, startDate, endDate, quota }) => {
  const existingActive = await prisma.batch.findFirst({ where: { status: 'active' } });
  if (existingActive) {
    const error = new Error(
      `Batch "${existingActive.name}" masih aktif. Tutup dulu sebelum buat batch baru.`
    );
    error.statusCode = 400;
    throw error;
  }

  return prisma.batch.create({
    data: { name, startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null, quota: quota ? Number(quota) : null  },
  });
};

export const closeBatch = (batchId) =>
  prisma.batch.update({
    where: { id: batchId },
    data: { status: 'closed', closedAt: new Date() },
  });

// Buka kembali batch yang sudah ditutup. Aturan satu batch aktif tetap berlaku.
export const reopenBatch = async (batchId) => {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    const error = new Error('Batch tidak ditemukan');
    error.statusCode = 404;
    throw error;
  }
  if (batch.status === 'active') {
    const error = new Error('Batch ini sudah aktif');
    error.statusCode = 400;
    throw error;
  }

  const active = await prisma.batch.findFirst({ where: { status: 'active' } });
  if (active) {
    const error = new Error(
      `Batch "${active.name}" masih aktif. Tutup dulu sebelum membuka batch lain.`
    );
    error.statusCode = 409;
    throw error;
  }

  try {
    return await prisma.batch.update({
      where: { id: batchId },
      data: { status: 'active', closedAt: null },
    });
  } catch (err) {
    // Dua request barengan: yang kalah ditolak index database
    if (err.code === 'P2002') {
      const error = new Error('Sudah ada batch aktif. Tutup dulu sebelum membuka batch lain.');
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }
};
