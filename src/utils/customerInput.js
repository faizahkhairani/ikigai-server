import { ORDER_LIMITS, PHONE_PATTERN } from './orderInput.js';

const ADDRESS_MAX = 300;

// Balikin { error } atau { data } yang sudah dibersihkan
export const parseCustomerInput = (raw) => {
  const { name, phone, address } = raw ?? {};

  if (typeof name !== 'string' || !name.trim() || name.trim().length > ORDER_LIMITS.name) {
    return { error: `Nama wajib diisi (maksimal ${ORDER_LIMITS.name} karakter)` };
  }
  if (typeof phone !== 'string' || !PHONE_PATTERN.test(phone.trim())) {
    return { error: 'Format no WA tidak valid' };
  }
  const cleanAddress = typeof address === 'string' ? address.trim() : '';
  if (cleanAddress.length > ADDRESS_MAX) {
    return { error: `Alamat maksimal ${ADDRESS_MAX} karakter` };
  }

  return {
    data: { name: name.trim(), phone: phone.trim(), address: cleanAddress || null },
  };
};