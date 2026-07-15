export interface ContactRow {
  id: number;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  contact_designation: string;
  contact_country: string;
  contact_zipcode: string;
  contact_address_1: string;
  contact_address_2: string;
  digital_signature: File | null;
  contact_phone_code: string;
  contact_phone_cca2: string;
  is_active: boolean;
}

export interface AddressRow {
  id: number;
  company_address_line1: string;
  company_address_line2: string;
  company_country: string;
  company_zipcode: string;
  is_active: boolean;
}

export interface CompanyForm {
  company_name: string;
  report_id: string;
  company_type: string;
  agency_type: string;
  brand: string;
  website: string;
  phone_code: string;
  phone_cca2: string;
  phone: string;
  email: string;
  billing_currency: string;
  address_line1: string;
  address_line2: string;
  country: string;
  state: string;
  city: string;
  zipcode: string;
  cin_number: string;
  gst_number: string;
  place_of_supply: string;
  is_active: boolean;
  credit_period_days: string;
  payment_terms: string;
  payment_type: string;
  tax_type: string;
  tds_applicable: string;
  tds_section: string;
  advance_amount: string;
  credit_limit: string;
  outstanding_limit: string;
  billing_contact: string;
  default_market: string;
  default_platform: string;
  inventory_type: string;
  campaign_objective: string;
  language: string;
  audience_focus: string;
  ad_formats: string;
  timezone: string;
  account_manager: string;
  sales_owner: string;
  campaign_manager: string;
  finance_owner: string;
  client_type: string;
  priority: string;
  risk_level: string;
  payment_behavior: string;
  avg_response_time: string;
  notes: string;
  additional_internal_notes: string;
  additional_tags: string;
  default_invoice_address: string;
  default_invoice_bank: string;
  default_authorized_person: string;
  invoice_type: string; // "single" | "multiple"
  is_domestic: boolean;  
  default_email_send_to: string;
  default_email_send_cc: string;    
  show_campaign_name_in_email: boolean;        
}

// ─── Country type for phone picker ───────────────────────────────────────────
export interface Country {
  name: string;
  flagUrl: string;
  code: string;
  cca2: string;
  emoji: string;
  currency?: string;
}

export interface PhoneInputProps {
  phone: string;
  phone_code: string;
  phone_cca2: string;
  countries: Country[];
  onPhoneChange: (v: string) => void;
  onCountryChange: (code: string, cca2: string) => void;
}

export interface AddNewSelectProps {
  value: string | undefined;
  onChange: (v: string) => void;
  options: string[];
  setOptions: (opts: string[]) => void;
  placeholder?: string;
}