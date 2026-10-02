import type { Event, Member, Membership, Payment, User } from '../types';

let signedInUser: User | null = null;

// Replace this service with API calls when the membership backend is available.
const member: Member = { id: 'member-241', firstName: 'Cyrus', lastName: 'Kamau', email: 'cyrus.kamau@example.com', membershipNumber: 'BNAK-00241', businessName: 'Kamau General Supplies', county: 'Nairobi', phone: '+254 712 345 678' };
const membership: Membership = { id: 'membership-241', memberId: member.id, plan: 'Business Member', status: 'active', joinedAt: '2026-05-12', validUntil: '2027-05-12' };
const events: Event[] = [
  { id: 'nairobi-networking', name: 'Nairobi Business Connect', date: '2026-10-15', time: '9:00 AM – 1:00 PM EAT', location: 'Nairobi, Kenya', category: 'Networking', description: 'Meet fellow business owners, share ideas, and build connections within the BNAK community. This sample event includes a member networking session and a small business roundtable.' },
  { id: 'business-workshop', name: 'Growing Your Small Business', date: '2026-10-24', time: '10:00 AM – 12:00 PM EAT', location: 'Online · Member webinar', category: 'Workshop', description: 'A practical session on business planning, reaching new customers, and managing everyday operations. Joining instructions will be available when event registration launches.' },
];
const payments: Payment[] = [
  { id: 'PAY-00241', description: 'Annual membership fee', date: '2026-05-12', amount: 3000, currency: 'KES', status: 'paid' },
  { id: 'PAY-00240', description: 'Member registration fee', date: '2026-05-12', amount: 500, currency: 'KES', status: 'paid' },
];
export const memberService = { setUser: (user: User | null) => { signedInUser = user; }, getMember: () => signedInUser ? { ...member, ...signedInUser, phone: 'Not provided', businessName: 'Not provided', county: 'Not provided' } : member, getMembership: () => membership, getEvents: () => events, getPayments: () => payments };
export const formatDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
export const formatMoney = (amount: number) => `KES ${new Intl.NumberFormat('en-KE').format(amount)}`;
