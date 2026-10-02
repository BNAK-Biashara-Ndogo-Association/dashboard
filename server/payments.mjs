import { randomUUID } from 'node:crypto';
import { normalizePhone } from './daraja.mjs';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const renewal = { id: 'annual-renewal', description: 'Annual membership renewal (sandbox)', amount: 3000, currency: 'KES', memberNumber: 'BNAK-00241' };
export function publicPayment(record) {
  const { id, description, amount, currency, status, createdAt, message, checkoutId } = record;
  return { id, description, amount, currency, status, date: createdAt.slice(0, 10), createdAt, message, canCheck: Boolean(checkoutId), environment: 'sandbox' };
}

export function createPayments({ config, store, daraja, now = () => Date.now() }) {
  const inFlight = new Map();
  const get = id => store.all().find(item => item.id === id);
  function requireReady() { if (!config.ready) throw new HttpError(503, config.issue); }
  async function reconcile(id) {
    requireReady();
    const record = get(id);
    if (!record) throw new HttpError(404, 'Payment not found.');
    if (record.status !== 'pending' || !record.checkoutId) return publicPayment(record);
    if (inFlight.has(id)) return inFlight.get(id);
    if (record.lastCheckedAt && now() - record.lastCheckedAt < 15000) return publicPayment(record);
    const task = (async () => {
      record.lastCheckedAt = now();
      store.save(record);
      try {
        const result = await daraja.query(record.checkoutId);
        // Never trust an inbound callback or an STK acceptance as proof of payment.
        if (result.CheckoutRequestID && result.CheckoutRequestID !== record.checkoutId) throw new Error('Mismatched checkout ID');
        if (result.MerchantRequestID && result.MerchantRequestID !== record.merchantId) throw new Error('Mismatched merchant ID');
        if (String(result.ResponseCode) === '0' && result.ResultCode !== undefined && result.ResultCode !== null && /^\d+$/.test(String(result.ResultCode))) {
          const code = String(result.ResultCode);
          record.status = code === '0' ? 'paid' : 'failed';
          record.message = code === '0' ? 'Payment confirmed by Daraja sandbox.' : code === '1032' ? 'The payment request was cancelled on the phone.' : code === '1037' ? 'The phone did not respond in time. You can try again.' : code === '1' ? 'The payment could not be completed because of insufficient funds.' : `Daraja reported that the payment was not completed (code ${code}).`;
        } else { record.message = 'Waiting for Daraja to confirm the result. Check again shortly.'; }
      } catch { record.message = 'We could not confirm the result yet. Check again before starting another payment.'; }
      store.save(record);
      return publicPayment(record);
    })().finally(() => inFlight.delete(id));
    inFlight.set(id, task);
    return task;
  }
  return {
    list: userId => store.all().filter(item => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicPayment),
    reconcile,
    async initiate(body, key, userId) {
      requireReady();
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(key || '')) throw new HttpError(400, 'A valid idempotency key is required.');
      let phone;
      try { phone = normalizePhone(body.phone); } catch (error) { throw new HttpError(400, error.message); }
      if (body.productId !== renewal.id) throw new HttpError(400, 'Choose a valid membership payment.');
      const owned = store.all().filter(item => item.userId === userId);
      const existing = owned.find(item => item.key === key);
      if (existing) {
        if (existing.phone !== phone) throw new HttpError(409, 'This request key is already associated with another phone number.');
        return publicPayment(existing);
      }
      const pending = owned.find(item => item.status === 'pending');
      if (pending) throw new HttpError(409, 'A payment is already awaiting confirmation. Check its status before trying again.');
      if (owned.some(item => now() - Date.parse(item.createdAt) < 30000)) throw new HttpError(429, 'Please wait 30 seconds before sending another prompt.');
      const record = { ...renewal, userId, id: randomUUID(), key, phone, status: 'pending', createdAt: new Date(now()).toISOString(), message: 'Sending the payment request to Daraja.' };
      store.save(record);
      try {
        const result = await daraja.initiate(record);
        record.checkoutId = result.CheckoutRequestID;
        record.merchantId = result.MerchantRequestID;
        record.message = 'Request accepted. Follow the M-PESA prompt on your phone, then check the result here.';
      } catch (error) {
        record.status = error.ambiguous ? 'pending' : 'failed';
        record.message = error.ambiguous ? 'The request outcome is unknown. Do not send another payment. Check the Daraja sandbox transaction log; an operator must reconcile this attempt.' : 'The request could not be sent. Check the Daraja configuration and try again.';
      }
      store.save(record);
      return publicPayment(record);
    },
    async callback(body) {
      const callback = body?.Body?.stkCallback;
      if (!callback || typeof callback.CheckoutRequestID !== 'string' || typeof callback.MerchantRequestID !== 'string') throw new HttpError(400, 'Invalid callback.');
      const record = store.all().find(item => item.checkoutId === callback.CheckoutRequestID && item.merchantId === callback.MerchantRequestID);
      if (record?.status === 'pending') await reconcile(record.id);
      // Unknown / repeated callbacks are acknowledged without changing payment state.
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    },
  };
}
