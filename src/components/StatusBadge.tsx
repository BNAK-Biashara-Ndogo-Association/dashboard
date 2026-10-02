import type { MembershipStatus, PaymentStatus } from '../types';
export function StatusBadge({ status }: { status: MembershipStatus | PaymentStatus }) {
  return <span className={`status status-${status}`}><span aria-hidden="true" />{status === 'paid' ? 'Paid' : status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}
