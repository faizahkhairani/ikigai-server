// Nama, identifier, dan no WA semuanya bisa kosong: pakai yang pertama terisi
export const customerLabel = ({ name, identifier, phone }) => name ?? identifier ?? phone ?? '-';
