import type { Payment } from '../types';

export interface DarajaPayment extends Payment {
  createdAt: string;
  message: string;
  canCheck: boolean;
  environment: 'sandbox';
}
export interface PaymentConfig {
  ready: boolean;
  environment: 'sandbox';
  message: string;
  product: { id: string; description: string; amount: number; currency: 'KES'; memberNumber: string };
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/mpesa${path}`, { ...init, signal: AbortSignal.timeout(45000) }); }
  catch { throw new Error('The payment service could not be reached. Reload payment history before trying another request.'); }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The payment service is temporarily unavailable. Please try again later.'); }
  if (response.status === 401) window.location.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
  if (!response.ok) throw new Error(data.message || 'The payment request could not be completed.');
  return data as T;
}
export const paymentService = {
  config: () => request<PaymentConfig>('/config'),
  list: () => request<DarajaPayment[]>('/payments'),
  initiate: (phone: string, productId: string, key: string) => request<DarajaPayment>('/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ phone, productId }) }),
  refresh: (id: string) => request<DarajaPayment>(`/payments/${encodeURIComponent(id)}/refresh`, { method: 'POST' }),
};
