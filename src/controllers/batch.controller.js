import * as batchService from '../services/batch.service.js';

export const listBatches = async (req, res) => {
  const batches = await batchService.listBatches();
  return res.json({ batches });
};

export const openBatch = async (req, res) => {
  try {
    const batch = await batchService.openNewBatch(req.body);
    return res.status(201).json({ batch });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

export const closeBatch = async (req, res) => {
  const batch = await batchService.closeBatch(req.params.id);
  return res.json({ batch });
};

// PATCH /api/admin/batches/:id/open
export const reopenBatch = async (req, res) => {
  try {
    const batch = await batchService.reopenBatch(req.params.id);
    return res.json({ batch });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};
