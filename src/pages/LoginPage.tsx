import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
type Mode = 'login' | 'signup' | 'forgot' | 'reset';
export function LoginPage({ mode = 'login' }: { mode?: Mode }) {
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [resetDone, setResetDone] = useState(false);
  const [resetToken] = useState(() => mode === 'reset' ? new URLSearchParams(window.location.hash.slice(1)).get('token') || '' : '');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get('returnTo') || '/dashboard';
  const returnTo = requested === '/dashboard' || requested.startsWith('/dashboard/') ? requested : '/dashboard';
  const withReturn = (path: string) => path + '?returnTo=' + encodeURIComponent(returnTo);
  useEffect(() => {
    if (mode === 'reset') window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [mode]);
  useEffect(() => {
    if (mode === 'reset' || mode === 'forgot') return;
    let active = true;
    setGoogleError('');
    async function prepare() {
      if (await authService.session()) { if (active) navigate(returnTo, { replace: true }); return; }
      const config = await authService.config();
      if (!active || !config.clientId) return;
      await loadGoogle();
      if (!active || !button.current || !window.google) return;
      window.google.accounts.id.initialize({ client_id: config.clientId, nonce: config.nonce, auto_select: false, callback: async ({ credential }) => {
        if (!active) return;
        setBusy(true); setError('');
        try { await authService.login(credential); if (active) navigate(returnTo, { replace: true }); }
        catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Sign-in failed. Please retry.'); }
        finally { if (active) { setBusy(false); setAttempt(value => value + 1); } }
      } });
      button.current.replaceChildren();
      window.google.accounts.id.renderButton(button.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 280 });
    }
    void prepare().catch(() => { if (active) setGoogleError('Google sign-in could not load. You can still use email and password.'); });
    return () => { active = false; };
  }, [attempt, mode, navigate, returnTo]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get('email') || '');
    const password = String(fields.get('password') || '');
    setError(''); setMessage('');
    if ((mode === 'signup' || mode === 'reset') && password !== fields.get('confirmPassword')) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') { setMessage((await authService.forgotPassword(email)).message); }
      else if (mode === 'reset') { setMessage((await authService.resetPassword(resetToken, password)).message); setResetDone(true); }
      else {
        if (mode === 'signup') await authService.signup({ email, password, firstName: String(fields.get('firstName') || ''), lastName: String(fields.get('lastName') || '') });
        else await authService.passwordLogin(email, password);
        navigate(returnTo, { replace: true });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again later.'); }
    finally { setBusy(false); }
  }
  const title = { login: 'Welcome back', signup: 'Create your account', forgot: 'Forgot your password?', reset: 'Choose a new password' }[mode];
  const description = { login: 'Sign in to your BNAK member portal.', signup: 'Create an account to access the member portal.', forgot: 'Enter your email and we will send you a reset link. If you use Google, continue with Google instead.', reset: 'Use a strong password you have not used elsewhere.' }[mode];
  return <main className="grid min-h-screen place-items-center p-6"><section className="panel w-full max-w-md p-8">
    <div className="text-center"><img src="/bnak-logo.svg" alt="Biashara Ndogo Association of Kenya" className="mx-auto block h-auto w-52" width="1040" height="340" /><p className="eyebrow mt-6">BNAK MEMBER PORTAL</p><h1 className="mt-4 text-2xl font-semibold">{title}</h1><p className="my-5 text-sm leading-6 text-muted">{description}</p></div>
    {mode === 'reset' && !resetToken ? <p role="alert">This reset link is missing or invalid. <Link className="underline" to="/forgot-password">Request a new link</Link>.</p> : !resetDone && <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        {mode === 'signup' && <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">First name<input className="payment-input" name="firstName" autoComplete="given-name" required maxLength={80} /></label><label className="text-sm font-medium">Last name<input className="payment-input" name="lastName" autoComplete="family-name" maxLength={80} /></label></div>}
        {mode !== 'reset' && <label className="block text-sm font-medium">Email address<input className="payment-input" name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
        {mode !== 'forgot' && <label className="block text-sm font-medium">{mode === 'reset' ? 'New password' : 'Password'}<input className="payment-input" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? undefined : 12} maxLength={128} />{mode !== 'login' && <span className="mt-1 block text-xs text-muted">At least 12 characters.</span>}</label>}
        {(mode === 'signup' || mode === 'reset') && <label className="block text-sm font-medium">Confirm password<input className="payment-input" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>}
        {mode === 'login' && <div className="text-right text-sm"><Link className="underline" to="/forgot-password">Forgot password?</Link></div>}
        <button className="primary-button w-full justify-center" type="submit">{busy ? 'Please wait...' : { login: 'Sign in', signup: 'Create account', forgot: 'Send reset link', reset: 'Reset password' }[mode]}</button>
      </fieldset>
    </form>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm">{message}</p>}
    {(mode === 'login' || mode === 'signup') && <><div className="my-5 text-center text-xs text-muted">OR CONTINUE WITH GOOGLE</div><div ref={button} className="flex justify-center" />{googleError && <p className="mt-3 text-center text-sm text-muted">{googleError} <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Retry Google</button></p>}</>}
    <p className="mt-6 text-center text-sm">{mode === 'login' ? <>New here? <Link className="font-semibold underline" to={withReturn('/signup')}>Create an account</Link></> : <Link className="font-semibold underline" to={withReturn('/login')}>Back to sign in</Link>}</p>
  </section></main>;
}
