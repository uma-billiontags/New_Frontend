// ── Shared Types ──────────────────────────────────────────────────────────────

export type ClientStatus = "pending" | "approved" | "rejected";
export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export type PriorityLevel = "High" | "Medium" | "Low";
export type ClientType = "Platinum" | "Gold" | "Silver" | "Standard";
export type ViewId = "overview" | "clients" | "pending" | "approved" | "rejected";
export type ToastType = "success" | "error";

export interface ClientBilling {
  payment_type: string;
  payment_terms: string;
  credit_period_days: number;
  tax_type: string;
  tds_applicable: boolean;
  tds_section: string;
  billing_currency: string;
  advance_amount: string;
  credit_limit: string;
  outstanding_limit: string;
  billing_contact: string;
}

export interface ClientContact {
  name: string;
  email: string;
  phone: string;
  designation: string;
  country: string;
  zipcode: string;
}

export interface ClientOwnership {
  account_manager: string;
  sales_owner: string;
  campaign_manager: string;
  finance_owner: string;
}

export interface ClientClassification {
  client_type: ClientType;
  priority: PriorityLevel;
  risk_level: RiskLevel;
  payment_behavior: string;
  avg_response_time: number;
}

export interface Client {
  id: string;
  reporting_id: string;
  company_name: string;
  company_type: string;
  agency_type: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  state: string;
  city: string;
  cin_number: string;
  vast_number: string;
  place_of_supply: string;
  is_active: boolean;
  status: ClientStatus;
  submitted_at: string;
  approved_at?: string;
  billing: ClientBilling;
  contacts: ClientContact[];
  ownership: ClientOwnership;
  classification: ClientClassification;
}

export interface Counts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  campaignTotal: number; // ← add this

}

// ── Shared Color Palette ──────────────────────────────────────────────────────

export const C = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  border: "#CBD5E1",
  borderLight: "#E2E8F0",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  blueMid: "#BFDBFE",
  blueDeep: "#1D4ED8",
  green: "#16A34A",
  greenLight: "#DCFCE7",
  amber: "#D97706",
  amberLight: "#FEF3C7",
  red: "#DC2626",
  redLight: "#FEE2E2",
  purple: "#7C3AED",
  purpleLight: "#EDE9FE",
  slate: "#0F172A",
  slate700: "#334155",
  slate500: "#64748B",
  slate300: "#CBD5E1",
  slate100: "#F1F5F9",
  white: "#FFFFFF",
};

// ── Shared Status/Risk/Type Maps ──────────────────────────────────────────────

export interface StatusStyle {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}

export const STATUS_MAP: Record<ClientStatus, StatusStyle> = {
  pending: { label: "Pending", color: C.amber, bg: C.amberLight, border: "#FDE68A", dot: C.amber },
  approved: { label: "Approved", color: C.green, bg: C.greenLight, border: "#BBF7D0", dot: C.green },
  rejected: { label: "Rejected", color: C.red, bg: C.redLight, border: "#FECACA", dot: C.red },
};

export const RISK_COLOR: Record<RiskLevel, string> = {
  Low: C.green,
  Medium: C.amber,
  High: C.red,
  Critical: "#DB2777",
};

export const CLIENT_TYPE_COLOR: Record<ClientType, string> = {
  Platinum: C.slate700,
  Gold: C.amber,
  Silver: C.slate500,
  Standard: C.blue,
};

// ── Shared Helpers ────────────────────────────────────────────────────────────

