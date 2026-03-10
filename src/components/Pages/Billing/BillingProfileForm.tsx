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
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(enLocale);

// ============================================================================
// Types
// ============================================================================

/** Client-side billing profile data (camelCase) */
export interface BillingProfileData {
  individualName: string;
  billingEmail: string;
  taxId: string;
  taxIdType: string;
  billingAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
}

/**
 * Converts camelCase BillingProfileData to the snake_case shape expected by
 * the backend's UserBillingProfileUpdate schema.
 */
export function toApiPayload(data: BillingProfileData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  payload['individual_name'] = data.individualName || undefined;
  payload['billing_email'] = data.billingEmail || undefined;
  payload['tax_id'] = data.taxId || undefined;
  payload['tax_id_type'] = data.taxIdType || undefined;

  if (data.billingAddress.line1) {
    const addr: Record<string, unknown> = {};
    addr.line1 = data.billingAddress.line1;
    addr.line2 = data.billingAddress.line2 || undefined;
    addr.city = data.billingAddress.city || undefined;
    addr.state = data.billingAddress.state || undefined;
    addr.country = data.billingAddress.country || undefined;
    addr['postal_code'] = data.billingAddress.postalCode || undefined;
    payload['billing_address'] = addr;
  }

  return payload;
}

/**
 * Converts the backend's snake_case response into camelCase BillingProfileData.
 */
export function fromApiResponse(raw: Record<string, any>): Partial<BillingProfileData> {
  const addr = raw.billing_address ?? raw.billingAddress;
  return {
    individualName: raw.individual_name ?? raw.individualName ?? '',
    billingEmail: raw.billing_email ?? raw.billingEmail ?? '',
    taxId: raw.tax_id ?? raw.taxId ?? '',
    taxIdType: raw.tax_id_type ?? raw.taxIdType ?? '',
    billingAddress: {
      line1: addr?.line1 ?? '',
      line2: addr?.line2 ?? '',
      city: addr?.city ?? '',
      state: addr?.state ?? '',
      country: addr?.country ?? '',
      postalCode: addr?.postal_code ?? addr?.postalCode ?? '',
    },
  };
}

/** Response from the tax-countries endpoint */
interface TaxCountry {
  code: string;
  name: string;
  taxIdName: string;
  taxIdFormat: string;
}

interface SupportedTaxCountriesResponse {
  supportedCountries: Record<string, string>;
  totalCountries: number;
}

interface TaxIdValidationResponse {
  valid: boolean;
  errorMessage?: string;
}

interface BillingProfileFormProps {
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
// Helpers
// ============================================================================

// Country code to name mapping (common countries)
const countryNames: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  AU: 'Australia',
  CA: 'Canada',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  BE: 'Belgium',
  AT: 'Austria',
  SE: 'Sweden',
  DK: 'Denmark',
  FI: 'Finland',
  IE: 'Ireland',
  PT: 'Portugal',
  NO: 'Norway',
  CH: 'Switzerland',
  JP: 'Japan',
  KR: 'South Korea',
  IN: 'India',
  SG: 'Singapore',
  MY: 'Malaysia',
  TH: 'Thailand',
  BR: 'Brazil',
  MX: 'Mexico',
  RU: 'Russia',
  CN: 'China',
  BG: 'Bulgaria',
  CY: 'Cyprus',
  CZ: 'Czech Republic',
  EE: 'Estonia',
  GR: 'Greece',
  HR: 'Croatia',
  HU: 'Hungary',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  MT: 'Malta',
  PL: 'Poland',
  RO: 'Romania',
  SI: 'Slovenia',
  SK: 'Slovakia',
};

/** Map from tax country description to { name, format } */
const extractTaxIdInfo = (description: string): { name: string; format: string } => {
  const match = description.match(/\(([^)]+)\)/);
  if (match) {
    const taxType = match[1];
    const taxTypeMap: Record<string, { name: string; format: string }> = {
      'us.ein': { name: 'EIN', format: 'XX-XXXXXXX' },
      'gb.vat': { name: 'VAT Number', format: 'GB999999999' },
      'au.abn': { name: 'ABN', format: 'XX XXX XXX XXX' },
      'ca.gst_hst': { name: 'GST/HST Number', format: 'XXXXXXXXX' },
      'de.vat': { name: 'VAT Number', format: 'DEXXXXXXXXX' },
      'fr.tva': { name: 'TVA Number', format: 'FRXXXXXXXXXXX' },
      'it.iva': { name: 'IVA Number', format: 'ITXXXXXXXXXXX' },
      'es.vat': { name: 'VAT Number', format: 'ESXXXXXXXXX' },
      'jp.cn': { name: 'Corporate Number', format: 'XXXXXXXXXXXXX' },
      'nl.btw': { name: 'BTW Number', format: 'NLXXXXXXXXX' },
      'be.vat': { name: 'VAT Number', format: 'BEXXXXXXXXX' },
      'at.uid': { name: 'UID Number', format: 'ATXXXXXXXXX' },
      'se.vat': { name: 'VAT Number', format: 'SEXXXXXXXXX' },
      'dk.cvr': { name: 'CVR Number', format: 'XXXXXXXX' },
      'pt.nif': { name: 'NIF Number', format: 'XXXXXXXXX' },
      'no.mva': { name: 'MVA Number', format: 'XXXXXXXXX' },
      'ch.vat': { name: 'VAT Number', format: 'CHXXXXXXXXX' },
      'kr.brn': { name: 'Business Registration Number', format: 'XXX-XX-XXXXX' },
      'in.gstin': { name: 'GSTIN', format: 'XXXXXXXXXXXX' },
      'sg.uen': { name: 'UEN', format: 'XXXXXXXXX' },
      'my.nric': { name: 'NRIC/Company No.', format: 'XXXXXXXXX' },
      'th.moa': { name: 'MOA Number', format: 'XXXXXXXXX' },
      'br.cnpj': { name: 'CNPJ', format: 'XX.XXX.XXX/XXXX-XX' },
      'mx.rfc': { name: 'RFC', format: 'XXXXXXXXXXX' },
      'ru.inn': { name: 'INN', format: 'XXXXXXXXXX' },
      'cn.uscc': { name: 'USCC', format: 'XXXXXXXXXXXXXXXXX' },
    };
    return taxTypeMap[taxType] || { name: 'Tax ID', format: 'Enter tax ID' };
  }
  if (description.includes('EU VAT')) {
    return { name: 'VAT Number', format: 'Enter VAT number' };
  }
  return { name: 'Tax ID', format: 'Enter tax ID' };
};

