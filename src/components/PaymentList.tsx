import { Receipt } from 'lucide-react';
import type { Payment } from '../types';
import { formatDate, formatMoney } from '../services/memberService';
import { StatusBadge } from './StatusBadge';
export function PaymentList({ payments }: { payments: Payment[] }) {
  return <div className="overflow-x-auto"><table className="payment-table"><caption className="sr-only">Member payment history</caption><thead><tr><th>Description</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{payments.map(payment => <tr key={payment.id}><td><div className="flex items-center gap-3"><span className="payment-icon"><Receipt size={18} /></span><div className="font-medium">{payment.description}<span className="mt-1 block text-xs font-normal text-muted">{payment.id}</span></div></div></td><td className="text-muted">{formatDate(payment.date)}</td><td className="font-semibold whitespace-nowrap">{formatMoney(payment.amount)}</td><td><StatusBadge status={payment.status} /></td></tr>)}</tbody></table></div>;
}
