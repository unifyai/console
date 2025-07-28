"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../UI/card";
import { Button } from "../../UI/button";
import { Badge } from "../../UI/badge";
import { Alert, AlertDescription } from "../../UI/alert";
import { Separator } from "../../UI/separator";
import { Edit, Building, User, MapPin, FileText, CheckCircle, AlertCircle } from "lucide-react";
import TaxClassificationForm from "../TaxClassification/TaxClassificationForm";
import { TaxClassificationFormData, UserBusinessStatusResponse } from "@/types/user";

const TaxClassification = () => {
  const [editing, setEditing] = useState(false);
  const [businessStatus, setBusinessStatus] = useState<UserBusinessStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);
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
      const accountTypePayload: any = { account_type: data.account_type };
      if (data.account_type === 'business') {
        accountTypePayload.business_info = {
          business_name: data.business_name,
          tax_id: data.tax_id || null,
          business_type: data.business_type,
          business_address: {
            address_line1: data.business_address.address_line1,
            address_line2: data.business_address.address_line2 || null,
            city: data.business_address.city,
            state: data.business_address.state || null,
            country:
              data.business_address.country.length === 2
                ? data.business_address.country
                : data.tax_country,
            postal_code: data.business_address.postal_code || ''
          },
          tax_exempt: data.tax_exempt,
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

      if (data.account_type === 'business') {
        const businessInfoResponse = await fetch('/api/user/business-info', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_name: data.business_name,
            tax_id: data.tax_id,
            business_type: data.business_type,
            business_address: data.business_address,
            tax_exempt: data.tax_exempt,
            tax_jurisdiction: data.tax_country
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
      console.error("Error saving tax information:", error);
      setAlert({ type: 'error', message: (error as Error).message || 'Failed to update tax information.' });
    } finally {
      setSaving(false);
    }
  };

  const initialData = useMemo(() => {
    if (!businessStatus) return undefined;
    return {
      account_type: businessStatus.account_type,
      business_name: businessStatus.business_name || '',
      business_type: businessStatus.business_type || '',
      tax_id: businessStatus.tax_id || '',
      tax_country: businessStatus.tax_jurisdiction || '',
      business_address: businessStatus.business_address || {
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        country: '',
        postal_code: ''
      },
      tax_exempt: businessStatus.tax_exempt || false
    };
  }, [businessStatus]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Tax Classification</CardTitle>
          <CardDescription>Loading tax information...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Edit Tax Classification</CardTitle>
          <CardDescription>
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
          <div className="flex justify-end space-x-4 mt-6 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => formRef.current?.submit()}
              disabled={!isFormValid || saving}
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
            <CardTitle className="text-2xl">Tax Classification</CardTitle>
            <CardDescription>
              Your account tax classification and business information
            </CardDescription>
          </div>
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="w-4 h-4 mr-2" />
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
            {businessStatus?.account_type === 'business' ? (
              <Building className="w-5 h-5 text-primary" />
            ) : (
              <User className="w-5 h-5 text-primary" />
            )}
            <div>
              <p className="font-medium">Account Type</p>
              <div className="flex items-center space-x-2">
                <Badge variant={businessStatus?.account_type === 'business' ? 'default' : 'secondary'}>
                  {businessStatus?.account_type === 'business' ? 'Business' : 'Individual'}
                </Badge>
                {businessStatus?.tax_exempt && (
                  <Badge variant="outline">Tax Exempt</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Business Information */}
          {businessStatus?.account_type === 'business' && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-lg">Business Information</h4>
                
                {businessStatus.business_name && (
                  <div className="flex items-start space-x-3">
                    <Building className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Business Name</p>
                      <p className="font-medium">{businessStatus.business_name}</p>
                    </div>
                  </div>
                )}

                {businessStatus.business_type && (
                  <div className="flex items-start space-x-3">
                    <FileText className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Business Type</p>
                      <p className="font-medium capitalize">{businessStatus.business_type.replace('_', ' ')}</p>
                    </div>
                  </div>
                )}

                {businessStatus.tax_id && businessStatus.tax_jurisdiction && (
                  <div className="flex items-start space-x-3">
                    <FileText className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tax ID ({businessStatus.tax_jurisdiction})</p>
                      <p className="font-medium">{businessStatus.tax_id}</p>
                    </div>
                  </div>
                )}

                {businessStatus.business_address && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Business Address</p>
                      <div className="font-medium">
                        <p>{businessStatus.business_address.address_line1}</p>
                        {businessStatus.business_address.address_line2 && (
                          <p>{businessStatus.business_address.address_line2}</p>
                        )}
                        <p>
                          {businessStatus.business_address.city}
                          {businessStatus.business_address.state && `, ${businessStatus.business_address.state}`}
                          {businessStatus.business_address.postal_code && ` ${businessStatus.business_address.postal_code}`}
                        </p>
                        <p>{businessStatus.business_address.country}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!businessStatus?.account_type && (
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