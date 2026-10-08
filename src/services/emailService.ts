async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/member/email/${path}`, {
    credentials: 'same-origin', signal: AbortSignal.timeout(30000),
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Member email is unavailable.');
  return data;
}

export const emailService = {
  config: () => request<{ ready: boolean }>('config'),
  certificate: () => request<{ message: string; status: 'accepted' }>('certificate', {}),
};
