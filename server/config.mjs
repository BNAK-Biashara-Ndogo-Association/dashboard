export function loadConfig(env = process.env) {
  const config = {
    environment: env.MPESA_ENV || 'sandbox',
    consumerKey: env.MPESA_CONSUMER_KEY || '',
    consumerSecret: env.MPESA_CONSUMER_SECRET || '',
    shortcode: env.MPESA_SHORTCODE || '',
    passkey: env.MPESA_PASSKEY || '',
    callbackUrl: env.MPESA_CALLBACK_URL || '',
    callbackSecret: env.MPESA_CALLBACK_SECRET || '',
    origins: (env.APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173').split(',').map(value => value.trim()),
  };
  const missing = ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY', 'MPESA_CALLBACK_URL', 'MPESA_CALLBACK_SECRET'].filter(key => !env[key]);
  let issue = missing.length ? `Configure ${missing.join(', ')} in the server .env file.` : '';
  if (!issue) {
    try {
      const url = new URL(config.callbackUrl);
      if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== `/api/mpesa/callback/${config.callbackSecret}` || !/^[a-zA-Z0-9_-]{32,128}$/.test(config.callbackSecret) || !/^\d{5,10}$/.test(config.shortcode)) throw new Error();
    } catch { issue = 'Set a valid shortcode and public HTTPS callback URL ending in /api/mpesa/callback/<secret>, with a random secret of at least 32 characters.'; }
  }
  // A mock member must never be used to initiate production transactions.
  if (config.environment !== 'sandbox') issue = 'Live payments require authenticated members and a production payment ledger. This demo supports Daraja sandbox only.';
  return { ...config, ready: !issue, issue };
}
