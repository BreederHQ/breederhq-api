/**
 * Query helper utilities for soft deletes and common filters
 */

/**
 * Filters out soft-deleted records
 * Use this everywhere you query Invoice, Contact, or Animal
 *
 * @example
 * const invoices = await prisma.invoice.findMany({
 *   where: activeOnly({ tenantId, status: 'paid' })
 * });
 */
export function activeOnly<T extends Record<string, any>>(where: T = {} as T) {
  return { ...where, deletedAt: null };
}

/**
 * Soft delete a record (sets deletedAt timestamp)
 *
 * @example
 * await prisma.invoice.update({
 *   where: { id },
 *   data: softDelete()
 * });
 */
export function softDelete() {
  return { deletedAt: new Date() };
}

/**
 * Restore a soft-deleted record
 *
 * @example
 * await prisma.invoice.update({
 *   where: { id },
 *   data: restore()
 * });
 */
export function restore() {
  return { deletedAt: null };
}
