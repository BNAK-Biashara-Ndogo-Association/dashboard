import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { HttpError } from './payments.mjs';

const client = new OAuth2Client();
const lifetime = 8 * 60 * 60 * 1000;
export function createAuth({ clientId = process.env.GOOGLE_CLIENT_ID || '', secure = process.env.NODE_ENV === 'production', now = Date.now, verify = async credential => (await client.verifyIdToken({ idToken: credential, audience: clientId })).getPayload() } = {}) {
  const sessions = new Map();
  const challenges = new Map();
  const cookieValue = (request, name) => request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  const cookie = (name, value, seconds) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure ? '; Secure' : ''}`;
  function prune() { for (const map of [sessions, challenges]) for (const [key, value] of map) if (value.expires <= now()) map.delete(key); }
  return {
    config(request, response) {
      prune();
      const nonce = randomBytes(32).toString('hex');
      const key = randomBytes(32).toString('hex');
      if (challenges.size >= 10000) throw new HttpError(429, 'Please try again shortly.');
      challenges.set(key, { nonce, expires: now() + 300000 });
      response.setHeader('Set-Cookie', cookie('bnak_login', key, 300));
      return { clientId, nonce };
    },
    user(request) { prune(); return sessions.get(cookieValue(request, 'bnak_session'))?.user || null; },
    async login(request, response, body) {
      if (!clientId) throw new HttpError(503, 'Google sign-in has not been configured yet.');
      prune();
      const key = cookieValue(request, 'bnak_login');
      const challenge = challenges.get(key);
      challenges.delete(key);
      if (!challenge || typeof body.credential !== 'string') throw new HttpError(401, 'Sign-in expired. Reload and try again.');
      let payload;
      try { payload = await verify(body.credential); } catch { throw new HttpError(401, 'Google sign-in could not be verified. Please try again.'); }
      if (!payload?.sub || !payload.email || payload.email_verified !== true || payload.nonce !== challenge.nonce) throw new HttpError(401, 'Google sign-in could not be verified. Please try again.');
      const user = { id: payload.sub, email: payload.email, firstName: payload.given_name || payload.name || 'Member', lastName: payload.family_name || '' };
      if (sessions.size >= 10000) throw new HttpError(503, 'Sign-in is busy. Please try again shortly.');
      sessions.delete(cookieValue(request, 'bnak_session'));
      const session = randomBytes(32).toString('hex');
      sessions.set(session, { user, expires: now() + lifetime });
      response.setHeader('Set-Cookie', [cookie('bnak_session', session, lifetime / 1000), cookie('bnak_login', '', 0)]);
      return { user };
    },
    logout(request, response) {
      sessions.delete(cookieValue(request, 'bnak_session'));
      challenges.delete(cookieValue(request, 'bnak_login'));
      response.setHeader('Set-Cookie', [cookie('bnak_session', '', 0), cookie('bnak_login', '', 0)]);
      return { user: null };
    },
  };
}
