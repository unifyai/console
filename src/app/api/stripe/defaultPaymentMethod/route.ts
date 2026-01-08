import { getCustomerDefaultPaymentMethod } from "@/lib/user/billing/stripe/stripe";
import { getUserBillingDetails } from "@/lib/user/billing/billing";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";


/**
 * Returns the default payment method for the authenticated user.
 * If the user does not have a default payment method, returns an error.
 * If the user is not authenticated, returns an error.
 * @param request - The request object
 * @returns A JSON response containing the default payment method ID
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  
  const billingDetails = await getUserBillingDetails(user.id as string);
  var customerID = billingDetails[0].stripe_customer_id;

  if (!customerID) {
    return NextResponse.json({ error: "No customer ID found" }, { status: 404 });
  }

  try {
    const defaultPaymentMethod = await getCustomerDefaultPaymentMethod(customerID);
    return NextResponse.json({ defaultPaymentMethod });
  } catch (error) {
    console.error("Error fetching default payment method:", error);
    return NextResponse.json({ error: "Error fetching default payment method" }, { status: 500 });
  }
}
