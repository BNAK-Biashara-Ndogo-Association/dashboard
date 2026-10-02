import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useRevalidator } from 'react-router-dom';
import { Sidebar, navigation } from './Sidebar';
import { Header } from './Header';
import { memberService } from '../../services/memberService';
import { authService } from '../../services/authService';
export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const drawer = useRef<HTMLDialogElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  useEffect(() => {
    const refresh = () => { void revalidator.revalidate(); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [revalidator]);
  const title = [...navigation].reverse().find(item => location.pathname.startsWith(item.path))?.label ?? 'Overview';
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => { document.title = `${title} | BNAK Member Portal`; }, [title]);
  useEffect(() => { if (open) { drawer.current?.showModal(); document.body.style.overflow = 'hidden'; } else { drawer.current?.close(); document.body.style.overflow = ''; } return () => { document.body.style.overflow = ''; }; }, [open]);
  const logout = async () => {
    setOpen(false); setLogoutError('');
    try { await authService.logout(); window.google?.accounts.id.disableAutoSelect(); navigate('/login', { replace: true }); }
    catch { setLogoutError('Could not sign out. Check your connection and try again.'); }
  };
  return <div className="app-shell"><a href="#main-content" className="skip-link">Skip to content</a><Sidebar onLogout={logout} /><dialog ref={drawer} className="mobile-drawer" aria-label="Member navigation" onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}><Sidebar mobile onClose={() => setOpen(false)} onLogout={logout} /></dialog><div className="workspace"><Header title={title} member={memberService.getMember()} onMenu={() => setOpen(true)} onLogout={logout} /><main id="main-content" className="main-content" tabIndex={-1}><p className="notice mb-5">Membership details, events and sample payments are demo data. Google sign-in does not confirm BNAK membership.</p>{logoutError && <p role="alert" className="notice mb-5">{logoutError}</p>}<Outlet /></main><footer className="main-footer"><span>Biashara Ndogo Association of Kenya</span><span>Empowering businesses. Building Kenya.</span></footer></div></div>;
}
