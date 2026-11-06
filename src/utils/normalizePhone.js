// "08123456789" atau "+628123456789" -> "628123456789"
export const normalizePhone = (phone) => {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.startsWith('0')) return `62${digitsOnly.slice(1)}`;
  if (digitsOnly.startsWith('62')) return digitsOnly;
  return `62${digitsOnly}`;
};
