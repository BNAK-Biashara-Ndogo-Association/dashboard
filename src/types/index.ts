export type MembershipStatus = 'pending' | 'active' | 'expired' | 'suspended';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export interface User { id: string; firstName: string; lastName: string; email: string; }
export interface Member extends User { membershipNumber: string; businessName: string; county: string; phone: string; }
export interface Membership { id: string; memberId: string; plan: string; status: MembershipStatus; joinedAt: string; validUntil: string; }
export interface Payment { id: string; description: string; date: string; amount: number; currency: 'KES'; status: PaymentStatus; }
export interface Event { id: string; name: string; date: string; location: string; category: string; description: string; time: string; }
