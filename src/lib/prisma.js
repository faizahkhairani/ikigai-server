import { PrismaClient } from '@prisma/client';

// Singleton pattern — hindari bikin banyak koneksi PrismaClient
// saat hot-reload di development (nodemon restart berkali-kali)
const prisma = new PrismaClient();

export default prisma;
