import { normalizeIdentifier } from './normalizeIdentifier.js';

export const ORDER_LIMITS = {
  name: 100,
  identifier: 50,
  resi: 50,
  itemName: 100,
  itemNote: 200,
  maxItems: 30,
  maxQty: 999,
};

export const PHONE_PATTERN = /^\+?[\d\s-]{9,15}$/;

const isFilledText = (value, max) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

const toText = (value) => (typeof value === 'string' ? value : '');

// Kontak customer: semua opsional, tapi minimal identifier atau no WA harus ada.
// Yang kosong jadi undefined, bukan "", supaya tidak bentrok di unique index.
export const parseContact = (raw) => {
  const name = toText(raw?.name).trim();
  const identifier = normalizeIdentifier(toText(raw?.identifier));
  const phone = toText(raw?.phone).trim();

  if (!identifier && !phone) {
    return { error: 'Isi minimal salah satu: identifier atau no WA' };
  }
  if (name.length > ORDER_LIMITS.name) {
    return { error: `Nama maksimal ${ORDER_LIMITS.name} karakter` };
  }
  if (identifier.length > ORDER_LIMITS.identifier) {
    return { error: `Identifier maksimal ${ORDER_LIMITS.identifier} karakter` };
  }
  if (phone && !PHONE_PATTERN.test(phone)) {
    return { error: 'Format no WA tidak valid' };
  }

  return {
    data: {
      name: name || undefined,
      identifier: identifier || undefined,
      phone: phone || undefined,
    },
  };
};

// Resi dan barang: aturannya sama untuk form publik dan input manual admin
const parseOrderBody = (raw) => {
  const { resiThailand, items } = raw ?? {};

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
      resiThailand: resiThailand.trim(),
      items: cleanItems,
    },
  };
};

// Balikin { error } atau { data } yang sudah dibersihkan.
// Form publik: customer cuma isi identifier, nama dan no WA diabaikan.
export const parsePublicOrderInput = (raw) => {
  const identifier = normalizeIdentifier(toText(raw?.identifier));
  if (!isFilledText(identifier, ORDER_LIMITS.identifier)) {
    return {
      error: `Username WA / X / IG wajib diisi (maksimal ${ORDER_LIMITS.identifier} karakter)`,
    };
  }

  const { data, error } = parseOrderBody(raw);
  return error ? { error } : { data: { identifier, ...data } };
};

// Input manual admin
export const parseManualOrderInput = (raw) => {
  const contact = parseContact(raw);
  if (contact.error) return { error: contact.error };

  const { data, error } = parseOrderBody(raw);
  return error ? { error } : { data: { ...contact.data, ...data } };
};
