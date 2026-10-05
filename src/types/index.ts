export type MembershipStatus = 'pending' | 'active' | 'expired' | 'suspended';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export interface User { id: string; firstName: string; lastName: string; email: string; }
export interface Member extends User { membershipNumber: string; businessName: string; county: string; phone: string; }
export interface Membership { id: string; memberId: string; plan: string; status: MembershipStatus; joinedAt: string; validUntil: string; }
export interface Payment { id: string; description: string; date: string; amount: number; currency: 'KES'; status: PaymentStatus; }
export interface Event { id: string; name: string; date: string; location: string; category: string; description: string; time: string; }
export interface MembershipPackage { id: string; title: string; amount: number; audience: string; }
export interface KycOptions {
	genders: string[]; ageGroups: string[]; locationTypes: string[]; sectors: string[];
	registrationStatuses: string[]; employeeGroups: string[]; turnoverGroups: string[];
}
export interface MembershipConfig { packages: MembershipPackage[]; counties: string[]; options: KycOptions; }
export interface KycRegistration {
	fullName: string; idNumber: string; gender: string; ageGroup: string; mobileNumber: string;
	county: string; constituency: string; ward: string; businessArea: string; locationType: string;
	otherLocationType: string; locationName: string; businessName: string; sector: string;
	registrationStatus: string; employees: string; turnover: string; packageId: string;
	paymentMobileNumber: string; paymentReference: string; paymentStatus: PaymentStatus;
	membershipStatus: MembershipStatus; membershipNumber: string; kycStatus: string;
	verifiedBy: string; verifiedAt: string; documents: { frontUploaded: boolean; backUploaded: boolean };
}
