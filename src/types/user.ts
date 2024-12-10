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
