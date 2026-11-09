import { authService } from '../services/auth.service.js';

const isProd = process.env.NODE_ENV === 'production';

const cookieBase = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax', // 'none' cuma kalau frontend & backend beda domain
};

const setSessionCookies = (res, session) => {
  res.cookie('access_token', session.access_token, {
    ...cookieBase,
    path: '/',
    maxAge: session.expires_in * 1000,
  });
  res.cookie('refresh_token', session.refresh_token, {
    ...cookieBase,
    path: '/api/auth', // cuma dikirim ke endpoint auth
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });

    const result = await authService.login(email, password);
    if (result.error) return res.status(result.status).json({ error: result.error });

    setSessionCookies(res, result.session);
    res.json({ admin: result.admin });
  } catch (err) { next(err); }
};

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies.refresh_token;
    if (!token) return res.status(401).json({ error: 'Tidak ada sesi' });

    const result = await authService.refresh(token);
    if (result.error) return res.status(result.status).json({ error: result.error });

    setSessionCookies(res, result.session); // refresh token ikut rotate
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const logout = (req, res) => {
  res.clearCookie('access_token', { ...cookieBase, path: '/' });
  res.clearCookie('refresh_token', { ...cookieBase, path: '/api/auth' });
  res.json({ ok: true });
};

export const me = (req, res) => res.json({ admin: req.adminUser });