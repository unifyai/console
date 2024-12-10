import React, { useState, useEffect } from "react";
import BaseButton from "../Common/Buttons/Base";
import { BasePopover } from "../Common/Popovers/Base";
import Tooltip from "../Common/Misc/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { useSession } from "next-auth/react";
import getStripe from "@/lib/user/billing/stripe/get-stripe";
import truncateToTwoDecimals from "@/utils/math";
import { getCurrentUser } from "@/lib/user/user";
import BaseCard from "../Common/Card/Base";
import { Info } from "lucide-react";
import { BalanceDetails, User } from "@/types/user";
import BillingPortal from "./Portal";

const AccountBalance = ({ setIsSidebarOpen }: {
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  // const [autoRechargeEnabled, setAutoRechargeEnabled] = useState<boolean | null>(null);
  const [fullBalance, setFullBalance] = useState<string | null>(null);
  const [balanceDetails, setBalanceDetails] = useState<BalanceDetails>({
      balance: null,
      nextPayment: null,
      minCutoff: null,
  });
  const [claimFreeCredits, setClaimFreeCredits] = useState<boolean>(false);
  const [messageType, setMessageType] = useState<string>("loading");
  const [freezeButton, setFreezeButton] = useState<boolean>(true);
  const [loadingButton, setLoadingButton] = useState<boolean>(true);

  const freeCreditsMessages: { [key: string]: string } = {
    no_card:
      "To claim your free credits, first add a payment card through the billing portal at the bottom of the page. Then refresh this page.",
    duplicate:
      "It looks like your cards are used in other accounts. Please add a new card to get your free credits. Then refresh this page.",
    success: "Free credits successfully activated! You can refresh the page to view your updated balance.",
    failure: "An error occurred when updating your balance, try again or contact us if the issue persists.",
    loading:
      "Please wait while we check your credits. If loading takes too long, try to refresh the page or contact us if the issue persists.",
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch billing details with userid as param
        const billingResponse = await fetch(`/api/billing/details`);
        const billingData = await billingResponse.json();
        const userDetails = billingData[0];

        // Handle account specs
        setFullBalance(userDetails.credits);
        setBalanceDetails({
          balance:
            userDetails.credits != null
              ? truncateToTwoDecimals(parseFloat(userDetails.credits))
              : null,
          nextPayment:
            userDetails.autorecharge_qty != null
              ? truncateToTwoDecimals(parseFloat(userDetails.autorecharge_qty))
              : null,
          minCutoff:
            userDetails.autorecharge_threshold != null
              ? truncateToTwoDecimals(parseFloat(userDetails.autorecharge_threshold))
              : null,
        });
        // setAutoRechargeEnabled(userDetails.autorecharge);

        const customerID = userDetails.stripe_customer_id;

        // Fetch user cards
        const cardsResponse = await fetch(`/api/stripe/userCards?customerID=${customerID}`);
        const userCards = await cardsResponse.json();

        if (userCards.length > 0) {
          // Fetch stored cards
          const storedCardsResponse = await fetch(`/api/freeCredits/storedCards`);
          const storedCards = await storedCardsResponse.json();

          const newCards = userCards.filter(
            (item: string) =>
              !storedCards
                .map((card: { user_id: string; fingerprint: string }) => card.fingerprint)
                .includes(item)
          );

          if (newCards.length > 0) {
            await Promise.all(
              newCards.map(async (fingerprint: string) => {
                await fetch(`/api/freeCredits/storeCard`, {
                  method: "POST",
                  body: JSON.stringify({ fingerprint }),
                  headers: {
                    "Content-Type": "application/json",
                  },
                });
              })
            );
          }
        }

        // Handle free credits claim
        const freeRechargesResponse = await fetch(`/api/freeCredits/recharges`);
        const freeRecharges = await freeRechargesResponse.json();

        const creationDateResponse = await fetch (`/api/freeCredits/creationDate`);
        const creationDate = await creationDateResponse.json();
        const cutoff = new Date("2024-06-26");

        if (freeRecharges.length === 0 && creationDate > cutoff) {
          setClaimFreeCredits(true);
          if (customerID) {
            if (userCards.length > 0) {
              const duplicationStatuses = await Promise.all(
                userCards.map(async (fingerprint: string) => {
                  const res = await fetch(`/api/freeCredits/isDuplicateCard`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({fingerprint }),
                  });
                  const data = await res.json();
                  return data.isDuplicate;
                })
              );
              const anyUnique = duplicationStatuses.some((check: boolean) => check === false);
              if (anyUnique) {
                setMessageType("success");
                setLoadingButton(false);
                setFreezeButton(false);
              } else {
                setMessageType("duplicate");
                setLoadingButton(false);
                setFreezeButton(false);
              }
            } else {
              setMessageType("no_card");
              setLoadingButton(false);
              setFreezeButton(false);
            }
          } else {
            setMessageType("failure");
            setLoadingButton(false);
            setFreezeButton(false);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [session]);

  const handleBuyCredits = async () => {
    setLoading(true);

    try {
      //add userID as named param
      const response = await fetch(`/api/stripe/checkoutSession`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      console.log(response);

      if (response.status === 429) {
        console.error("Error creating checkout session:", response.statusText);
        return;
      }

      if (!response.ok) {
        console.error("Error creating checkout session:", response.statusText);
        return;
      }

      const { client_secret, url } = await response.json();

      if (!client_secret && url) {
        window.location.assign(url);
      } else {
        setClientSecret(client_secret);
        setIsSidebarOpen(true);
      }
    } catch (error) {
    }

    setLoading(false);
  };

  const handleCloseSidebar = () => {
    setClientSecret(null);
    setIsSidebarOpen(false);
  };

  const handleFreeCredits = async () => {

    if (messageType === "success") {
      setFreezeButton(true);
      await fetch(`/api/freeCredits/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({amount: 10 }),
      });
    }
  };
  
  const manualRefills = (
    <div className="flex flex-col">
      <BaseButton className="justify-start" variant="link" onClick={handleBuyCredits} disabled={loading} text="Buy Credits"/>
      <BaseButton className="justify-start" variant="link" onClick={() => window.open("https://calendly.com/unify-chat/general")} disabled={loading} text="Request Extra Credits"/>
      {claimFreeCredits && 
        <BasePopover
          button={
            <BaseButton
              variant="ghost"
              onClick={handleFreeCredits}
              disabled={freezeButton || loadingButton}
              text={loadingButton ? "Loading free credits" : "Claim free credits"}
            />
          }
        >
          {freeCreditsMessages[messageType]}
        </BasePopover>
      }
    </div>
  )

  const balance = <div className="flex flex-row items-center justify-between gap-10">
                    <Tooltip content={`${fullBalance}`}>
                      <p className="text-7xl font-semibold cursor-pointer">
                        ${balanceDetails?.balance}
                      </p>
                    </Tooltip>
                    {manualRefills}
                  </div>

  const secret =  <div 
                    className={`fixed inset-0 md:right-4 md:left-auto md:w-1/2 lg:w-1/5 z-50 transition-transform ${clientSecret ? "translate-x-0" : "translate-x-full"} custom-scrollbar`}
                    style={{
                      borderRadius: "1rem",
                      backgroundColor: "#009600",
                      paddingBottom: "1rem",
                      paddingTop: "1rem",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                      pointerEvents: "auto",
                    }}
                  >
                    <BaseButton
                      onClick={handleCloseSidebar}
                      className="pointer-events-auto absolute top-4 right-4 p-2 text-3xl font-semibold text-foreground bg-background hover:bg-muted rounded-full transition ease-in duration-150"
                      aria-label="Close"
                      icon={<CloseIcon/>}
                    />
                    <div className="p-4 h-full overflow-y-auto custom-scrollbar" style={{ pointerEvents: "auto" }}>
                      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
                        <EmbeddedCheckout className="w-full rounded-lg" />
                      </EmbeddedCheckoutProvider>
                    </div>
                  </div>
  
  const footer =  <div className="flex flex-col gap-5">
                    <div className="flex flex-row gap-2 text-foreground text-300 items-center">
                      <Info className="text-foreground"/>
                      <p className="text-xs text-foreground">{`API calls decrease your balance by the endpoint provider quoted price. No extra markup applied.`}</p>
                    </div>
                    <div className="text-center">
                      <BillingPortal/>
                    </div>
                  </div>

  return (
    <div className="tutorial-credits-balance">
      <BaseCard 
        title="Account Balance" 
        description="Manually top-up your balance and access your billing portal." 
        className="w-full h-full" 
        footer={footer}
      >
        {balance}
      </BaseCard>
      {clientSecret && secret}
    </div>
  );
}

export default AccountBalance