import * as adminService from '../services/admin.service.js'

export const getMe = async (req, res) => {
  try {
  const admin = await adminService.getAdminProfile(req.adminUser.id);
  if (!admin) return res.status(404).json({ error: 'Data admin tidak ditemukan' });
  return res.json({ admin });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error" });
  }
};