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
      account_type: "individual",
      business_name: "",
      tax_id: "",
      business_type: "",
      business_address: {
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        country: "",
        postal_code: ""
      },
      tax_exempt: false,
      tax_country: ""
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
            const countries: TaxCountry[] = Object.entries(data.supported_countries).map(([code, description]) => {
              const taxIdInfo = extractTaxIdInfo(description);
              return {
                code,
                name: countryNames[code] || code,
                tax_id_name: taxIdInfo.name,
                tax_id_format: taxIdInfo.format
              };
            }).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
            
            setSupportedCountries(countries);
          } else {
            // Set some default countries so the form can still work
            setSupportedCountries([
              { code: 'US', name: 'United States', tax_id_name: 'EIN', tax_id_format: 'XX-XXXXXXX' },
              { code: 'GB', name: 'United Kingdom', tax_id_name: 'VAT Number', tax_id_format: 'GB999999999' },
              { code: 'CA', name: 'Canada', tax_id_name: 'GST/HST Number', tax_id_format: 'XXXXXXXXX' }
            ]);
          }
        } catch (error) {
          console.error('Error fetching supported countries:', error);
          // Set some default countries so the form can still work
          setSupportedCountries([
            { code: 'US', name: 'United States', tax_id_name: 'EIN', tax_id_format: 'XX-XXXXXXX' },
            { code: 'GB', name: 'United Kingdom', tax_id_name: 'VAT Number', tax_id_format: 'GB999999999' },
            { code: 'CA', name: 'Canada', tax_id_name: 'GST/HST Number', tax_id_format: 'XXXXXXXXX' }
          ]);
        } finally {
          setLoadingCountries(false);
        }
      };

      fetchSupportedCountries();
    }, []);

    // Validate tax ID when it changes
    useEffect(() => {
      if (formData.account_type === "business" && formData.tax_id && formData.tax_country) {
        const validateTaxId = async () => {
          setValidatingTaxId(true);
          try {
            const response = await fetch('/api/user/validate-tax-id', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tax_id: formData.tax_id,
                country: formData.tax_country
              })
            });
            
            if (response.ok) {
              const validation: TaxIdValidationResponse = await response.json();
              setTaxIdValidation(validation);
            }
          } catch (error) {
            console.error('Error validating tax ID:', error);
          } finally {
            setValidatingTaxId(false);
          }
        };

        const timeoutId = setTimeout(validateTaxId, 500);
        return () => clearTimeout(timeoutId);
      } else {
        setTaxIdValidation(null);
      }
    }, [formData.tax_id, formData.tax_country, formData.account_type]);

    const handleInputChange = (field: keyof TaxClassificationFormData, value: any) => {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    };

    const handleAddressChange = (field: keyof TaxClassificationFormData['business_address'], value: string) => {
      setFormData(prev => ({
        ...prev,
        business_address: {
          ...prev.business_address,
          [field]: value
        }
      }));
    };

    const isFormValid = useCallback(() => {
      if (formData.account_type === "individual") {
        return true;
      }
      
      // Business account validation
      return (
        formData.business_name &&
        formData.tax_id &&
        formData.business_type &&
        formData.tax_country &&
        formData.business_address.address_line1 &&
        formData.business_address.city &&
        formData.business_address.country &&
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

    const selectedCountry = supportedCountries.find((c: TaxCountry) => c.code === formData.tax_country);

    return (
      <div className="w-full space-y-8">
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3">Tax Classification</h3>
          <p className="text-base text-muted-foreground">
            {initialData?.account_type 
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
              value={formData.account_type} 
              onValueChange={(value: AccountType) => handleInputChange('account_type', value)}
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
          {formData.account_type === "business" && (
            <div className="space-y-6 border-t pt-8">
              <h3 className="text-xl font-semibold">Business Information</h3>
              
              {/* Business Name */}
              <div className="space-y-3">
                <Label htmlFor="business_name" className="text-base font-medium">Business Name *</Label>
                <Input
                  id="business_name"
                  value={formData.business_name}
                  onChange={(e) => handleInputChange('business_name', e.target.value)}
                  placeholder="Enter your business name"
                  required
                  className="h-12 text-base"
                />
              </div>

              {/* Business Type */}
              <div className="space-y-3">
                <Label htmlFor="business_type" className="text-base font-medium">Business Type *</Label>
                <Select value={formData.business_type} onValueChange={(value) => handleInputChange('business_type', value)}>
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
                <Label htmlFor="tax_country" className="text-base font-medium">Tax Country *</Label>
                <Select 
                  value={formData.tax_country} 
                  onValueChange={(value) => handleInputChange('tax_country', value)}
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
                <Label htmlFor="tax_id" className="text-base font-medium">
                  {selectedCountry?.tax_id_name || "Tax ID"} *
                </Label>
                <div className="relative">
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) => handleInputChange('tax_id', e.target.value)}
                    placeholder={selectedCountry?.tax_id_format || "Enter tax ID"}
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
                  <p className="text-sm text-destructive">{taxIdValidation.error_message}</p>
                )}
              </div>

              {/* Business Address */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Business Address</Label>
                
                <div className="space-y-3">
                  <Label htmlFor="address_line1" className="text-base font-medium">Address Line 1 *</Label>
                  <Input
                    id="address_line1"
                    value={formData.business_address.address_line1}
                    onChange={(e) => handleAddressChange('address_line1', e.target.value)}
                    placeholder="Street address"
                    required
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="address_line2" className="text-base font-medium">Address Line 2</Label>
                  <Input
                    id="address_line2"
                    value={formData.business_address.address_line2}
                    onChange={(e) => handleAddressChange('address_line2', e.target.value)}
                    placeholder="Apartment, suite, unit, etc. (optional)"
                    className="h-12 text-base"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="city" className="text-base font-medium">City *</Label>
                    <Input
                      id="city"
                      value={formData.business_address.city}
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
                      value={formData.business_address.state}
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
                      value={formData.business_address.country}
                      onChange={(e) => handleAddressChange('country', e.target.value)}
                      placeholder="Country"
                      required
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="postal_code" className="text-base font-medium">Postal Code</Label>
                    <Input
                      id="postal_code"
                      value={formData.business_address.postal_code}
                      onChange={(e) => handleAddressChange('postal_code', e.target.value)}
                      placeholder="Postal code"
                      className="h-12 text-base"
                    />
                  </div>
                </div>
              </div>

                           {/* Tax Exempt Checkbox */}
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="tax_exempt"
                    checked={formData.tax_exempt}
                    onCheckedChange={(checked) => handleInputChange('tax_exempt', !!checked)}
                    className="h-5 w-5"
                  />
                 <Label htmlFor="tax_exempt" className="text-base font-medium cursor-pointer">
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