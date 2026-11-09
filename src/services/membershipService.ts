import type { KycRegistration, MembershipConfig } from '../types';
import { apiFetch } from './api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const signal = AbortSignal.timeout(45000);
  const timeoutMessage = 'The membership request timed out. Reload this page to check whether your details were saved before submitting again.';
  let response: Response;
  try { response = await apiFetch(`/api/membership${path}`, { ...init, signal }); }
  catch { throw new Error(signal.aborted ? timeoutMessage : 'The membership service could not be reached. Please check your connection.'); }
  let data;
  try { data = await response.json(); }
  catch { throw new Error(signal.aborted ? timeoutMessage : 'The membership service is temporarily unavailable. Please try again later.'); }
  if (response.status === 401) window.location.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
  if (!response.ok) throw new Error(data.message || 'The membership request could not be completed.');
  return data as T;
}

export const membershipService = {
  config: () => request<MembershipConfig>('/config'),
  registration: async () => (await request<{ registration: KycRegistration | null }>('/registration')).registration,
  submit: async (body: Record<string, unknown>) => {
    const data = await request<{ registration: KycRegistration }>('/registration', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!data.registration) throw new Error('The server did not confirm your registration. Reload this page to check whether your details were saved before submitting again.');
    return data.registration;
  },
};
