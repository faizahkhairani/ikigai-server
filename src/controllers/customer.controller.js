import * as customerService from '../services/customer.service.js';
import { buildPagination, parsePagination, toOptionalString } from '../utils/queryParams.js';
import { parseCustomerInput } from '../utils/customerInput.js';

// GET /api/admin/customers?page=&pageSize=&search=
export const listCustomers = async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);

  const { customers, total } = await customerService.findCustomersForAdmin({
    search: toOptionalString(req.query.search),
    page,
    pageSize,
  });

  return res.json({ customers, pagination: buildPagination({ page, pageSize, total }) });
};

// GET /api/admin/customers/:id
export const getCustomer = async (req, res) => {
  const customer = await customerService.getCustomerDetail(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer tidak ditemukan' });
  return res.json({ customer });
};

// PATCH /api/admin/customers/:id
export const updateCustomer = async (req, res) => {
  const { data, error } = parseCustomerInput(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const customer = await customerService.updateCustomer(req.params.id, data);
    return res.json({ customer });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

// DELETE /api/admin/customers/:id
export const deleteCustomer = async (req, res) => {
  try {
    await customerService.deleteCustomer(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};