export function fmt(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function fmtINR(val: string): string {
  if (!val) return "—";
  return "₹" + Number(val).toLocaleString("en-IN");
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

export const MOCK_CLIENTS: Client[] = [
  {
    id: "CLT-2026-00001", reporting_id: "RPT-001",
    company_name: "NovaTech Solutions Pvt. Ltd.", company_type: "Private Limited",
    agency_type: "Digital", email: "contact@novatech.in", phone: "+91 98765 43210",
    website: "https://novatech.in", country: "India", state: "Karnataka", city: "Bengaluru",
    cin_number: "U72200KA2019PTC123456", vast_number: "VAST-8821", place_of_supply: "Karnataka",
    is_active: true, status: "pending", submitted_at: "2026-05-14T10:30:00Z",
    billing: { payment_type: "Postpaid", payment_terms: "Net 30 days", credit_period_days: 30, tax_type: "GST", tds_applicable: true, tds_section: "194J", billing_currency: "INR", advance_amount: "50000", credit_limit: "500000", outstanding_limit: "600000", billing_contact: "admin@novatech.in" },
    contacts: [{ name: "Arjun Mehta", email: "arjun@novatech.in", phone: "+91 91234 56789", designation: "Finance Director", country: "India", zipcode: "560001" }],
    ownership: { account_manager: "Rahul Sharma", sales_owner: "Deepak Joshi", campaign_manager: "Neha Gupta", finance_owner: "Sunil Kapoor" },
    classification: { client_type: "Platinum", priority: "High", risk_level: "Low", payment_behavior: "Always On Time", avg_response_time: 2 },
  },
  {
    id: "CLT-2026-00002", reporting_id: "RPT-002",
    company_name: "BrandBridge Media Pvt. Ltd.", company_type: "Private Limited",
    agency_type: "Integrated", email: "hello@brandbridge.com", phone: "+91 87654 32109",
    website: "https://brandbridge.com", country: "India", state: "Maharashtra", city: "Mumbai",
    cin_number: "U74999MH2020PTC234567", vast_number: "VAST-4421", place_of_supply: "Maharashtra",
    is_active: true, status: "approved", submitted_at: "2026-05-10T08:15:00Z", approved_at: "2026-05-11T14:00:00Z",
    billing: { payment_type: "Prepaid", payment_terms: "Net 0 day", credit_period_days: 0, tax_type: "IGST", tds_applicable: false, tds_section: "", billing_currency: "INR", advance_amount: "100000", credit_limit: "0", outstanding_limit: "0", billing_contact: "billing@brandbridge.com" },
    contacts: [{ name: "Priya Nair", email: "priya@brandbridge.com", phone: "+91 90000 11111", designation: "CEO", country: "India", zipcode: "400001" }],
    ownership: { account_manager: "Priya Mehta", sales_owner: "Anita Sinha", campaign_manager: "Rohit Verma", finance_owner: "Meera Bose" },
    classification: { client_type: "Gold", priority: "Medium", risk_level: "Low", payment_behavior: "Always On Time", avg_response_time: 1 },
  },
  {
    id: "CLT-2026-00003", reporting_id: "RPT-003",
    company_name: "RetailEdge Commerce Ltd.", company_type: "Public Limited",
    agency_type: "Media Buying", email: "ops@retailedge.co", phone: "+91 76543 21098",
    website: "https://retailedge.co", country: "India", state: "Delhi", city: "New Delhi",
    cin_number: "L52100DL2018PLC345678", vast_number: "VAST-7732", place_of_supply: "Delhi",
    is_active: false, status: "rejected", submitted_at: "2026-05-08T12:00:00Z",
    billing: { payment_type: "Postpaid", payment_terms: "Net 45 days", credit_period_days: 45, tax_type: "SGST+CGST", tds_applicable: true, tds_section: "194C", billing_currency: "INR", advance_amount: "0", credit_limit: "1000000", outstanding_limit: "1200000", billing_contact: "finance@retailedge.co" },
    contacts: [{ name: "Vikram Singh", email: "vikram@retailedge.co", phone: "+91 70000 22222", designation: "CFO", country: "India", zipcode: "110001" }],
    ownership: { account_manager: "Arun Kumar", sales_owner: "Manoj Pillai", campaign_manager: "Arjun Das", finance_owner: "Kiran Patel" },
    classification: { client_type: "Silver", priority: "Low", risk_level: "High", payment_behavior: "Frequent Delay", avg_response_time: 7 },
  },
  {
    id: "CLT-2026-00004", reporting_id: "RPT-004",
    company_name: "HealthFirst Pharma Corp.", company_type: "Private Limited",
    agency_type: "Creative", email: "media@healthfirst.in", phone: "+91 65432 10987",
    website: "https://healthfirst.in", country: "India", state: "Tamil Nadu", city: "Chennai",
    cin_number: "U24230TN2021PTC456789", vast_number: "VAST-1193", place_of_supply: "Tamil Nadu",
    is_active: true, status: "pending", submitted_at: "2026-05-16T09:45:00Z",
    billing: { payment_type: "Postpaid", payment_terms: "Net 60 days", credit_period_days: 60, tax_type: "GST", tds_applicable: true, tds_section: "194J", billing_currency: "INR", advance_amount: "75000", credit_limit: "750000", outstanding_limit: "800000", billing_contact: "accounts@healthfirst.in" },
    contacts: [{ name: "Divya Krishnan", email: "divya@healthfirst.in", phone: "+91 80000 33333", designation: "Head of Marketing", country: "India", zipcode: "600001" }],
    ownership: { account_manager: "Sneha Reddy", sales_owner: "Kavita Rao", campaign_manager: "Pooja Nair", finance_owner: "Lakshmi Chand" },
    classification: { client_type: "Gold", priority: "High", risk_level: "Medium", payment_behavior: "Occasional Delay", avg_response_time: 3 },
  },
  {
    id: "CLT-2026-00005", reporting_id: "RPT-005",
    company_name: "SwiftAds Digital Agency", company_type: "Private Limited",
    agency_type: "Integrated", email: "hello@swiftads.com", phone: "+91 87654 32109",
    website: "https://swiftads.com", country: "India", state: "Maharashtra", city: "Pune",
    cin_number: "U74999MH2021PTC999999", vast_number: "VAST-5512", place_of_supply: "Maharashtra",
    is_active: true, status: "pending", submitted_at: "2026-05-17T08:15:00Z",
    billing: { payment_type: "Prepaid", payment_terms: "Net 0 day", credit_period_days: 0, tax_type: "IGST", tds_applicable: false, tds_section: "", billing_currency: "INR", advance_amount: "100000", credit_limit: "0", outstanding_limit: "0", billing_contact: "billing@swiftads.com" },
    contacts: [{ name: "Ravi Menon", email: "ravi@swiftads.com", phone: "+91 90000 44444", designation: "COO", country: "India", zipcode: "411001" }],
    ownership: { account_manager: "Priya Mehta", sales_owner: "Anita Sinha", campaign_manager: "Rohit Verma", finance_owner: "Meera Bose" },
    classification: { client_type: "Gold", priority: "Medium", risk_level: "Low", payment_behavior: "Always On Time", avg_response_time: 1 },
  },
];