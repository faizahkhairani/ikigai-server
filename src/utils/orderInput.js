export const ORDER_LIMITS = {
  name: 100,
  resi: 50,
  itemName: 100,
  itemNote: 200,
  maxItems: 30,
  maxQty: 999,
};

export const PHONE_PATTERN = /^\+?[\d\s-]{9,15}$/;

const isFilledText = (value, max) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

// Balikin { error } atau { data } yang sudah dibersihkan (di-trim).
// Dipakai form publik dan input manual admin, jadi aturannya satu.
export const parseOrderInput = (raw) => {
  const { name, phone, resiThailand, items } = raw ?? {};

  if (!isFilledText(name, ORDER_LIMITS.name)) {
    return { error: `Nama wajib diisi (maksimal ${ORDER_LIMITS.name} karakter)` };
  }
  if (typeof phone !== 'string' || !PHONE_PATTERN.test(phone.trim())) {
    return { error: 'Format no WA tidak valid' };
  }
  if (!isFilledText(resiThailand, ORDER_LIMITS.resi)) {
    return { error: `No resi wajib diisi (maksimal ${ORDER_LIMITS.resi} karakter)` };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Minimal 1 barang' };
  }
  if (items.length > ORDER_LIMITS.maxItems) {
    return { error: `Maksimal ${ORDER_LIMITS.maxItems} barang per order` };
  }

  const cleanItems = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') return { error: 'Data barang tidak valid' };

    if (!isFilledText(item.name, ORDER_LIMITS.itemName)) {
      return { error: `Nama barang wajib diisi (maksimal ${ORDER_LIMITS.itemName} karakter)` };
    }
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > ORDER_LIMITS.maxQty) {
      return { error: `Jumlah barang harus 1 sampai ${ORDER_LIMITS.maxQty}` };
    }
    const note = typeof item.note === 'string' ? item.note.trim() : '';
    if (note.length > ORDER_LIMITS.itemNote) {
      return { error: `Catatan maksimal ${ORDER_LIMITS.itemNote} karakter` };
    }

    cleanItems.push({ name: item.name.trim(), qty: item.qty, note: note || undefined });
  }

  return {
    data: {
      name: name.trim(),
      phone: phone.trim(),
      resiThailand: resiThailand.trim(),
      items: cleanItems,
    },
  };
};