// Map country code to Stripe tax ID type string
const countryToStripeTaxIdType: Record<string, string> = {
  US: 'us_ein', GB: 'gb_vat', AU: 'au_abn', CA: 'ca_gst_hst',
  DE: 'eu_vat', FR: 'eu_vat', IT: 'eu_vat', ES: 'eu_vat',
  NL: 'eu_vat', BE: 'eu_vat', AT: 'eu_vat', SE: 'eu_vat',
  DK: 'eu_vat', FI: 'eu_vat', IE: 'eu_vat', PT: 'eu_vat',
  NO: 'no_vat', CH: 'ch_vat', JP: 'jp_cn', KR: 'kr_brn',
  IN: 'in_gst', SG: 'sg_uen', MY: 'my_sst', TH: 'th_vat',
  BR: 'br_cnpj', MX: 'mx_rfc', RU: 'ru_inn', CN: 'cn_tin',
  BG: 'bg_uic', CY: 'eu_vat', CZ: 'eu_vat', EE: 'eu_vat',
  GR: 'eu_vat', HR: 'eu_vat', HU: 'eu_vat', LT: 'eu_vat',
  LU: 'eu_vat', LV: 'eu_vat', MT: 'eu_vat', PL: 'eu_vat',
  RO: 'eu_vat', SI: 'eu_vat', SK: 'eu_vat',
};

// ============================================================================
// Component
// ============================================================================

const BillingProfileForm = forwardRef<BillingProfileFormHandle, BillingProfileFormProps>(
  ({ onSubmit, onValidationChange, onCancel, isLoading, error, initialData }, ref) => {
    const [formData, setFormData] = useState<BillingProfileData>({
      individualName: '',
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
          const response = await fetch('/api/billing/supported-tax-countries');
          if (response.ok) {
            const data: SupportedTaxCountriesResponse = await response.json();
            const list: TaxCountry[] = Object.entries(data.supportedCountries)
              .map(([code, description]) => {
                const info = extractTaxIdInfo(description);
                return {
                  code,
                  name: countryNames[code] || code,
                  taxIdName: info.name,
                  taxIdFormat: info.format,
                };
              })
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
    }, []);

    // ── Tax ID validation ────────────────────────────────────────────────
    useEffect(() => {
      if (formData.taxId && taxCountry) {
        setTaxIdValidation(null);
        const validate = async () => {
          setValidatingTaxId(true);
          try {
            const sanitized = formData.taxId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const res = await fetch('/api/billing/validate-tax-id', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taxId: sanitized, country: taxCountry }),
            });
            if (res.ok) {
              const raw: any = await res.json();
              setTaxIdValidation({
                valid: raw.valid ?? raw.isValid ?? false,
                errorMessage: raw.errorMessage || raw.error || undefined,
              });
            } else {
              try {
                const errData = await res.json();
                setTaxIdValidation({
                  valid: false,
                  errorMessage: errData?.detail?.[0]?.msg || errData?.detail || 'Invalid tax ID',
                });
              } catch {
                setTaxIdValidation({ valid: false, errorMessage: 'Invalid tax ID' });
              }
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
    }, [formData.taxId, taxCountry]);

    // ── Sync taxCountry → billingAddress.country + taxIdType ─────────────
    useEffect(() => {
      if (taxCountry) {
        setFormData((prev) => ({
          ...prev,
          taxIdType: countryToStripeTaxIdType[taxCountry] || 'eu_vat',
          billingAddress: {
            ...prev.billingAddress,
            country: taxCountry,
          },
        }));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taxCountry]);

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
      if (!formData.individualName.trim()) return false;
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
            value={formData.individualName}
            onChange={(e) => handleInputChange('individualName', e.target.value)}
            placeholder="Your name or business name"
            required
            className="h-10"
          />
          <p className="text-caption">
            This name will appear on invoices and receipts.
          </p>
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
          <p className="text-caption">
            Invoices and payment receipts will be sent to this email.
          </p>
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
