import { createClient } from '@supabase/supabase-js';
import prisma from '../lib/prisma.js';

// client stateless, nggak nyimpen session di memori server
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const findAdmin = (id) =>
  prisma.admin.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true } });

export const authService = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) return { error: 'Email atau password salah', status: 401 };

    const admin = await findAdmin(data.user.id);
    if (!admin) return { error: 'Akun ini bukan admin', status: 403 };

    return { session: data.session, admin };
  },

  async refresh(refreshToken) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return { error: 'Sesi berakhir', status: 401 };
    return { session: data.session };
  },

  async verify(accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return findAdmin(data.user.id); // null kalau bukan admin
  },
};