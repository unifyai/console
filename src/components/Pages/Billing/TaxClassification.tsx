'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { Alert, AlertDescription } from '../../UI/alert';
import { Separator } from '../../UI/separator';
import { Edit, Building, User, MapPin, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import TaxClassificationForm from '../TaxClassification/TaxClassificationForm';
import { TaxClassificationFormData, UserBusinessStatusResponse } from '@/types/user';

const TaxClassification = () => {
  const [editing, setEditing] = useState(false);
  const [businessStatus, setBusinessStatus] = useState<UserBusinessStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const formRef = useRef<{ submit: () => void } | null>(null);

  const fetchBusinessStatus = async () => {
    try {
      const response = await fetch('/api/user/business-status');
      if (response.ok) {
        const data = await response.json();
        setBusinessStatus(data);
      }
    } catch (error) {
      console.error('Error fetching business status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessStatus();
  }, []);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const handleEdit = () => {
    setEditing(true);
    setAlert(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setAlert(null);
  };

  const handleSave = async (data: TaxClassificationFormData) => {
    setSaving(true);
    setAlert(null);

    try {
      const accountTypePayload: any = { accountType: data.accountType };
      if (data.accountType === 'business') {
        accountTypePayload.businessInfo = {
          businessName: data.businessName,
          taxId: data.taxId || null,
          businessType: data.businessType,
          businessAddress: {
            addressLine1: data.businessAddress.addressLine1,
            addressLine2: data.businessAddress.addressLine2 || null,
            city: data.businessAddress.city,
            state: data.businessAddress.state || null,
            country:
              data.businessAddress.country.length === 2
                ? data.businessAddress.country
                : data.taxCountry,
            postalCode: data.businessAddress.postalCode || '',
          },
          taxExempt: data.taxExempt,
        };
      }

      const accountTypeResponse = await fetch('/api/user/account-type', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountTypePayload),
      });

      if (!accountTypeResponse.ok) {
        throw new Error('Failed to update account type.');
      }

      if (data.accountType === 'business') {
        const businessInfoResponse = await fetch('/api/user/business-info', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName: data.businessName,
            taxId: data.taxId,
            businessType: data.businessType,
            businessAddress: data.businessAddress,
            taxExempt: data.taxExempt,
            taxJurisdiction: data.taxCountry,
          }),
        });
        if (!businessInfoResponse.ok) {
          throw new Error('Failed to update business information.');
        }
      }

      await fetchBusinessStatus(); // Refresh data
      setEditing(false); // Exit editing mode
      setAlert({ type: 'success', message: 'Tax information updated successfully!' });
    } catch (error) {
      console.error('Error saving tax information:', error);
      setAlert({
        type: 'error',
        message: (error as Error).message || 'Failed to update tax information.',
      });
    } finally {
      setSaving(false);
    }
  };

  const initialData = useMemo(() => {
    if (!businessStatus) return undefined;
    return {
      accountType: businessStatus.accountType,
      businessName: businessStatus.businessName || '',
      businessType: businessStatus.businessType || '',
      taxId: businessStatus.taxId || '',
      taxCountry: businessStatus.taxJurisdiction || '',
      businessAddress: businessStatus.businessAddress || {
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
      },
      taxExempt: businessStatus.taxExempt || false,
    };
  }, [businessStatus]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-h3">Tax Classification</CardTitle>
          <CardDescription className="text-body">Loading tax information...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-h3">Edit Tax Classification</CardTitle>
          <CardDescription className="text-body">
            Update your tax classification and business information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxClassificationForm
            onSubmit={handleSave}
            onValidationChange={(isValid) => setIsFormValid(isValid)}
            isLoading={saving}
            error={alert?.type === 'error' ? alert.message : undefined}
            initialData={initialData}
            ref={formRef as any}
          />

          {/* Save/Cancel Buttons */}
          <div className="mt-6 flex justify-end space-x-4 border-t pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              className="text-body"
            >
              Cancel
            </Button>
            <Button
              onClick={() => formRef.current?.submit()}
              disabled={!isFormValid || saving}
              className="text-body"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-h3">Tax Classification</CardTitle>
            <CardDescription className="text-body">
              Your account tax classification and business information
            </CardDescription>
          </div>
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {alert && (
          <Alert variant={alert.type === 'error' ? 'destructive' : 'default'} className="mb-4">
            {alert.type === 'error' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* Account Type */}
          <div className="flex items-center space-x-3">
            {businessStatus?.accountType === 'business' ? (
              <Building className="h-5 w-5 text-primary" />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
            <div>
              <p className="text-label">Account Type</p>
              <div className="flex items-center space-x-2">
                <Badge
                  variant={businessStatus?.accountType === 'business' ? 'default' : 'secondary'}
                >
                  {businessStatus?.accountType === 'business' ? 'Business' : 'Individual'}
                </Badge>
                {businessStatus?.taxExempt && <Badge variant="outline">Tax Exempt</Badge>}
              </div>
            </div>
          </div>

          {/* Business Information */}
          {businessStatus?.accountType === 'business' && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-title">Business Information</h4>

                {businessStatus.businessName && (
                  <div className="flex items-start space-x-3">
                    <Building className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-caption">Business Name</p>
                      <p className="text-body text-strong">{businessStatus.businessName}</p>
                    </div>
                  </div>
                )}

                {businessStatus.businessType && (
                  <div className="flex items-start space-x-3">
                    <FileText className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-caption">Business Type</p>
                      <p className="text-body text-strong capitalize">
                        {businessStatus.businessType.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                )}

                {businessStatus.taxId && businessStatus.taxJurisdiction && (
                  <div className="flex items-start space-x-3">
                    <FileText className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-caption">Tax ID ({businessStatus.taxJurisdiction})</p>
                      <p className="text-body text-strong">{businessStatus.taxId}</p>
                    </div>
                  </div>
                )}

                {businessStatus.businessAddress && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-caption">Business Address</p>
                      <div className="text-body text-strong">
                        <p>{businessStatus.businessAddress.addressLine1}</p>
                        {businessStatus.businessAddress.addressLine2 && (
                          <p>{businessStatus.businessAddress.addressLine2}</p>
                        )}
                        <p>
                          {businessStatus.businessAddress.city}
                          {businessStatus.businessAddress.state &&
                            `, ${businessStatus.businessAddress.state}`}
                          {businessStatus.businessAddress.postalCode &&
                            ` ${businessStatus.businessAddress.postalCode}`}
                        </p>
                        <p>{businessStatus.businessAddress.country}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!businessStatus?.accountType && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No tax classification found. Please complete your tax classification setup.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaxClassification;
