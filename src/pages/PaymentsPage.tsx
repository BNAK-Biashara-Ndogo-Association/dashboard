import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, LoaderCircle, RefreshCw, Smartphone } from 'lucide-react';
import { PaymentList } from '../components/PaymentList';
import { StatusBadge } from '../components/StatusBadge';
import { memberService, formatMoney } from '../services/memberService';
import { paymentService } from '../services/paymentService';
import type { DarajaPayment, PaymentConfig } from '../services/paymentService';

export function PaymentsPage() {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [payments, setPayments] = useState<DarajaPayment[]>([]);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const requestKey = useRef<string | null>(null);
  const pending = payments.find(payment => payment.status === 'pending');
  const latest = pending ?? payments[0];
  const updatePayment = useCallback((payment: DarajaPayment) => {
    setPayments(current => [payment, ...current.filter(item => item.id !== payment.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextConfig, history] = await Promise.all([paymentService.config(), paymentService.list()]);
      setConfig(nextConfig); setPayments(history);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load payments.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const check = useCallback(async (id: string) => {
    setChecking(true);
    try { updatePayment(await paymentService.refresh(id)); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not check the payment.'); }
    finally { setChecking(false); }
  }, [updatePayment]);
  useEffect(() => {
    if (!pending?.canCheck || !config?.ready) return;
    // Poll for two minutes; unresolved payments remain pending and can be checked manually.
    let attempts = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (stopped) return;
      await check(pending.id);
      attempts += 1;
      if (!stopped && attempts < 8) timer = setTimeout(() => void poll(), 15000);
    };
    timer = setTimeout(() => void poll(), 15000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [pending?.id, pending?.canCheck, config?.ready, check]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!config?.ready || busy || pending) return;
    const normalized = phone.replace(/[\s()-]/g, '').replace(/^\+/, '');
    if (!/^(?:0|254)[17]\d{8}$/.test(normalized)) { setError('Enter a Kenyan mobile number such as 0712345678 or +254712345678.'); return; }
    setBusy(true); setError('');
    requestKey.current ??= crypto.randomUUID();
    try {
      updatePayment(await paymentService.initiate(phone, config.product.id, requestKey.current));
      requestKey.current = null; setUncertain(false);
    } catch (reason) {
      setUncertain(true);
      setError(reason instanceof Error ? reason.message : 'Could not send the payment request.');
      // Keep the same key on retry, including after a lost HTTP response.
      try { setPayments(await paymentService.list()); } catch { /* Keep the original error visible. */ }
    } finally { setBusy(false); }
  }
  return <>
    <div className="page-intro"><div><p className="eyebrow mb-2">BNAK MEMBER PORTAL</p><h2>Payments & contributions</h2><p>Manage your membership payments with M-PESA.</p></div><span className="member-number">Daraja sandbox</span></div>
    <div className="payment-layout">
      <section className="panel p-6 sm:p-8"><div className="flex items-center gap-3"><span className="icon-tile"><Smartphone size={22} /></span><div><h2 className="font-semibold">Pay with M-PESA</h2><p className="mt-1 text-xs text-muted">Annual membership renewal</p></div></div>
        <p className="mt-5 text-sm leading-6 text-muted">This is a sandbox test. It does not renew your membership or update your sample payment records.</p>
        {loading ? <p role="status" className="mt-5 text-sm text-muted">Loading payment service…</p> : config && <>
          <div className="payment-total"><span className="text-sm">{config.product.memberNumber}</span><strong className="text-2xl text-brand">{formatMoney(config.product.amount)}</strong></div>
          {!config.ready && <div className="notice mb-5" role="status"><strong className="block">Sandbox setup required</strong>{config.message}</div>}
          <form onSubmit={event => void submit(event)}>
            <label htmlFor="mpesa-phone" className="block text-sm font-semibold">M-PESA phone number</label>
            <input id="mpesa-phone" className="payment-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="e.g. 0712 345 678" value={phone} onChange={event => { setPhone(event.target.value); requestKey.current = null; }} maxLength={24} required disabled={!config.ready || busy || Boolean(pending) || uncertain} aria-describedby="phone-help" />
            <p id="phone-help" className="mt-2 text-xs leading-5 text-muted">Use the phone number supported by your Daraja sandbox test setup. Enter your M-PESA PIN only on your phone.</p>
            <button className="primary-button mt-5 w-full gap-2" disabled={!config.ready || busy || Boolean(pending)} type="submit">{busy ? <><LoaderCircle size={17} className="animate-spin" />Sending request…</> : pending ? 'Payment awaiting confirmation' : uncertain ? 'Retry same request safely' : 'Send sandbox M-PESA prompt'}</button>
          </form>
        </>}
        {error && <div role="alert" className="payment-error mt-4">{error}</div>}
        <button className="text-link mt-5" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={14} />Reload payment history</button>
      </section>
      <section className="panel p-6 sm:p-8" aria-live="polite"><h2 className="font-semibold">Payment status</h2>{latest ? <><div className="mt-5 flex items-center gap-2"><StatusBadge status={latest.status} />{latest.status === 'paid' && <CheckCircle2 size={18} className="text-brand" />}</div><p className="mt-4 text-sm leading-7">{latest.message}</p><p className="mt-4 break-all text-xs text-muted">Reference: {latest.id}</p>{latest.status === 'pending' && <><p className="mt-4 text-xs leading-6 text-muted">A sent prompt is not a completed payment. We check with Daraja every 15 seconds for up to two minutes. You can check again below if it takes longer.</p><button className="primary-button mt-5 gap-2" disabled={!latest.canCheck || checking || !config?.ready} onClick={() => void check(latest.id)}><RefreshCw size={15} />{checking ? 'Checking…' : 'Check payment status'}</button></>}</> : <p className="mt-4 text-sm leading-7 text-muted">Send a payment request to get started. The result will appear here after confirmation from Daraja.</p>}</section>
    </div>
    <section className="panel mt-6"><div className="section-heading"><div><h2>Sandbox payment history</h2><p className="mt-1 text-xs text-muted">Test attempts saved by your local payment service.</p></div></div>{payments.length ? <PaymentList payments={payments} /> : <p className="p-6 text-sm text-muted">{loading ? 'Loading…' : 'No sandbox payments yet.'}</p>}</section>
    <section className="panel mt-6"><div className="section-heading"><h2>Sample membership payments</h2><span className="text-xs text-muted">Demo records</span></div><PaymentList payments={memberService.getPayments()} /></section>
  </>;
}
