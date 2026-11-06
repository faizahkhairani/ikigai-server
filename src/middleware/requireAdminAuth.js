import { createClient } from '@supabase/supabase-js';
import prisma from '../lib/prisma.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

const ADMIN_CACHE_TTL_MS = 60_000;
const adminCache = new Map(); // userId -> { admin, expiresAt }

// Pengecekan tabel admins dengan cache pendek di memori. Hanya hasil "ada" yang disimpan,
// jadi admin baru langsung bisa masuk.
const findAdmin = async (userId) => {
  const cached = adminCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.admin;

  const admin = await prisma.admin.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (admin) adminCache.set(userId, { admin, expiresAt: Date.now() + ADMIN_CACHE_TTL_MS });
  return admin;
};

// Verify JWT yang di-generate Supabase Auth 
const requireAdminAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' });
  }

  // harus terdaftar di tabel admins
  const admin = await findAdmin(data.user.id);
  if (!admin) return res.status(403).json({ error: 'Akun ini bukan admin' });

  req.adminUser = { id: admin.id, email: admin.email };
  next();
};

export default requireAdminAuth;