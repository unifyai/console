'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { Loader2, Check, X } from 'lucide-react';
import type {
  BillingActions,
  BillingProfileData,
  TaxCountry,
  TaxIdValidationResponse,
  SupportedTaxCountriesResponse,
  SupportedTaxCountryEntry,
} from '@/types/billing';

// ============================================================================
// Props & Handles
// ============================================================================

interface BillingProfileFormProps {
  /** Server-action-bound billing actions */
  actions: BillingActions;
  onSubmit: (data: BillingProfileData) => void;
  onValidationChange: (isValid: boolean) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string;
  initialData?: Partial<BillingProfileData>;
}

interface BillingProfileFormHandle {
  submit: () => void;
}

// ============================================================================
// Component
// ============================================================================

const BillingProfileForm = forwardRef<BillingProfileFormHandle, BillingProfileFormProps>(
  ({ actions, onSubmit, onValidationChange, onCancel, isLoading, error, initialData }, ref) => {
    const [formData, setFormData] = useState<BillingProfileData>({
      name: '',
      billingEmail: '',
      taxId: '',
      taxIdType: '',
      billingAddress: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
      },
    });

    // Tax country (ISO code) drives taxIdType; stored separately from address country
    const [taxCountry, setTaxCountry] = useState('');

    const [supportedCountries, setSupportedCountries] = useState<TaxCountry[]>([]);
    const [taxIdValidation, setTaxIdValidation] = useState<TaxIdValidationResponse | null>(null);
    const [validatingTaxId, setValidatingTaxId] = useState(false);
    const [loadingCountries, setLoadingCountries] = useState(true);

    useImperativeHandle(ref, () => ({
      submit: () => {
        if (isFormValid()) {
          onSubmit(formData);
        }
      },
    }));

    // ── Fetch supported tax countries ────────────────────────────────────
    useEffect(() => {
      const fetchSupportedCountries = async () => {
        try {
          const result = await actions.getSupportedTaxCountries();
          if ('detail' in result) {
            console.error('Error fetching supported countries:', result.detail);
          } else {
            const data = result as SupportedTaxCountriesResponse;
            const list: TaxCountry[] = Object.entries(data.supportedCountries)
              .map(([code, entry]: [string, SupportedTaxCountryEntry]) => ({
                code,
                name: entry.name,
                taxIdName: entry.taxIdName,
                taxIdFormat: entry.taxIdFormat,
                stripeTaxIdType: entry.stripeTaxIdType,
              }))
              .sort((a, b) => a.name.localeCompare(b.name));
            setSupportedCountries(list);
          }
        } catch (e) {
          console.error('Error fetching supported countries:', e);
        } finally {
          setLoadingCountries(false);
        }
      };
      fetchSupportedCountries();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Tax ID validation ────────────────────────────────────────────────
    useEffect(() => {
      if (formData.taxId && taxCountry) {
        setTaxIdValidation(null);
        const validate = async () => {
          setValidatingTaxId(true);
          try {
            const sanitized = formData.taxId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const result = await actions.validateTaxId({
              taxId: sanitized,
              country: taxCountry,
            });
            if ('detail' in result) {
              setTaxIdValidation({
                valid: false,
                errorMessage: result.detail || 'Invalid tax ID',
              });
            } else {
              setTaxIdValidation(result as TaxIdValidationResponse);
            }
          } catch {
            setTaxIdValidation({
              valid: false,
              errorMessage: 'Unable to validate tax ID.',
            });
          } finally {
            setValidatingTaxId(false);
          }
        };
        const tid = setTimeout(validate, 500);
        return () => clearTimeout(tid);
      } else {
        setTaxIdValidation(null);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.taxId, taxCountry]);

    // ── Sync taxCountry → billingAddress.country + taxIdType ─────────────
    useEffect(() => {
      if (taxCountry) {
        const country = supportedCountries.find((c) => c.code === taxCountry);
        setFormData((prev) => ({
          ...prev,
          taxIdType: country?.stripeTaxIdType || 'eu_vat',
          billingAddress: {
            ...prev.billingAddress,
            country: taxCountry,
          },
        }));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taxCountry, supportedCountries]);

    // ── Sync initialData ─────────────────────────────────────────────────
    useEffect(() => {
      if (initialData) {
        setFormData((prev) => ({
          ...prev,
          ...initialData,
          billingAddress: {
            ...prev.billingAddress,
            ...(initialData.billingAddress ?? {}),
          },
        }));
        // Derive taxCountry from billingAddress.country if available
        if (initialData.billingAddress?.country) {
          setTaxCountry(initialData.billingAddress.country);
        }
      }
    }, [initialData]);

    // ── Field handlers ───────────────────────────────────────────────────
    const handleInputChange = (field: keyof BillingProfileData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleAddressChange = (
      field: keyof BillingProfileData['billingAddress'],
      value: string
    ) => {
      setFormData((prev) => ({
        ...prev,
        billingAddress: { ...prev.billingAddress, [field]: value },
      }));
    };

    // ── Validation ───────────────────────────────────────────────────────
    const isFormValid = useCallback(() => {
      // Name is the only strictly required field
      if (!formData.name.trim()) return false;
      // If a tax ID is entered, it should be valid
      if (formData.taxId && taxIdValidation && !taxIdValidation.valid) return false;
      return true;
    }, [formData, taxIdValidation]);

    useEffect(() => {
      onValidationChange(isFormValid());
    }, [formData, taxIdValidation, onValidationChange, isFormValid]);

    const selectedCountry = supportedCountries.find((c) => c.code === taxCountry);

    // ── Render ───────────────────────────────────────────────────────────
    return (
      <div className="w-full space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="billingName" className="text-label">
            Name *
          </Label>
          <Input
            id="billingName"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Your name or business name"
            required
            className="h-10"
          />
          <p className="text-caption">This name will appear on invoices and receipts.</p>
        </div>

        {/* Billing Email */}
        <div className="space-y-2">
          <Label htmlFor="billingEmail" className="text-label">
            Billing Email
          </Label>
          <Input
            id="billingEmail"
            type="email"
            value={formData.billingEmail}
            onChange={(e) => handleInputChange('billingEmail', e.target.value)}
            placeholder="billing@example.com"
            className="h-10"
          />
          <p className="text-caption">Invoices and payment receipts will be sent to this email.</p>
        </div>

        {/* Tax Country */}
        <div className="space-y-2">
          <Label htmlFor="taxCountry" className="text-label">
            Tax Country
          </Label>
          <Select value={taxCountry} onValueChange={setTaxCountry} disabled={loadingCountries}>
            <SelectTrigger className="h-10">
              <SelectValue
                placeholder={loadingCountries ? 'Loading countries...' : 'Select tax country'}
              />
            </SelectTrigger>
            <SelectContent>
              {supportedCountries.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tax ID */}
        <div className="space-y-2">
          <Label htmlFor="taxId" className="text-label">
            {selectedCountry?.taxIdName || 'Tax ID'}
          </Label>
          <div className="relative">
            <Input
              id="taxId"
              value={formData.taxId}
              onChange={(e) => handleInputChange('taxId', e.target.value)}
              placeholder={selectedCountry?.taxIdFormat || 'Enter tax ID'}
              className="h-10"
            />
            {validatingTaxId && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {taxIdValidation && !validatingTaxId && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {taxIdValidation.valid ? (
                  <Check className="h-4 w-4 text-[color:var(--status-success)]" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </div>
            )}
          </div>
          {taxIdValidation && !taxIdValidation.valid && (
            <p className="text-caption text-error">{taxIdValidation.errorMessage}</p>
          )}
        </div>

        {/* Billing Address */}
        <div className="space-y-4">
          <Label className="text-label font-medium">Billing Address</Label>

          <div className="space-y-2">
            <Label htmlFor="addrLine1" className="text-label text-xs">
              Address Line 1
            </Label>
            <Input
              id="addrLine1"
              value={formData.billingAddress.line1}
              onChange={(e) => handleAddressChange('line1', e.target.value)}
              placeholder="Street address"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addrLine2" className="text-label text-xs">
              Address Line 2
            </Label>
            <Input
              id="addrLine2"
              value={formData.billingAddress.line2}
              onChange={(e) => handleAddressChange('line2', e.target.value)}
              placeholder="Apartment, suite, unit, etc. (optional)"
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addrCity" className="text-label text-xs">
                City
              </Label>
              <Input
                id="addrCity"
                value={formData.billingAddress.city}
                onChange={(e) => handleAddressChange('city', e.target.value)}
                placeholder="City"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addrState" className="text-label text-xs">
                State / Province
              </Label>
              <Input
                id="addrState"
                value={formData.billingAddress.state}
                onChange={(e) => handleAddressChange('state', e.target.value)}
                placeholder="State or Province"
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addrCountry" className="text-label text-xs">
                Country
              </Label>
              <Input
                id="addrCountry"
                value={formData.billingAddress.country}
                onChange={(e) => handleAddressChange('country', e.target.value)}
                placeholder="Country (ISO-2)"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addrPostal" className="text-label text-xs">
                Postal Code
              </Label>
              <Input
                id="addrPostal"
                value={formData.billingAddress.postalCode}
                onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                placeholder="Postal code"
                className="h-10"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-caption text-error">{error}</p>}
      </div>
    );
  }
);

BillingProfileForm.displayName = 'BillingProfileForm';

export default BillingProfileForm;
