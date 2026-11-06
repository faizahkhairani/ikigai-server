import prisma from "../lib/prisma.js";

export const getAdminProfile = (adminId) =>
  prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, name: true, email: true, role: true },
  });