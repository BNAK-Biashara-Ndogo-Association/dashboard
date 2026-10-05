import type { KycRegistration, MembershipConfig } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/membership${path}`, { credentials: 'same-origin', signal: AbortSignal.timeout(45000), ...init }); }
  catch { throw new Error('The membership service could not be reached. Please try again.'); }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The membership service is temporarily unavailable. Please try again later.'); }
  if (response.status === 401) window.location.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
  if (!response.ok) throw new Error(data.message || 'The membership request could not be completed.');
  return data as T;
}

export const membershipService = {
  config: () => request<MembershipConfig>('/config'),
  registration: async () => (await request<{ registration: KycRegistration | null }>('/registration')).registration,
  submit: async (body: Record<string, unknown>) => (await request<{ registration: KycRegistration }>('/registration', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })).registration,
};
