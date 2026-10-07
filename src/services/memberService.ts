import type { Event, Member, Membership, Payment, User } from '../types';

let signedInUser: User | null = null;
let profile: Member | null = null;
let membership: Membership | null = null;
let payments: Payment[] = [];
export const memberService = {
  setUser(user: User | null) {
    if (signedInUser?.id !== user?.id || !user) { profile = null; membership = null; payments = []; }
    signedInUser = user;
  },
  async refresh() {
    const response = await fetch('/api/member/summary', { credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok || !data.member || !data.membership) throw new Error(data.message || 'Member details are unavailable.');
    profile = data.member; membership = data.membership; payments = data.payments || [];
  },
  getMember: (): Member => profile || { ...(signedInUser || { id: '', firstName: 'Member', lastName: '', email: '' }), membershipNumber: 'Not assigned', phone: 'Not provided', businessName: 'Not provided', county: 'Not provided' },
  getMembership: (): Membership => membership || { id: '', memberId: signedInUser?.id || '', plan: 'Not selected', status: 'pending', joinedAt: '', validUntil: '' },
  getEvents: (): Event[] => [],
  getPayments: () => payments,
};
export const formatDate = (date: string) => date && Number.isFinite(Date.parse(date)) ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`)) : 'Not set';
export const formatMoney = (amount: number) => `KES ${new Intl.NumberFormat('en-KE').format(amount)}`;
