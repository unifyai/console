'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
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
import { ISO_COUNTRY_CODES } from '@/constants/countries';
import { getCountryName } from '@/utils/assistants/country-utils';
import {
  isPostalCodeRequired,
  isPostalCodeValid,
  isStateRequired,
  postalCodeExample,
} from '@/lib/billing/address-rules';
import type {
  BillingActions,
  BillingProfileData,
  TaxCountry,
  TaxIdValidationResponse,
  SupportedTaxCountriesResponse,
  SupportedTaxCountryEntry,
} from '@/types/billing';

// Country-aware address rules (postal/state requirement + postal formats)
// live in a shared module so the subscribe-time gate uses the same logic.
// Authoritative validation still happens server-side against Stripe.

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

    // The tax jurisdiction is the billing-address country — there's no
    // separate "tax country". A tax ID is always issued by (and validated
    // against) the country you're billed in, and Stripe computes tax from the
    // address anyway. Keeping a second selector only risked the two
    // disagreeing (and the backend validates the tax ID against the *address*
    // country regardless), so the tax-ID type/label/format below is derived
    // from `billingAddress.country`.
    const taxCountry = formData.billingAddress.country;

    const [supportedCountries, setSupportedCountries] = useState<TaxCountry[]>([]);
    const [taxIdValidation, setTaxIdValidation] = useState<TaxIdValidationResponse | null>(null);
    const [validatingTaxId, setValidatingTaxId] = useState(false);
    const [loadingCountries, setLoadingCountries] = useState(true);

    // Full country list (ISO-2 code → localized name) for the billing-address
    // Country dropdown. Names are derived from the code so we store the code
    // Stripe expects while showing the user a readable name.
    const countryOptions = useMemo(
      () =>
        ISO_COUNTRY_CODES.map((code) => ({ code, name: getCountryName(code) || code })).sort(
          (a, b) => a.name.localeCompare(b.name)
        ),
      []
    );

    // Pre-render the dropdown <SelectItem> trees once and memoize them. Without
    // this the ~250 address-country items (plus the tax-country list) are
    // recreated on every keystroke in any field, forcing React to reconcile
    // hundreds of items per character and making typing feel sluggish. Stable
    // element references let React skip those subtrees entirely.
    const countryItems = useMemo(
      () =>
        countryOptions.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.name}
          </SelectItem>
        )),
      [countryOptions]
    );

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

    // ── Derive taxIdType from the billing-address country ────────────────
    // The tax-ID type follows the country you're billed in. If that country
    // isn't a supported tax jurisdiction we clear the type (and hide the tax
    // ID input below) rather than guessing a default.
    useEffect(() => {
      const country = supportedCountries.find((c) => c.code === taxCountry);
      setFormData((prev) => ({
        ...prev,
        taxIdType: country?.stripeTaxIdType || '',
      }));
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
      // Required: name + a billing address Stripe automatic tax can resolve.
      // line1/city/country are always required; a postal code is required only
      // for countries that use one (the UAE etc. don't), and a state only for
      // the regions that need it (US/CA). Where we know the postal format
      // (US/CA/GB) it must also be well-formed.
      if (!formData.name.trim()) return false;
      const { line1, city, postalCode, country, state } = formData.billingAddress;
      if (!line1.trim()) return false;
      if (!city.trim()) return false;
      if (!country.trim()) return false;
      if (isPostalCodeRequired(country) && !postalCode.trim()) return false;
      if (isStateRequired(country) && !state.trim()) return false;
      // A provided postal code must match the country's format (when known).
      if (postalCode.trim() && !isPostalCodeValid(country, postalCode)) return false;
      // If a tax ID is entered, it should be valid
      if (formData.taxId && taxIdValidation && !taxIdValidation.valid) return false;
      return true;
    }, [formData, taxIdValidation]);

    useEffect(() => {
      onValidationChange(isFormValid());
    }, [formData, taxIdValidation, onValidationChange, isFormValid]);

    const selectedCountry = supportedCountries.find((c) => c.code === taxCountry);

    // Inline address validation flags (instant feedback; Stripe is the
    // authoritative check on save).
    const addrCountry = formData.billingAddress.country;
    const stateRequired = isStateRequired(addrCountry);
    const stateMissing = stateRequired && !formData.billingAddress.state.trim();
    const postalRequired = isPostalCodeRequired(addrCountry);
    const postalExample = postalCodeExample(addrCountry);
    const postalInvalid =
      !!formData.billingAddress.postalCode.trim() &&
      !isPostalCodeValid(addrCountry, formData.billingAddress.postalCode);

    // ── Render ───────────────────────────────────────────────────────────
    return (
      <div className="w-full space-y-8">
        {/* ── Billing Contact ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-label font-semibold">Billing Contact</h3>

          <div className="space-y-2">
            <Label htmlFor="billingName" className="text-label text-xs">
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

          <div className="space-y-2">
            <Label htmlFor="billingEmail" className="text-label text-xs">
              Email
            </Label>
            <Input
              id="billingEmail"
              type="email"
              value={formData.billingEmail}
              onChange={(e) => handleInputChange('billingEmail', e.target.value)}
              placeholder="billing@example.com"
              className="h-10"
            />
            <p className="text-caption">
              Invoices and payment receipts will be sent to this email.
            </p>
          </div>
        </section>

        {/* ── Billing Address ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-label font-semibold">Billing Address</h3>

          <div className="space-y-2">
            <Label htmlFor="addrLine1" className="text-label text-xs">
              Address Line 1 *
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

          <div className="space-y-2">
            <Label htmlFor="addrCountry" className="text-label text-xs">
              Country *
            </Label>
            <Select
              value={formData.billingAddress.country}
              onValueChange={(v) => handleAddressChange('country', v)}
            >
              <SelectTrigger id="addrCountry" className="h-10">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>{countryItems}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="addrCity" className="text-label text-xs">
                City *
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
                State / Province{stateRequired ? ' *' : ''}
              </Label>
              <Input
                id="addrState"
                value={formData.billingAddress.state}
                onChange={(e) => handleAddressChange('state', e.target.value)}
                placeholder={addrCountry === 'US' ? 'State (e.g. CA)' : 'State or Province'}
                className="h-10"
              />
              {stateMissing && (
                <p className="text-caption text-error">
                  Required for {addrCountry === 'US' ? 'US' : 'Canadian'} tax calculation.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="addrPostal" className="text-label text-xs">
                Postal Code{postalRequired ? ' *' : ''}
              </Label>
              <Input
                id="addrPostal"
                value={formData.billingAddress.postalCode}
                onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                placeholder={
                  postalExample
                    ? `e.g. ${postalExample}`
                    : postalRequired
                      ? 'Postal code'
                      : 'Postal code (optional)'
                }
                className="h-10"
              />
              {postalInvalid && (
                <p className="text-caption text-error">
                  Enter a valid {getCountryName(addrCountry) || addrCountry} postal code
                  {postalExample ? ` (e.g. ${postalExample})` : ''}.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Tax Information ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h3 className="text-label font-semibold">Tax Information (For businesses)</h3>
            <p className="text-caption">
              Add a tax ID (e.g. VAT/EIN) for tax treatment and compliant invoices.
            </p>
          </div>

          {!addrCountry ? (
            <p className="text-caption text-muted-foreground" data-testid="tax-id-needs-country">
              Select your billing country above to add a tax ID.
            </p>
          ) : loadingCountries ? null : !selectedCountry ? (
            <p className="text-caption text-muted-foreground" data-testid="tax-id-unsupported">
              A tax ID isn&apos;t required for {getCountryName(addrCountry) || addrCountry}.
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="taxId" className="text-label text-xs">
                {selectedCountry.taxIdName || 'Tax ID'} (
                {getCountryName(addrCountry) || addrCountry})
              </Label>
              <div className="relative">
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => handleInputChange('taxId', e.target.value)}
                  placeholder={selectedCountry.taxIdFormat || 'Enter tax ID'}
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
                      <Check className="h-4 w-4 text-green-500" />
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
          )}
        </section>

        {error && <p className="text-caption text-error">{error}</p>}
      </div>
    );
  }
);

BillingProfileForm.displayName = 'BillingProfileForm';

export default BillingProfileForm;
