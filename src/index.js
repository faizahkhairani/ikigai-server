import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import orderRoutes from './routes/order.routes.js';
import trackRoutes from './routes/track.routes.js';
import batchRoutes from './routes/batch.routes.js';
import adminOrderRoutes from './routes/admin-order.routes.js';
import adminRoutes from './routes/admin.routes.js'; 
import customerRoutes from './routes/customer.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use((req, res, next) => {
  req.body ??= {}; 
  next();
});

// api fetch data admin
app.use('/api/admin', adminRoutes);

// Public routes — tidak ada auth, diakses langsung dari customer
app.use('/api/orders', orderRoutes);
app.use('/api/track', trackRoutes);

// Admin routes — requireAdminAuth dipasang di dalam masing-masing route file
app.use('/api/admin/batches', batchRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);

app.use('/api/admin/customers', customerRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.json({ status: 'ok' }));

// 404 untuk endpoint yang tidak ada
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const status = err.statusCode ?? err.status ?? 500;
  if (status < 500) {
    const message =
      err.type === 'entity.parse.failed' ? 'Format JSON tidak valid' : err.message;
    return res.status(status).json({ error: message });
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  return res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});


app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Ikigai server jalan di http://localhost:${PORT}`);
});
