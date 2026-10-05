import { createBrowserRouter, Navigate, redirect } from 'react-router-dom';
import { authService } from '../services/authService';
import { LoginPage } from '../pages/LoginPage';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { OverviewPage } from '../pages/OverviewPage';
import { EventDetailsPage, EventsPage, MembershipPage, NotFoundPage, ProfilePage, ResourcesPage } from '../pages/MemberPages';
import { PaymentsPage } from '../pages/PaymentsPage';
import { RegistrationPage } from '../pages/RegistrationPage';
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/dashboard', loader: async ({ request }) => {
    let user;
    try { user = await authService.session(); } catch { user = null; }
    if (!user) { const url = new URL(request.url); return redirect(`/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`); }
    return null;
  }, shouldRevalidate: () => true, element: <DashboardLayout />, children: [
    { index: true, element: <OverviewPage /> }, { path: 'registration', element: <RegistrationPage /> }, { path: 'profile', element: <ProfilePage /> },
    { path: 'membership', element: <MembershipPage /> }, { path: 'payments', element: <PaymentsPage /> },
    { path: 'events', element: <EventsPage /> }, { path: 'events/:eventId', element: <EventDetailsPage /> },
    { path: 'resources', element: <ResourcesPage /> }, { path: '*', element: <NotFoundPage /> },
  ] },
  { path: '/login', element: <LoginPage key="login" /> },
  { path: '/signup', element: <LoginPage key="signup" mode="signup" /> },
  { path: '/forgot-password', element: <LoginPage key="forgot" mode="forgot" /> },
  { path: '/reset-password', element: <LoginPage key="reset" mode="reset" /> },
  { path: '/signed-out', element: <Navigate to="/login" replace /> },
  { path: '*', element: <main className="main-content"><NotFoundPage /></main> },
]);
