import { ResponseProps } from "./common";

export interface Session {
	user: {
		id: string;
		name: string;
		email: string;
		image: string;
		createdAt: string;
		apiKey: string;
	};
}

export interface User {
	id: string;
	name: string;
	lastName: string;
	jobTitle: string;
	bio: string;
	image: string;
	timezone: string | null;
	email: string;
	createdAt: string;
	apiKey: string;
	stripe_customer_id: string,
	organization: {
		name: string;
		level: string;
	},
	organizations: UserOrganization[],
	assistant_hiring_approval: ApprovalStatus,
	has_claimed_approval_link: string
}

export interface UserOrganization {
  id: number;
  name: string;
  level: string;
  apiKey: string;
}

export interface UserWorkspace {
  id: string;
  name: string;
  type: 'personal' | 'organization';
}

export interface UserUpdateRequest {
	email: string;
	user_id: string;
	image: string | null;
	name: string;
	last_name: string;
	job_title: string;
	bio: string;
	timezone?: string | null;
}

export type BalanceDetails = {
	balance: number | null;
	nextPayment: number | null;
	minCutoff: number | null;
};

// Assistant hiring approval interfaces
export type ApprovalStatus = "approved" | "pending" | "rejected" | "revoked" | null;

export interface HiringProfileData {
    assistant_hiring_approval: string | null;
    has_claimed_approval_link: boolean;
}

export interface AssistantHiringApprovalResponse extends ResponseProps {
	message: string;
	assistant_hiring_approval?: string | null;
}

// Business classification types
export type AccountType = "individual" | "business";

export interface BusinessAddress {
	address_line1: string;
	address_line2?: string;
	city: string;
	state?: string;
	country: string;
	postal_code?: string;
}

export interface BusinessInfo {
	business_name: string;
	tax_id: string;
	business_type: string;
	business_address: BusinessAddress;
	tax_exempt: boolean;
}

export interface UserBusinessStatusResponse {
	account_type: AccountType;
	business_name?: string;
	tax_id?: string;
	business_type?: string;
	business_verified: boolean;
	tax_exempt: boolean;
	tax_jurisdiction?: string;
	business_address?: BusinessAddress;
}

export interface OnboardingStatusResponse {
  onboarded: boolean;
}

export interface TaxIdValidationRequest {
	tax_id: string;
	country: string;
}

export interface TaxIdValidationResponse {
	valid: boolean;
	formatted_tax_id?: string;
	error_message?: string;
}

export interface SupportedTaxCountriesResponse {
  supported_countries: Record<string, string>;
  total_countries: number;
}

export interface ValidateTaxIdRequest {
  tax_id: string;
  country: string;
}

export interface TaxCountry {
  code: string;
  name: string;
  tax_id_name: string;
  tax_id_format: string;
}

export interface CreateUserWithBusinessInfoRequest {
	email: string;
	name: string;
	last_name: string;
	job_title?: string;
	bio?: string;
	account_type: AccountType;
	business_info?: BusinessInfo;
}

export interface UpdateAccountTypeRequest {
	account_type: AccountType;
	business_info?: BusinessInfo;
}

export interface UpdateBusinessInfoRequest {
	business_name?: string;
	tax_id?: string;
	business_type?: string;
	business_address?: BusinessAddress;
	tax_exempt?: boolean;
}

export interface UpdateOnboardingStatusRequest {
  onboarded: boolean;
}

export interface UpdateOnboardingStatusResponse {
  message: string;
}

export interface TaxClassificationFormData {
	account_type: AccountType;
	business_name: string;
	tax_id: string;
	business_type: string;
	business_address: BusinessAddress;
	tax_exempt: boolean;
	tax_country: string;
}