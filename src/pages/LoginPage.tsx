import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { authService } from '../services/authService';

declare global {
  interface Window { google?: { accounts: { id: {
    initialize: (options: { client_id: string; nonce: string; auto_select: boolean; callback: (response: { credential: string }) => void }) => void;
    renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string; shape: string; width: number }) => void;
    disableAutoSelect: () => void;
  } } }; }
}
let googleScript: Promise<void> | undefined;
function loadGoogle() {
  if (window.google) return Promise.resolve();
  if (!googleScript) googleScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => { script.remove(); googleScript = undefined; reject(new Error('Google sign-in could not load. Check your connection and retry.')); }, 15000);
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); googleScript = undefined; reject(new Error('Google sign-in could not load. Check your connection and retry.')); };
    document.head.appendChild(script);
  });
  return googleScript;
}
export function LoginPage() {
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Preparing secure sign-in…');
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get('returnTo') || '/dashboard';
  const returnTo = requested === '/dashboard' || requested.startsWith('/dashboard/') ? requested : '/dashboard';
  useEffect(() => {
    let active = true;
    setError(''); setStatus('Preparing secure sign-in…');
    async function prepare() {
      if (await authService.session()) { if (active) navigate(returnTo, { replace: true }); return; }
      const config = await authService.config();
      if (!active) return;
      if (!config.clientId) { setStatus('Google sign-in is not set up yet. Please contact the portal administrator.'); return; }
      await loadGoogle();
      if (!active || !button.current || !window.google) return;
      window.google.accounts.id.initialize({ client_id: config.clientId, nonce: config.nonce, auto_select: false, callback: async ({ credential }) => {
        if (!active) return;
        setStatus('Signing you in…'); setError('');
        try { await authService.login(credential); if (active) navigate(returnTo, { replace: true }); }
        catch (cause) { if (active) { setStatus(''); setError(cause instanceof Error ? cause.message : 'Sign-in failed. Please retry.'); } }
      } });
      button.current.replaceChildren();
      window.google.accounts.id.renderButton(button.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 280 });
      setStatus('');
    }
    void prepare().catch(cause => { if (active) { setStatus(''); setError(cause instanceof Error ? cause.message : 'Sign-in is unavailable. Please retry.'); } });
    return () => { active = false; };
  }, [attempt, navigate, returnTo]);
  return <main className="grid min-h-screen place-items-center p-6"><section className="panel w-full max-w-md p-8 text-center"><span className="brand-symbol mx-auto"><ShieldCheck size={28} /></span><p className="eyebrow mt-6">BNAK MEMBER PORTAL</p><h1 className="mt-4 text-2xl font-semibold">Welcome to your member portal</h1><p className="my-5 text-sm leading-6 text-muted">Sign in with your Google account to continue.</p><div ref={button} className="flex justify-center" /><p role="status" className="mt-4 text-sm text-muted">{status}</p>{error && <div className="mt-4"><p role="alert" className="text-sm">{error}</p><button className="primary-button mt-4" onClick={() => setAttempt(value => value + 1)}>Retry sign-in</button></div>}</section></main>;
}
