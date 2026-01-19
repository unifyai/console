'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../UI/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../UI/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { RefreshCw } from 'lucide-react';

interface BalanceProps {
  billingEligibility: {
    userId: string;
    totalSpending: number;
    canEnableMonthlyBilling: boolean;
    minimumSpendRequired: number;
    remainingSpendNeeded: number;
  } | null;
  autoRechargeEnabled: boolean;
}

const Balance = ({ billingEligibility, autoRechargeEnabled }: BalanceProps) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [fullBalance, setFullBalance] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const balanceData = await fetch('/api/billing/balance').then((response) => response.json());

      if (!balanceData) {
        throw new Error('Failed to fetch balance data');
      }

      setBalance(balanceData.balance);
      setFullBalance(balanceData.fullBalance);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, []);

  useEffect(() => {
    const loadBalance = async () => {
      setLoading(true);
      try {
        await fetchBalance();
      } finally {
        setLoading(false);
      }
    };

    loadBalance();
  }, [fetchBalance]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBalance();
    setIsRefreshing(false);
  };

  const handleBuyCredits = async () => {
    try {
      const response = await fetch(`/api/stripe/checkoutSession`);

      if (!response.ok) {
        console.error('Error creating checkout session:', response.statusText);
        return;
      }

      const { url } = await response.json();

      if (url) {
        window.location.assign(url);
      }
    } catch (error) {
      console.error('Error during buy credits:', error);
    }
  };

  const handleOpenPortal = async () => {
    try {
      const response = await fetch('/api/stripe/portalSession');
      if (response.ok) {
        const { url: portalUrl } = await response.json();
        if (portalUrl) {
          window.location.assign(portalUrl);
        }
      } else {
        console.error('Failed to open billing portal');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-h3">Account Balance</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh balance</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="text-body">
          {loading || isRefreshing ? (
            'Loading balance...'
          ) : (
            <>
              Your current balance is <span className="text-primary">${balance}</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col items-start space-y-4">
            <Button className="w-fit" variant="link" onClick={handleBuyCredits}>
              Buy Credits
            </Button>
            <Button
              className="w-fit"
              variant="link"
              onClick={() => window.open('https://calendly.com/unify-chat/general', '_blank')}
            >
              Request Extra Credits
            </Button>
          </div>
          <div className="flex flex-col items-center space-y-4">
            {billingEligibility?.canEnableMonthlyBilling && (
              <Button variant="primary" onClick={handleOpenPortal} className="w-fit">
                Manage Billing Account
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Balance;
