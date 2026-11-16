import prisma from '../lib/prisma.js';
import { invalidateBatchCache } from './dashboard.service.js';

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

  try {
    const batch = await prisma.batch.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        quota: quota ? Number(quota) : null,
      },
    });
    invalidateBatchCache();
    return batch;
  } catch (err) {
    // Dua request barengan: yang kalah ditolak index database
    if (err.code === 'P2002') {
      const error = new Error('Sudah ada batch aktif. Tutup dulu sebelum buat batch baru.');
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }
};

export const closeBatch = async (batchId) => {
  const result = await prisma.batch.update({
    where: { id: batchId },
    data: { status: 'closed', closedAt: new Date() },
  });
  invalidateBatchCache();
  return result;
};

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
    const result = await prisma.batch.update({
      where: { id: batchId },
      data: { status: 'active', closedAt: null },
    });
    invalidateBatchCache();
    return result;
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