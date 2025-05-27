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
	image: string;
	email: string;
	createdAt: string;
	apiKey: string;
	stripe_customer_id: string,
	organization: {
		name: string;
		level: string;
	}
	assistant_hiring_approval: ApprovalStatus,
	has_claimed_approval_link: string
}

export interface UserUpdateRequest {
	email: string;
	user_id: string;
	image: string;
	name: string;
	last_name: string;
	job_title: string;
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
