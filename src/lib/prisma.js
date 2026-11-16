import { PrismaClient } from '@prisma/client';

// Singleton pattern — hindari bikin banyak koneksi PrismaClient
// saat hot-reload di development (nodemon restart berkali-kali)
const prisma = new PrismaClient({
  log: [{ emit: 'event', level: 'query' }],
});
prisma.$on('query', (e) => console.log(`${e.duration}ms | ${e.query.slice(0, 80)}`));

export default prisma;
