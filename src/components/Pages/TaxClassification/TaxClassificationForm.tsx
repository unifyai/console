"use client";

import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/UI/select';
import { Checkbox } from '@/components/UI/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/UI/radio-group';
import { Loader2, Check, X } from 'lucide-react';
import { 
  TaxClassificationFormData, 
  AccountType, 
  TaxIdValidationResponse, 
  SupportedTaxCountriesResponse,
  TaxCountry
} from '@/types/user';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(enLocale);

interface TaxClassificationFormProps {
  onSubmit: (data: TaxClassificationFormData) => void;
  onValidationChange: (isValid: boolean) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string;
  initialData?: Partial<TaxClassificationFormData>;
}

interface TaxClassificationFormHandle {
  submit: () => void;
}

const businessTypes = [
  { value: "corporation", label: "Corporation" },
  { value: "llc", label: "Limited Liability Company (LLC)" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "non_profit", label: "Non-Profit Organization" },
  { value: "other", label: "Other" }
];

// Country code to name mapping
const countryNames: Record<string, string> = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'AU': 'Australia',
  'CA': 'Canada',
  'DE': 'Germany',
  'FR': 'France',
  'IT': 'Italy',
  'ES': 'Spain',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'AT': 'Austria',
  'SE': 'Sweden',
  'DK': 'Denmark',
  'FI': 'Finland',
  'IE': 'Ireland',
  'PT': 'Portugal',
  'NO': 'Norway',
  'CH': 'Switzerland',
  'JP': 'Japan',
  'KR': 'South Korea',
  'IN': 'India',
  'SG': 'Singapore',
  'MY': 'Malaysia',
  'TH': 'Thailand',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'RU': 'Russia',
  'CN': 'China',
  'BG': 'Bulgaria',
  'CY': 'Cyprus',
  'CZ': 'Czech Republic',
  'EE': 'Estonia',
  'GR': 'Greece',
  'HR': 'Croatia',
  'HU': 'Hungary',
  'LT': 'Lithuania',
  'LU': 'Luxembourg',
  'LV': 'Latvia',
  'MT': 'Malta',
  'PL': 'Poland',
  'RO': 'Romania',
  'SI': 'Slovenia',
  'SK': 'Slovakia'
};

// Extract tax ID type from backend description
const extractTaxIdInfo = (description: string): { name: string; format: string } => {
  const match = description.match(/\(([^)]+)\)/);
  if (match) {
    const taxType = match[1];
    // Map common tax types to user-friendly names
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
      'cn.uscc': { name: 'USCC', format: 'XXXXXXXXXXXXXXXXX' }
    };
    
    return taxTypeMap[taxType] || { name: 'Tax ID', format: 'Enter tax ID' };
  }
  
  // Default for EU VAT or other formats
  if (description.includes('EU VAT')) {
    return { name: 'VAT Number', format: 'Enter VAT number' };
  }
  
  return { name: 'Tax ID', format: 'Enter tax ID' };
};

