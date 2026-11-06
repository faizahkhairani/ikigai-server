import prisma from '../lib/prisma.js';
import { normalizePhone } from '../utils/normalizePhone.js';

export const findCustomersForAdmin = async ({ search, page, pageSize }) => {
  // Admin ngetik 0812..., di database tersimpan 62812...
  const digits = search ? search.replace(/\D/g, '') : '';
  const phoneQuery = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          ...(phoneQuery ? [{ phone: { contains: phoneQuery } }] : []),
        ],
      }
    : {};

  const [customers, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        createdAt: true,
        _count: { select: { orders: true } },
        // cukup order terbaru buat kolom "Order terakhir"
        orders: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers, total };
};

export const getCustomerDetail = (customerId) =>
  prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          resiThailand: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          batch: { select: { name: true } },
          _count: { select: { items: true } },
        },
      },
    },
  });

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

export const updateCustomer = async (customerId, { name, phone, address }) => {
  try {
    return await prisma.customer.update({
      where: { id: customerId },
      data: { name, phone: normalizePhone(phone), address },
      select: { id: true, name: true, phone: true, address: true },
    });
  } catch (err) {
    if (err.code === 'P2025') throw httpError(404, 'Customer tidak ditemukan');
    if (err.code === 'P2002') throw httpError(409, 'No WA sudah dipakai customer lain');
    throw err;
  }
};

// Hanya customer tanpa order yang boleh dihapus
export const deleteCustomer = async (customerId) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { _count: { select: { orders: true } } },
  });
  if (!customer) throw httpError(404, 'Customer tidak ditemukan');

  const orderCount = customer._count.orders;
  if (orderCount > 0) {
    throw httpError(409, `Customer punya ${orderCount} order dan tidak bisa dihapus`);
  }

  try {
    await prisma.customer.delete({ where: { id: customerId } });
  } catch (err) {
    // Order baru masuk di antara pengecekan dan penghapusan
    if (err.code === 'P2003') throw httpError(409, 'Customer punya order dan tidak bisa dihapus');
    throw err;
  }
};  