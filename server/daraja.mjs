export class DarajaError extends Error {
  constructor(message, { ambiguous = false } = {}) { super(message); this.ambiguous = ambiguous; }
}

export function normalizePhone(value) {
  if (typeof value !== 'string') throw new Error('Enter a valid Kenyan mobile number.');
  let phone = value.replace(/[\s()-]/g, '').replace(/^\+/, '');
  if (/^0[17]\d{8}$/.test(phone)) phone = `254${phone.slice(1)}`;
  if (!/^254[17]\d{8}$/.test(phone)) throw new Error('Use a Kenyan mobile number such as 0712345678 or +254712345678.');
  return phone;
}

export function credentials(config, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = type => parts.find(part => part.type === type).value;
  const Timestamp = ['year', 'month', 'day', 'hour', 'minute', 'second'].map(get).join('');
  return { BusinessShortCode: config.shortcode, Password: Buffer.from(`${config.shortcode}${config.passkey}${Timestamp}`).toString('base64'), Timestamp };
}

export function createDaraja(config, fetchImpl = fetch) {
  const base = 'https://sandbox.safaricom.co.ke';
  let cachedToken;
  let expiresAt = 0;
  async function token() {
    if (cachedToken && expiresAt > Date.now()) return cachedToken;
    try {
      const response = await fetchImpl(`${base}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')}` }, signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error();
      cachedToken = data.access_token;
      expiresAt = Date.now() + Math.max(0, (Number(data.expires_in) || 3600) - 60) * 1000;
      return cachedToken;
    } catch { throw new DarajaError('Could not authenticate with Daraja. Check the server credentials and connection.'); }
  }
  async function post(path, body) {
    const accessToken = await token();
    let response;
    let data;
    try {
      response = await fetchImpl(`${base}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      data = await response.json();
    } catch { throw new DarajaError('Daraja did not return a response. The request may still be processing.', { ambiguous: true }); }
    if (response.status === 401) { cachedToken = undefined; expiresAt = 0; }
    if (!response.ok) throw new DarajaError('Daraja is unable to process this request right now.', { ambiguous: response.status >= 500 });
    return data;
  }
  return {
    async initiate(payment) {
      const data = await post('/mpesa/stkpush/v1/processrequest', { ...credentials(config), TransactionType: 'CustomerPayBillOnline', Amount: payment.amount, PartyA: payment.phone, PartyB: config.shortcode, PhoneNumber: payment.phone, CallBackURL: config.callbackUrl, AccountReference: 'BNAK-00241', TransactionDesc: 'Membership renewal' });
      if (String(data.ResponseCode) !== '0') throw new DarajaError('Daraja rejected the payment request. Check the sandbox configuration.');
      if (!data.CheckoutRequestID || !data.MerchantRequestID) throw new DarajaError('Daraja returned an incomplete response. Check the transaction before retrying.', { ambiguous: true });
      return data;
    },
    query(checkoutId) { return post('/mpesa/stkpushquery/v1/query', { ...credentials(config), CheckoutRequestID: checkoutId }); },
  };
}
