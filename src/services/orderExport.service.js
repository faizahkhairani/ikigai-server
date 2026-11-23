import ExcelJS from 'exceljs';
import prisma from '../lib/prisma.js';

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000; // WIB

// Excel nggak kenal timezone: geser ke WIB dulu biar jam yang tampil sesuai jam Indonesia
const toJakartaDate = (date) => (date ? new Date(date.getTime() + JAKARTA_OFFSET_MS) : null);

// "2026-11-23" dalam WIB, dipakai untuk nama file
export const jakartaDateStamp = (now = new Date()) =>
  toJakartaDate(now).toISOString().slice(0, 10);

const DATE_FORMAT = 'yyyy-mm-dd hh:mm';
const TEXT_FORMAT = '@'; // format "Text": nol di depan (0812..., resi) tidak hilang

// Kolom sama untuk semua sheet batch
const ORDER_COLUMNS = [
  { header: 'ID Order', key: 'id', width: 38, text: true },
  { header: 'Tracking Token', key: 'trackingToken', width: 16, text: true },
  { header: 'Resi Thailand', key: 'resiThailand', width: 22, text: true },
  { header: 'Tipe Order', key: 'orderType', width: 16 },
  { header: 'Status', key: 'status', width: 20 },
  { header: 'Pembayaran', key: 'paymentStatus', width: 12 },
  { header: 'Hold', key: 'isHeld', width: 8 },
  { header: 'Alasan Hold', key: 'holdReason', width: 24 },
  { header: 'ID Customer', key: 'customerId', width: 38, text: true },
  { header: 'Nama', key: 'customerName', width: 22 },
  { header: 'Identifier', key: 'identifier', width: 20, text: true },
  { header: 'No WA', key: 'noWa', width: 18, text: true },
  { header: 'Alamat', key: 'address', width: 40 },
  { header: 'Barang', key: 'items', width: 50 },
  { header: 'Total Qty', key: 'totalQty', width: 10 },
  { header: 'Dibuat', key: 'createdAt', width: 18, date: true },
  { header: 'Diupdate', key: 'updatedAt', width: 18, date: true },
];

// Excel: maks 31 karakter, tanpa \ / ? * [ ] :, dan nama sheet harus unik (case-insensitive)
const makeSheetName = (rawName, usedNames) => {
  const base = (rawName || 'Tanpa Nama').replace(/[\\/?*[\]:]/g, '-').trim().slice(0, 31) || 'Batch';
  let name = base;
  for (let i = 2; usedNames.has(name.toLowerCase()); i += 1) {
    const suffix = ` (${i})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  usedNames.add(name.toLowerCase());
  return name;
};

const formatItems = (items) =>
  items
    .map((item) => `${item.name} x${item.qty}${item.note ? ` (${item.note})` : ''}`)
    .join('; ');

const toRow = (order) => ({
  id: order.id,
  trackingToken: order.trackingToken,
  resiThailand: order.resiThailand,
  orderType: order.orderType,
  status: order.status,
  paymentStatus: order.paymentStatus,
  isHeld: order.isHeld ? 'Ya' : 'Tidak',
  holdReason: order.holdReason ?? '',
  customerId: order.customer.id,
  customerName: order.customer.name ?? '',
  identifier: order.customer.identifier ?? '',
  noWa: order.customer.phone ?? '',
  address: order.customer.address ?? '',
  items: formatItems(order.items),
  totalQty: order.items.reduce((sum, item) => sum + item.qty, 0),
  createdAt: toJakartaDate(order.createdAt),
  updatedAt: toJakartaDate(order.updatedAt),
});

const styleHeader = (sheet) => {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
};

const addOrderSheet = (workbook, name, orders) => {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = ORDER_COLUMNS.map(({ header, key, width, text, date }) => ({
    header,
    key,
    width,
    style: text ? { numFmt: TEXT_FORMAT } : date ? { numFmt: DATE_FORMAT } : undefined,
  }));
  styleHeader(sheet);

  for (const order of orders) {
    const row = sheet.addRow(toRow(order));
    // Pastikan kolom teks benar-benar disimpan sebagai string, bukan angka
    for (const { key, text } of ORDER_COLUMNS) {
      if (!text) continue;
      const cell = row.getCell(key);
      cell.value = cell.value == null ? '' : String(cell.value);
      cell.numFmt = TEXT_FORMAT;
    }
  }
  return sheet;
};

// Dipisah dari query biar bisa dites tanpa database
export const buildWorkbook = ({ batches, orders, now }) => {
  const ordersByBatch = new Map(batches.map((batch) => [batch.id, []]));
  for (const order of orders) ordersByBatch.get(order.batchId)?.push(order);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ikigai Management';
  workbook.created = now;

  const usedNames = new Set();

  // Sheet 1: Ringkasan
  const summary = workbook.addWorksheet(makeSheetName('Ringkasan', usedNames));
  summary.columns = [
    { header: 'Batch', key: 'name', width: 24 },
    { header: 'Nama Sheet', key: 'sheet', width: 24 },
    { header: 'Status Batch', key: 'status', width: 14 },
    { header: 'Tanggal Mulai', key: 'startDate', width: 18, style: { numFmt: DATE_FORMAT } },
    { header: 'Jumlah Order', key: 'count', width: 14 },
  ];
  styleHeader(summary);

  // Sheet per batch
  for (const batch of batches) {
    const batchOrders = ordersByBatch.get(batch.id);
    const sheetName = makeSheetName(batch.name, usedNames);
    addOrderSheet(workbook, sheetName, batchOrders);
    summary.addRow({
      name: batch.name,
      sheet: sheetName,
      status: batch.status,
      startDate: toJakartaDate(batch.startDate),
      count: batchOrders.length,
    });
  }

  summary.addRow({});
  const totalRow = summary.addRow({ name: 'Total Order', count: orders.length });
  totalRow.font = { bold: true };
  const exportRow = summary.addRow({ name: 'Tanggal Export', sheet: toJakartaDate(now) });
  exportRow.getCell('sheet').numFmt = DATE_FORMAT;
  exportRow.font = { bold: true };

  return workbook;
};

export const buildOrdersBackupWorkbook = async (now = new Date()) => {
  const [batches, orders] = await prisma.$transaction([
    prisma.batch.findMany({ orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }] }),
    prisma.order.findMany({
      include: { customer: true, items: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);
  return buildWorkbook({ batches, orders, now });
};
