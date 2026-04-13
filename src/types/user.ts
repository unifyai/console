import { ResponseProps } from './common';

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
  phoneNumber: string | null;
  whatsappNumber: string | null;
  discordId: string | null;
  createdAt: string;
  apiKey: string;
  stripeCustomerId: string;
  organization: {
    name: string;
    roleId: number;
    roleName: string;
  };
  organizations: UserOrganization[];
  /** Set when the user must set up MFA to access an org workspace */
  mfaSetupRequired?: {
    orgId: number;
    orgName: string;
  };
}

export interface UserOrganization {
  id: number;
  name: string;
  ownerId: string;
  roleId: number;
  roleName: string;
  apiKey: string;
  image?: string | null;
  timezone?: string | null;
  freeTrial?: boolean;
}

export interface UserWorkspace {
  id: string;
  name: string;
  type: 'personal' | 'organization';
}

export interface UserUpdateRequest {
  email: string;
  userId: string;
  image: string | null;
  name: string;
  lastName: string;
  jobTitle: string;
  bio: string;
  timezone?: string | null;
  phoneNumber?: string | null;
  whatsappNumber?: string | null;
  discordId?: string | null;
}

export type BalanceDetails = {
  balance: number | null;
  nextPayment: number | null;
  minCutoff: number | null;
};

// Business classification types
export type AccountType = 'individual' | 'business';

export interface BusinessAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
}

export interface BusinessInfo {
  businessName: string;
  taxId: string;
  businessType: string;
  businessAddress: BusinessAddress;
  taxExempt: boolean;
}

export interface UserBusinessStatusResponse {
  accountType: AccountType;
  businessName?: string;
  taxId?: string;
  businessType?: string;
  businessVerified: boolean;
  taxExempt: boolean;
  taxJurisdiction?: string;
  businessAddress?: BusinessAddress;
}

export interface OnboardingStatusResponse {
  onboarded: boolean;
}

export interface TaxIdValidationRequest {
  taxId: string;
  country: string;
}

export interface TaxIdValidationResponse {
  valid: boolean;
  formattedTaxId?: string;
  errorMessage?: string;
}

export interface SupportedTaxCountryEntry {
  description: string;
  taxIdName: string;
  taxIdFormat: string;
}

export interface SupportedTaxCountriesResponse {
  supportedCountries: Record<string, SupportedTaxCountryEntry>;
  totalCountries: number;
}

export interface ValidateTaxIdRequest {
  taxId: string;
  country: string;
}

export interface TaxCountry {
  code: string;
  name: string;
  taxIdName: string;
  taxIdFormat: string;
}

export interface CreateUserWithBusinessInfoRequest {
  email: string;
  name: string;
  lastName: string;
  jobTitle?: string;
  bio?: string;
  accountType: AccountType;
  businessInfo?: BusinessInfo;
}

export interface UpdateAccountTypeRequest {
  accountType: AccountType;
  businessInfo?: BusinessInfo;
}

export interface UpdateBusinessInfoRequest {
  businessName?: string;
  taxId?: string;
  businessType?: string;
  businessAddress?: BusinessAddress;
  taxExempt?: boolean;
}

export interface UpdateOnboardingStatusRequest {
  onboarded: boolean;
}

export interface UpdateOnboardingStatusResponse {
  message: string;
}
