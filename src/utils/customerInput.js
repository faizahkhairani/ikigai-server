import { parseContact } from './orderInput.js';

const ADDRESS_MAX = 300;

// Balikin { error } atau { data } yang sudah dibersihkan
export const parseCustomerInput = (raw) => {
  const { data: contact, error } = parseContact(raw);
  if (error) return { error };

  const { address } = raw ?? {};
  const cleanAddress = typeof address === 'string' ? address.trim() : '';
  if (cleanAddress.length > ADDRESS_MAX) {
    return { error: `Alamat maksimal ${ADDRESS_MAX} karakter` };
  }

  return { data: { ...contact, address: cleanAddress || undefined } };
};
