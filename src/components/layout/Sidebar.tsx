import { BookOpen, CalendarDays, CreditCard, LayoutDashboard, LogOut, ShieldCheck, UserRound, X, ArrowUpRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
export const navigation = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/dashboard/registration', label: 'Registration & KYC', icon: ShieldCheck },
  { path: '/dashboard/profile', label: 'My Profile', icon: UserRound },
  { path: '/dashboard/membership', label: 'Membership', icon: ShieldCheck },
  { path: '/dashboard/payments', label: 'Payments', icon: CreditCard },
  { path: '/dashboard/events', label: 'Events', icon: CalendarDays },
  { path: '/dashboard/resources', label: 'Resources', icon: BookOpen },
];
export function Sidebar({ mobile = false, onClose, onLogout, registrationSaved = false }: { mobile?: boolean; onClose?: () => void; onLogout: () => void; registrationSaved?: boolean }) {
  return <aside className={`sidebar ${mobile ? 'sidebar-mobile' : 'sidebar-desktop'}`}><div className="flex items-start justify-between"><NavLink to="/dashboard" onClick={onClose} className="brand flex-col items-start gap-2" aria-label="BNAK member portal home"><img src="/bnak-logo.svg" alt="Biashara Ndogo Association of Kenya" className="h-auto w-[168px]" width="1040" height="340" /><small>MEMBER PORTAL</small></NavLink>{mobile && <button className="icon-button" onClick={onClose} aria-label="Close navigation"><X size={21} /></button>}</div><p className="association-name">Biashara Ndogo Association<br />of Kenya</p><p className="nav-label">YOUR WORKSPACE</p><nav aria-label="Member navigation" className="space-y-1.5">{navigation.filter(item => item.path !== '/dashboard/payments' || registrationSaved).map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end={path === '/dashboard'} onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}><Icon size={19} strokeWidth={1.7} />{label}</NavLink>)}</nav><div className="sidebar-bottom"><div className="community-note"><span className="eyebrow">STRONGER, TOGETHER</span><h3 className="mt-2 font-semibold">Small businesses.<br />Big possibilities.</h3><p className="mt-2 text-xs leading-5 text-muted">Connect, learn and grow with your BNAK community.</p><NavLink to="/dashboard/events" onClick={onClose} className="text-link mt-4 text-xs">Explore events <ArrowUpRight size={14} /></NavLink></div><button className="nav-item mt-5 w-full" onClick={onLogout}><LogOut size={19} />Logout</button><div className="sidebar-foot">© 2026 BNAK. All rights reserved.</div></div></aside>;
}
