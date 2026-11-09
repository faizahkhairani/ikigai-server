import { authService } from '../services/auth.service.js';

const requireAdminAuth = async (req, res, next) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json({ error: 'Belum login' });

    const admin = await authService.verify(token);
    if (!admin) return res.status(401).json({ error: 'Sesi tidak valid atau bukan admin' });

    req.adminUser = admin;
    next();
  } catch (err) { next(err); }
};

export default requireAdminAuth;