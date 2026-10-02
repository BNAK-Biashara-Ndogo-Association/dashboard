import type { User } from '../types';
import { memberService } from './memberService';

async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/auth/${path}`, { credentials: 'same-origin', signal: AbortSignal.timeout(15000), ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('Sign-in is temporarily unavailable. Please try again later.'); }
  if (!response.ok) throw new Error(data.message || 'Sign-in is unavailable. Please try again.');
  return data;
}
export const authService = {
  config: () => request<{ clientId: string; nonce: string }>('config'),
  async session() { const { user } = await request<{ user: User | null }>('session'); memberService.setUser(user); return user; },
  async login(credential: string) { const { user } = await request<{ user: User }>('google', { credential }); memberService.setUser(user); return user; },
  async logout() { await request('logout', {}); memberService.setUser(null); },
};
