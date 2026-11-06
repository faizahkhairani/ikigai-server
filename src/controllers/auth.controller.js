import * as authService from '../services/auth.service.js';

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi' });
  }

  const result = await authService.loginAdmin(email, password);
  if (result.error) return res.status(401).json({ error: result.error });

  return res.json(result);
};
