// Prisma tidak meng-escape wildcard LIKE di contains/startsWith. Tanpa ini "_" (umum di username)
// cocok ke karakter apa pun, dan "%" cocok ke semua data.
export const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');