const TaxClassificationForm = forwardRef<TaxClassificationFormHandle, TaxClassificationFormProps>(
  ({ onSubmit, onValidationChange, onCancel, isLoading, error, initialData }, ref) => {
    const [formData, setFormData] = useState<TaxClassificationFormData>({
      accountType: "individual",
      businessName: "",
      taxId: "",
      businessType: "",
      businessAddress: {
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        country: "",
        postalCode: ""
      },
      taxExempt: false,
      taxCountry: ""
    });

    useImperativeHandle(ref, () => ({
      submit: () => {
        if (isFormValid()) {
          onSubmit(formData);
        }
      }
    }));

    const [supportedCountries, setSupportedCountries] = useState<TaxCountry[]>([]);
    const [taxIdValidation, setTaxIdValidation] = useState<TaxIdValidationResponse | null>(null);
    const [validatingTaxId, setValidatingTaxId] = useState(false);
    const [loadingCountries, setLoadingCountries] = useState(true);

    // Fetch supported countries on mount
    useEffect(() => {
      const fetchSupportedCountries = async () => {
        try {
          const response = await fetch('/api/user/supported-tax-countries');
          
          if (response.ok) {
            const data: SupportedTaxCountriesResponse = await response.json();
            
            // Convert backend format to frontend format
            const countries: TaxCountry[] = Object.entries(data.supportedCountries).map(([code, description]) => {
              const taxIdInfo = extractTaxIdInfo(description);
              return {
                code,
                name: countryNames[code] || code,
                taxIdName: taxIdInfo.name,
                taxIdFormat: taxIdInfo.format
              };
            }).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
            
            setSupportedCountries(countries);
          } else {
            // Set some default countries so the form can still work
            setSupportedCountries([
              { code: 'US', name: 'United States', taxIdName: 'EIN', taxIdFormat: 'XX-XXXXXXX' },
              { code: 'GB', name: 'United Kingdom', taxIdName: 'VAT Number', taxIdFormat: 'GB999999999' },
              { code: 'CA', name: 'Canada', taxIdName: 'GST/HST Number', taxIdFormat: 'XXXXXXXXX' }
            ]);
          }
        } catch (error) {
          console.error('Error fetching supported countries:', error);
          // Set some default countries so the form can still work
          setSupportedCountries([
            { code: 'US', name: 'United States', taxIdName: 'EIN', taxIdFormat: 'XX-XXXXXXX' },
            { code: 'GB', name: 'United Kingdom', taxIdName: 'VAT Number', taxIdFormat: 'GB999999999' },
            { code: 'CA', name: 'Canada', taxIdName: 'GST/HST Number', taxIdFormat: 'XXXXXXXXX' }
          ]);
        } finally {
          setLoadingCountries(false);
        }
      };

      fetchSupportedCountries();
    }, []);

    // Validate tax ID when it changes
    useEffect(() => {
      if (formData.accountType === "business" && formData.taxId && formData.taxCountry) {
        // Immediately clear previous validation so the form can be resubmitted while we re-validate
        setTaxIdValidation(null);

        const validateTaxId = async () => {
          setValidatingTaxId(true);
          try {
            const sanitizedId = formData.taxId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

            const response = await fetch('/api/user/validate-tax-id', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                taxId: sanitizedId,
                country: formData.taxCountry
              })
            });
            
            if (response.ok) {
              const validationRaw: any = await response.json();
              const mapped: TaxIdValidationResponse = {
                valid: validationRaw.valid ?? validationRaw.isValid ?? false,
                errorMessage: validationRaw.errorMessage || validationRaw.error || null,
              } as any;
              setTaxIdValidation(mapped);
            } else {
              // Attempt to read error details from response body
              try {
                const errorData = await response.json();
                const message = errorData?.detail?.[0]?.msg || errorData?.detail || 'Invalid tax ID';
                setTaxIdValidation({ valid: false, errorMessage: message });
              } catch (_) {
                setTaxIdValidation({ valid: false, errorMessage: 'Invalid tax ID' });
              }
            }
          } catch (error) {
            console.error('Error validating tax ID:', error);
            setTaxIdValidation({ valid: false, errorMessage: 'Unable to validate tax ID. Please check the format.' });
          } finally {
            setValidatingTaxId(false);
          }
        };

        const timeoutId = setTimeout(validateTaxId, 500);
        return () => clearTimeout(timeoutId);
      } else {
        setTaxIdValidation(null);
      }
    }, [formData.taxId, formData.taxCountry, formData.accountType]);

    const handleInputChange = (field: keyof TaxClassificationFormData, value: any) => {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    };

    const handleAddressChange = (field: keyof TaxClassificationFormData['businessAddress'], value: string) => {
      setFormData(prev => ({
        ...prev,
        businessAddress: {
          ...prev.businessAddress,
          [field]: value
        }
      }));
    };

    const isFormValid = useCallback(() => {
      if (formData.accountType === "individual") {
        return true;
      }
      
      // Business account validation
      return (
        formData.businessName &&
        formData.taxId &&
        formData.businessType &&
        formData.taxCountry &&
        formData.businessAddress.addressLine1 &&
        formData.businessAddress.city &&
        formData.businessAddress.country &&
        (!taxIdValidation || taxIdValidation.valid)
      );
    }, [formData, taxIdValidation]);

    // Update validation state when form data changes
    useEffect(() => {
      const valid = !!isFormValid();
      onValidationChange(valid);
    }, [formData, taxIdValidation, onValidationChange, isFormValid]);

    // Sync form state with initialData from props
    useEffect(() => {
      if (initialData) {
        setFormData(prev => ({ ...prev, ...initialData }));
      }
    }, [initialData]);

    // Auto-fill address country name when taxCountry (ISO) selected
    useEffect(() => {
      if (
        formData.accountType === 'business' &&
        formData.taxCountry &&
        formData.businessAddress.country !== formData.taxCountry
      ) {
        // Keep ISO code in both fields to ensure backend consistency
        handleAddressChange('country', formData.taxCountry);
      }
    }, [formData.taxCountry]);

    // Back-fill ISO code when user types country name first
    useEffect(() => {
      if (
        formData.accountType === 'business' &&
        !formData.taxCountry &&
        formData.businessAddress.country
      ) {
        const code = countries.getAlpha2Code(
          formData.businessAddress.country,
          'en'
        );
        if (code) {
          handleInputChange('taxCountry', code);
        }
      }
    }, [formData.businessAddress.country]);

    const selectedCountry = supportedCountries.find((c: TaxCountry) => c.code === formData.taxCountry);

    return (
      <div className="w-full space-y-8">
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3">Tax Classification</h3>
          <p className="text-base text-muted-foreground">
            {initialData?.accountType 
              ? "Review and update your tax classification information as needed."
              : "To comply with tax regulations, please provide your account classification information."
            }
          </p>
        </div>

        <div className="space-y-8">
          {/* Account Type Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Account Type</Label>
            <RadioGroup 
              value={formData.accountType} 
              onValueChange={(value: AccountType) => handleInputChange('accountType', value)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-3 p-6 border rounded-lg hover:bg-accent/10 transition-colors">
                <RadioGroupItem value="individual" id="individual" className="h-5 w-5" />
                <Label htmlFor="individual" className="text-base font-medium cursor-pointer">Individual</Label>
              </div>
              <div className="flex items-center space-x-3 p-6 border rounded-lg hover:bg-accent/10 transition-colors">
                <RadioGroupItem value="business" id="business" className="h-5 w-5" />
                <Label htmlFor="business" className="text-base font-medium cursor-pointer">Business</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Business Information Section */}
          {formData.accountType === "business" && (
            <div className="space-y-6 border-t pt-8">
              <h3 className="text-xl font-semibold">Business Information</h3>
              
              {/* Business Name */}
              <div className="space-y-3">
                <Label htmlFor="businessName" className="text-base font-medium">Business Name *</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  placeholder="Enter your business name"
                  required
                  className="h-12 text-base"
                />
              </div>

              {/* Business Type */}
              <div className="space-y-3">
                <Label htmlFor="businessType" className="text-base font-medium">Business Type *</Label>
                <Select value={formData.businessType} onValueChange={(value) => handleInputChange('businessType', value)}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tax Country */}
              <div className="space-y-3">
                <Label htmlFor="taxCountry" className="text-base font-medium">Tax Country *</Label>
                <Select 
                  value={formData.taxCountry} 
                  onValueChange={(value) => handleInputChange('taxCountry', value)}
                  disabled={loadingCountries}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder={loadingCountries ? "Loading countries..." : "Select tax country"} />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedCountries.map((country: TaxCountry) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tax ID */}
              <div className="space-y-3">
                <Label htmlFor="taxId" className="text-base font-medium">
                  {selectedCountry?.taxIdName || "Tax ID"} *
                </Label>
                <div className="relative">
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) => handleInputChange('taxId', e.target.value)}
                    placeholder={selectedCountry?.taxIdFormat || "Enter tax ID"}
                    required
                    className="h-12 text-base"
                  />
                  {validatingTaxId && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                  {taxIdValidation && !validatingTaxId && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {taxIdValidation.valid ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
                {taxIdValidation && !taxIdValidation.valid && (
                  <p className="text-sm text-destructive">{taxIdValidation.errorMessage}</p>
                )}
              </div>

              {/* Business Address */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Business Address</Label>
                
                <div className="space-y-3">
                  <Label htmlFor="addressLine1" className="text-base font-medium">Address Line 1 *</Label>
                  <Input
                    id="addressLine1"
                    value={formData.businessAddress.addressLine1}
                    onChange={(e) => handleAddressChange('addressLine1', e.target.value)}
                    placeholder="Street address"
                    required
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="addressLine2" className="text-base font-medium">Address Line 2</Label>
                  <Input
                    id="addressLine2"
                    value={formData.businessAddress.addressLine2}
                    onChange={(e) => handleAddressChange('addressLine2', e.target.value)}
                    placeholder="Apartment, suite, unit, etc. (optional)"
                    className="h-12 text-base"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="city" className="text-base font-medium">City *</Label>
                    <Input
                      id="city"
                      value={formData.businessAddress.city}
                      onChange={(e) => handleAddressChange('city', e.target.value)}
                      placeholder="City"
                      required
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="state" className="text-base font-medium">State/Province</Label>
                    <Input
                      id="state"
                      value={formData.businessAddress.state}
                      onChange={(e) => handleAddressChange('state', e.target.value)}
                      placeholder="State or Province"
                      className="h-12 text-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="country" className="text-base font-medium">Country *</Label>
                    <Input
                      id="country"
                      value={formData.businessAddress.country}
                      onChange={(e) => handleAddressChange('country', e.target.value)}
                      placeholder="Country"
                      required
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="postalCode" className="text-base font-medium">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={formData.businessAddress.postalCode}
                      onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                      placeholder="Postal code"
                      className="h-12 text-base"
                    />
                  </div>
                </div>
              </div>

                           {/* Tax Exempt Checkbox */}
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="taxExempt"
                    checked={formData.taxExempt}
                    onCheckedChange={(checked) => handleInputChange('taxExempt', !!checked)}
                    className="h-5 w-5"
                  />
                 <Label htmlFor="taxExempt" className="text-base font-medium cursor-pointer">
                   Tax Exempt Organization
                  </Label>
                </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

TaxClassificationForm.displayName = 'TaxClassificationForm';

export default TaxClassificationForm; 