import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { emailService } from '../services/emailService';

export function CertificateEmail({ email }: { email: string }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void emailService.config().then(config => { if (active) setReady(config.ready); }).catch(() => { if (active) setError('Certificate email is temporarily unavailable.'); });
    return () => { active = false; };
  }, []);
  async function send() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { setMessage((await emailService.certificate()).message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Certificate email could not be confirmed. Retry the same request.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-5">
    <button type="button" className="secondary-button flex items-center gap-2" disabled={!ready || busy || Boolean(message)} onClick={() => void send()}><Mail size={16} />{busy ? 'Sending certificate…' : 'Email my certificate'}</button>
    <p className="mt-2 text-xs text-muted">{ready ? `Send your membership PDF to ${email}.` : 'Certificate email will be available when email sending is enabled.'}</p>
    {message && <p role="status" className="notice mt-3">{message}</p>}
    {error && <p role="alert" className="payment-error mt-3">{error}</p>}
  </div>;
}
