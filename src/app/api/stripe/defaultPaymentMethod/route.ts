import { getCustomerDefaultPaymentMethod } from "@/lib/user/billing/stripe/stripe";
import { getUserBillingDetails } from "@/lib/user/billing/billing";
import { NextRequest, NextResponse } from "next/server";
import { createNewStripeCustomer } from "@/lib/user/billing/stripe/stripe";
import { getCurrentUser, getSession } from "@/lib/user/user";


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

  try {
    // Get the user's billing details
    const billingDetails = await getUserBillingDetails(user.id as string);

    // Get the customer ID from the billing details
    var customerID = billingDetails[0].stripe_customer_id;

    // Check if the customer ID is not found
    if (!customerID) {
      const user = await getCurrentUser();

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const email = user.email;
      const name = user.name;

      if (!email || !name) {
        return NextResponse.json({ error: "User email or name not found" }, { status: 404 });
      }
      
      customerID = await createNewStripeCustomer(email ?? "", name ?? "");
    }
      

    // Get the default payment method for the customer
    const defaultPaymentMethod = await getCustomerDefaultPaymentMethod(customerID);

    // Return the default payment method ID as a JSON response
    return NextResponse.json({ defaultPaymentMethod });
  } catch (error) {
    console.error("Error fetching default payment method:", error);
    // Return an error response if there was an error
    return NextResponse.json({ error: "Error fetching default payment method" }, { status: 500 });
  }
}
