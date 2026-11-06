import 'dotenv/config';
import net from 'node:net';
import prisma from '../src/lib/prisma.js';

const { hostname, port } = new URL(process.env.DATABASE_URL);

// 1. Waktu bikin koneksi TCP saja (kira-kira 1x pulang-pergi jaringan)
const tcpTimes = [];
for (let i = 0; i < 3; i++) {
  const start = performance.now();
  await new Promise((resolve, reject) => {
    const socket = net.connect({ host: hostname, port: Number(port) }, () => {
      socket.end();
      resolve();
    });
    socket.on('error', reject);
  });
  tcpTimes.push(Math.round(performance.now() - start));
}
console.log('TCP connect:', tcpTimes.map((t) => `${t}ms`).join(', '));

// 2. Query ringan berulang
for (let i = 1; i <= 6; i++) {
  const start = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  console.log(`SELECT 1 #${i}: ${Math.round(performance.now() - start)}ms`);
}

await prisma.$disconnect();