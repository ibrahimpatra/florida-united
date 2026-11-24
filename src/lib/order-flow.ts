/**
 * The order status flow, in one place. The server enforces it (order-actions.ts) and the admin screens only show the steps it allows.
 * Shipped orders cannot be cancelled by anyone. Delivered orders only move on when the customer asks for a return.
 */
export const NEXT_STEPS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
  delivered: [],
  return_requested: ['return_approved', 'return_rejected'],
  return_approved: ['return_picked_up'],
  return_picked_up: ['returned'],
  returned: ['refunded'],
  refunded: [], cancelled: [], return_rejected: [],
};
export const nextSteps = (status: string): string[] => NEXT_STEPS[status] || [];
export const isFinalStatus = (status: string) => nextSteps(status).length === 0;
/** Customers may cancel only before the order is processed. */
export const customerCanCancel = (status: string) => ['pending', 'confirmed'].includes(status);
/** Admins may cancel until it ships. */
export const adminCanCancel = (status: string) => nextSteps(status).includes('cancelled');
export const STEP_LABEL: Record<string, string> = {
  confirmed: 'Confirm order', processing: 'Start processing', shipped: 'Mark as shipped', out_for_delivery: 'Out for delivery', delivered: 'Mark delivered',
  return_approved: 'Approve return', return_rejected: 'Reject return', return_picked_up: 'Return picked up', returned: 'Item received back', refunded: 'Mark refunded', cancelled: 'Cancel order',
};
