import net from 'node:net';

const targets = [
  { name: 'Cloudflare (acuan jaringan umum)', host: '1.1.1.1', port: 443 },
  { name: 'AWS Singapore', host: 'dynamodb.ap-southeast-1.amazonaws.com', port: 443 },
  { name: 'AWS Sydney', host: 'dynamodb.ap-southeast-2.amazonaws.com', port: 443 },
];

const connectTime = (host, port) =>
  new Promise((resolve, reject) => {
    const start = performance.now();
    const socket = net.connect({ host, port }, () => {
      const ms = Math.round(performance.now() - start);
      socket.end();
      resolve(ms);
    });
    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
    socket.on('error', reject);
  });

for (const target of targets) {
  const times = [];
  for (let i = 0; i < 3; i++) {
    try {
      times.push(`${await connectTime(target.host, target.port)}ms`);
    } catch (err) {
      times.push(err.message);
    }
  }
  console.log(`${target.name}: ${times.join(', ')}`);
}