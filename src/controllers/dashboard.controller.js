import * as dashboardService from '../services/dashboard.service.js';
import { toOptionalString } from '../utils/queryParams.js';

// GET /api/admin/dashboard?batchId=
export const getDashboard = async (req, res) => {
  try {
    const summary = await dashboardService.getDashboardSummary(toOptionalString(req.query.batchId));
    return res.json(summary);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};