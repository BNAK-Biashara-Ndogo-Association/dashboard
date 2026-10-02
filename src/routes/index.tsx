import { createBrowserRouter, Navigate, redirect } from 'react-router-dom';
import { authService } from '../services/authService';
import { LoginPage } from '../pages/LoginPage';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { OverviewPage } from '../pages/OverviewPage';
import { EventDetailsPage, EventsPage, MembershipPage, NotFoundPage, ProfilePage, ResourcesPage } from '../pages/MemberPages';
import { PaymentsPage } from '../pages/PaymentsPage';
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/dashboard', loader: async ({ request }) => {
    let user;
    try { user = await authService.session(); } catch { user = null; }
    if (!user) { const url = new URL(request.url); return redirect(`/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`); }
    return null;
  }, shouldRevalidate: () => true, element: <DashboardLayout />, children: [
    { index: true, element: <OverviewPage /> }, { path: 'profile', element: <ProfilePage /> },
    { path: 'membership', element: <MembershipPage /> }, { path: 'payments', element: <PaymentsPage /> },
    { path: 'events', element: <EventsPage /> }, { path: 'events/:eventId', element: <EventDetailsPage /> },
    { path: 'resources', element: <ResourcesPage /> }, { path: '*', element: <NotFoundPage /> },
  ] },
  { path: '/login', element: <LoginPage /> },
  { path: '/signed-out', element: <Navigate to="/login" replace /> },
  { path: '*', element: <main className="main-content"><NotFoundPage /></main> },
]);
