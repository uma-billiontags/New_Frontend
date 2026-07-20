import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  Form, Input, Select, Switch, Button, Upload, Tabs, Typography, Divider,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, UploadOutlined,
  SaveOutlined, ArrowLeftOutlined,
} from "@ant-design/icons";
import type {
  ContactRow, AddressRow, CompanyForm, Country,
  PhoneInputProps, AddNewSelectProps,
} from "../types/onboard.form.types";
import { getExampleNumber, isSupportedCountry } from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, CreditCard, ContactRound, CheckCircle2, MapPinned } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const { Text } = Typography;

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ─── Dropdown choices (still hardcoded — not categories-backed) ──────────────
const DEFAULT_CHOICES = {
  agency_types: ["Digital", "Traditional", "Integrated", "Media Buying", "Creative"],
  place_of_supply: ["Karnataka", "Maharashtra", "Delhi", "Tamil Nadu", "Telangana", "Gujarat"],
  payment_types: ["Prepaid", "Postpaid"],
  tax_types: ["GST", "IGST", "SGST+CGST", "Exempt"],
  tds_options: ["Yes", "No"],
  invoice_types: ["Single Invoice", "Multiple Invoice"],
};

const validateEmailList = (_: any, value: string) => {
  if (!value) return Promise.resolve();
  const raw = value.trim();

  if (raw.startsWith(",")) return Promise.reject(new Error("Email list cannot start with a comma."));
  if (raw.endsWith(",")) return Promise.reject(new Error("Email list cannot end with a comma."));
  if (/,\s*,/.test(raw)) return Promise.reject(new Error("Only one comma is allowed between two emails."));

  const emails = raw.split(",").map((e) => e.trim());
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const email of emails) {
    if (!email) return Promise.reject(new Error("Found an empty email between commas."));
    if (email.endsWith(".")) return Promise.reject(new Error(`'${email}' should not end with a full stop.`));
    if (!emailRegex.test(email)) return Promise.reject(new Error(`'${email}' is not a valid email address.`));
  }
  return Promise.resolve();
};

// Converts an array of strings into Ant Design Select options.
const toOpts = (arr: string[]) => arr.map((s) => ({ value: s, label: s }));

function makeContact(): ContactRow {
  return {
    id: Date.now(),
    contact_name: "", contact_phone: "", contact_email: "",
    contact_designation: "", contact_country: "", contact_zipcode: "",
    contact_address_1: "", contact_address_2: "", digital_signature: null,
    contact_phone_code: "+91", contact_phone_cca2: "IN",
    is_active: true, // ← added
  };
}

function makeAddress(): AddressRow {
  return {
    id: Date.now(),
    company_address_line1: "", company_address_line2: "",
    company_country: "", company_zipcode: "",
    is_active: true, // ← added
  };
}

const TABS = [
  { id: "basic", label: "Basic Information", icon: FileText },
  { id: "billing", label: "Billing & Commercials", icon: CreditCard },
  { id: "contacts", label: "Contacts & Addresses", icon: ContactRound },
  { id: "review", label: "Review & Summary", icon: CheckCircle2 },
];

const inputStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  height: 38,
  fontSize: 13,
};

// ─── PhoneInput ──────────────────────────────────────────────────────────────
const PhoneInput = React.memo(function PhoneInput({
  phone, phone_code, phone_cca2, countries, onPhoneChange, onCountryChange,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const maxPhoneLength = useMemo(() => {
    try {
      if (!isSupportedCountry(phone_cca2 as any)) return 15;
      const example = getExampleNumber(phone_cca2 as any, examples);
      return example ? example.nationalNumber.length : 15;
    } catch { return 15; }
  }, [phone_cca2]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const selectedCountry = useMemo(() => countries.find((c) => c.cca2 === phone_cca2), [countries, phone_cca2]);
  const filtered = useMemo(() => countries.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search) || c.cca2.toLowerCase().includes(search.toLowerCase())
  ), [countries, search]);

  return (
    <div style={{ display: "flex" }}>
      <div ref={dropdownRef} style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setSearch(""); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            height: 38, padding: "0 10px",
            border: "1px solid var(--border-strong)", borderRight: "none",
            borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)",
            background: "var(--bg-input)", cursor: "pointer", fontSize: 13,
            color: "var(--text-primary)", fontFamily: "'Poppins', sans-serif",
          }}
        >
          {selectedCountry ? (
            <img src={selectedCountry.flagUrl} alt={selectedCountry.name}
              style={{ width: 22, height: 15, objectFit: "cover", borderRadius: 2, flexShrink: 0 }} />
          ) : <span style={{ fontSize: 16 }}>🌐</span>}
          <span style={{ fontWeight: 500 }}>{phone_code}</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 2 }}>▼</span>
        </button>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 9999,
            width: 300, background: "var(--bg-card)",
            border: "1px solid var(--border-strong)", borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow)", overflow: "hidden",
          }}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
              <input ref={searchRef} type="text" placeholder="Search country or code…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "6px 10px",
                  border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)",
                  fontSize: 13, outline: "none", boxSizing: "border-box",
                  background: "var(--bg-input)", color: "var(--text-primary)",
                  fontFamily: "'Poppins', sans-serif",
                }} />
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 13 }}>No results found</div>
              ) : filtered.map((c) => (
                <div key={c.cca2}
                  onClick={() => { onCountryChange(c.code, c.cca2); onPhoneChange(""); setOpen(false); setSearch(""); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 14px", cursor: "pointer", fontSize: 13,
                    background: c.cca2 === phone_cca2 ? "var(--accent-light)" : "transparent",
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = c.cca2 === phone_cca2 ? "var(--accent-light)" : "transparent")}
                >
                  <img src={c.flagUrl} alt={c.name}
                    style={{ width: 22, height: 15, objectFit: "cover", borderRadius: 2, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{c.code}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <input
        type="tel"
        placeholder={`Enter ${maxPhoneLength}-digit number`}
        value={phone}
        maxLength={maxPhoneLength}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, maxPhoneLength);
          onPhoneChange(digits);
        }}
        style={{
          flex: 1, height: 38, padding: "0 10px",
          border: "1px solid var(--border-strong)",
          borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
          fontSize: 13, outline: "none",
          background: "var(--bg-input)", color: "var(--text-primary)",
          fontFamily: "'Poppins', sans-serif",
        }}
      />
    </div>
  );
});

// ─── AddNewSelect ─────────────────────────────────────────────────────────────
const AddNewSelect = React.memo(function AddNewSelect({
  value, onChange, options, setOptions, placeholder, loading = false, showSearch = false,
}: AddNewSelectProps & { loading?: boolean; showSearch?: boolean }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const selectOptions = useMemo(() => toOpts(options), [options]);

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (trimmed && !options.includes(trimmed)) setOptions([...options, trimmed]);
    if (trimmed) onChange(trimmed);
    setNewValue(""); setIsAdding(false);
  };

  if (isAdding) {
    return (
      <Input autoFocus placeholder="Type and press Enter to save" value={newValue}
        suffix={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>↵ Enter</span>}
        onChange={(e) => setNewValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
          if (e.key === "Escape") { setNewValue(""); setIsAdding(false); }
        }}
        onBlur={() => { setNewValue(""); setIsAdding(false); }}
        style={inputStyle}
      />
    );
  }

  return (
    <Select
      virtual
      placeholder={loading ? "Loading…" : placeholder}
      loading={loading}
      allowClear
      showSearch={showSearch}
      filterOption={showSearch
        ? (input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
        : undefined}
      style={{ width: "100%" }}
      value={value || undefined}
      onChange={(v) => onChange(v ?? "")}
      dropdownRender={(menu) => (
        <>
          {menu}
          <Divider style={{ margin: "4px 0", borderColor: "var(--border)" }} />
          <div
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsAdding(true)}
            style={{
              padding: "8px 12px", cursor: "pointer", color: "var(--accent)",
              fontSize: 13, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <PlusOutlined /> Add new
          </div>
        </>
      )}
      options={selectOptions}
    />
  );
});

// ─── FormCard ─────────────────────────────────────────────────────────────────
const FormCard = React.memo(function FormCard({
  icon, title, subtitle, action, badge, children,
}: {
  icon: LucideIcon; title: string; subtitle?: string;
  action?: React.ReactNode; badge?: string; children: React.ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="db-card" style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}><Icon size={20} /></span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="db-card-title" style={{ textTransform: "none", fontSize: 13 }}>{title}</span>
              {badge && (
                <span style={{
                  fontSize: 9, padding: "2px 7px", borderRadius: 8,
                  background: "var(--bg-input)", color: "var(--text-muted)",
                  fontWeight: 600, letterSpacing: "0.06em",
                }}>{badge}</span>
              )}
            </div>
            {subtitle && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
});

// ─── BillingForm ──────────────────────────────────────────────────────────────
interface BillingFormProps {
  company: CompanyForm;
  sf: (k: keyof CompanyForm, v: string | boolean) => void;
  form: ReturnType<typeof Form.useForm>[0];
  taxTypes: string[];
  setTaxTypes: React.Dispatch<React.SetStateAction<string[]>>;
  availableCurrencies: string[];
  authorizedPersons: { id: number; name: string }[];
  loadingAuthorizedPersons: boolean;
  paymentTerms: { id: number; title: string; days: number }[];
  loadingPaymentTerms: boolean;
  companyAddresses: { id: number; label: string }[];
  loadingCompanyAddresses: boolean;
  bankDetails: { id: number; label: string }[];
  loadingBankDetails: boolean;
}

const BillingForm = React.memo(function BillingForm({
  company, sf, form, taxTypes, setTaxTypes,
  availableCurrencies, authorizedPersons, loadingAuthorizedPersons,
  paymentTerms, loadingPaymentTerms,
  companyAddresses, loadingCompanyAddresses,
  bankDetails, loadingBankDetails,
}: BillingFormProps) {
  const isPostpaid = company.payment_type === "Postpaid";

  const handlePaymentTypeChange = useCallback((v: string) => {
    sf("payment_type", v ?? "");

    if (v === "Prepaid") {
      // auto-select the "prepay" term (0 days) instead of leaving it blank
      const prepayTerm = paymentTerms.find(
        (t) => t.title.toLowerCase() === "prepay"
      );
      if (prepayTerm) {
        sf("payment_terms", String(prepayTerm.id));
        sf("credit_period_days", String(prepayTerm.days));
        form.setFieldsValue({
          payment_terms: String(prepayTerm.id),
          credit_period_days: String(prepayTerm.days),
        });
      } else {
        // fallback if no "prepay" record exists yet in PaymentTerms table
        sf("payment_terms", "");
        sf("credit_period_days", "0");
        form.setFieldsValue({ payment_terms: undefined, credit_period_days: "0" });
      }
    } else if (v === "Postpaid") {
      // let the user pick manually — handlePaymentTermsChange fills in the days
      sf("payment_terms", "");
      sf("credit_period_days", "");
      form.setFieldsValue({ payment_terms: undefined, credit_period_days: "" });
    }
  }, [sf, form, paymentTerms]);

  // payment_terms now holds a PaymentTerms ID (string). Days auto-fill from that record.
  const handlePaymentTermsChange = useCallback((v: string) => {
    sf("payment_terms", v ?? "");
    const term = paymentTerms.find((t) => String(t.id) === v);
    if (term) {
      sf("credit_period_days", String(term.days));
      form.setFieldsValue({ credit_period_days: String(term.days) });
    }
  }, [sf, form, paymentTerms]);

  return (
    <Form form={form} layout="vertical">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0 16px" }}>

        <Form.Item label="Payment Type" name="payment_type"
          rules={[{ required: true, message: "Payment type is required" }]}>
          <Select placeholder="Select" allowClear style={{ width: "100%" }}
            value={company.payment_type || undefined}
            onChange={handlePaymentTypeChange}
            options={toOpts(DEFAULT_CHOICES.payment_types)}/>
        </Form.Item>

        {/* ── Payment Terms — now pulled from the PaymentTerms table (categories app) ── */}
        <Form.Item label="Payment Terms" name="payment_terms"
          rules={[{ required: true, message: "Payment terms is required" }]}>
          <Select
            placeholder={loadingPaymentTerms ? "Loading…" : "Select payment term"}
            loading={loadingPaymentTerms}
            allowClear={isPostpaid}          // only clearable when Postpaid
            style={{ width: "100%" }}
            value={company.payment_terms || undefined}
            onChange={handlePaymentTermsChange}
            disabled={!isPostpaid}            // still locked for Prepaid, but now shows "prepay" as the selected value
            options={paymentTerms.map((t) => ({ value: String(t.id), label: `${t.title} (${t.days} days)` }))}/>
        </Form.Item>

        <Form.Item label="Credit Period (Days)" name="credit_period_days"
          rules={[{ required: true, message: "Credit period is required" }]}>
          <Input type="number" placeholder="Auto-filled" value={company.credit_period_days}
            disabled style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }} />
        </Form.Item>

        <Form.Item label="Tax Type" name="tax_type"
          rules={[{ required: true, message: "Tax type is required" }]}>
          <AddNewSelect value={company.tax_type} onChange={(v: any) => sf("tax_type", v)}
            options={taxTypes} setOptions={setTaxTypes} placeholder="Select tax type" />
        </Form.Item>

        <Form.Item label="TDS Applicable" name="tds_applicable">
          <Select placeholder="Select" allowClear style={{ width: "100%" }}
            value={company.tds_applicable || undefined}
            onChange={(v) => sf("tds_applicable", v ?? "")}
            options={toOpts(DEFAULT_CHOICES.tds_options)} />
        </Form.Item>

        <Form.Item label="TDS Section" name="tds_section">
          <Input placeholder="e.g. 194J" value={company.tds_section}
            onChange={(e) => sf("tds_section", e.target.value)} style={inputStyle} />
        </Form.Item>

        <Form.Item label="Billing Currency">
          <Select style={{ width: "100%" }} value={company.billing_currency}
            onChange={(v) => sf("billing_currency", v)}
            options={availableCurrencies.map((c: any) => ({
              value: c,
              label: c === "INR" ? "INR (₹)" : c === "USD" ? "USD ($)" :
                c === "EUR" ? "EUR (€)" : c === "GBP" ? "GBP (£)" : c,
            }))} />
          {company.country && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--green)" }}>
              ✓ Auto-detected for {company.country}
            </p>
          )}
        </Form.Item>

        <Form.Item label="Advance / Security Deposit" name="advance_amount">
          <Input type="number" placeholder="Enter amount" value={company.advance_amount}
            onChange={(e) => sf("advance_amount", e.target.value)} style={inputStyle} />
        </Form.Item>

        <Form.Item label="Credit Limit" name="credit_limit">
          <Input type="number" placeholder="Enter credit limit" value={company.credit_limit}
            onChange={(e) => sf("credit_limit", e.target.value)} style={inputStyle} />
        </Form.Item>

        <Form.Item label="Outstanding Limit Allowed" name="outstanding_limit">
          <Input type="number" placeholder="Enter outstanding limit" value={company.outstanding_limit}
            onChange={(e) => sf("outstanding_limit", e.target.value)} style={inputStyle} />
        </Form.Item>

        {/* ── From Company Address — now the real InvoiceCompanyAddress dropdown, fixed name ── */}
        <Form.Item label="From Company Address" name="default_invoice_address"
          rules={[{ required: true, message: "Invoice address is required" }]}>
          <Select
            placeholder={loadingCompanyAddresses ? "Loading…" : "Select company address"}
            loading={loadingCompanyAddresses} allowClear style={{ width: "100%" }}
            value={company.default_invoice_address || undefined}
            onChange={(v) => sf("default_invoice_address", v ?? "")}
            options={companyAddresses.map((a) => ({ value: String(a.id), label: a.label }))}
          />
        </Form.Item>

        {/* ── From Bank Account — now the real InvoiceBankDetails dropdown, fixed name ── */}
        <Form.Item label="From Bank Account" name="default_invoice_bank"
          rules={[{ required: true, message: "Bank account is required" }]}>
          <Select
            placeholder={loadingBankDetails ? "Loading…" : "Select bank account"}
            loading={loadingBankDetails} allowClear style={{ width: "100%" }}
            value={company.default_invoice_bank || undefined}
            onChange={(v) => sf("default_invoice_bank", v ?? "")}
            options={bankDetails.map((b) => ({ value: String(b.id), label: b.label }))}
          />
        </Form.Item>

        {/* ── Default Authorized Person — kept once only, was duplicated 3x before ── */}
        <Form.Item label="Default Authorized Person" name="default_authorized_person"
          rules={[{ required: true, message: "Authorized person is required" }]}>
          <Select
            placeholder={loadingAuthorizedPersons ? "Loading…" : "Select authorized person"}
            loading={loadingAuthorizedPersons} allowClear style={{ width: "100%" }}
            value={company.default_authorized_person || undefined}
            onChange={(v) => sf("default_authorized_person", v ?? "")}
            options={authorizedPersons.map((p) => ({ value: String(p.id), label: p.name }))}
          />
        </Form.Item>

        <Form.Item label="Invoice Type" name="invoice_type"
          rules={[{ required: true, message: "Invoice type is required" }]}>
          <Select placeholder="Select" allowClear style={{ width: "100%" }}
            value={company.invoice_type === "single" ? "Single Invoice" : company.invoice_type === "multiple" ? "Multiple Invoice" : undefined}
            onChange={(v) => sf("invoice_type", v === "Single Invoice" ? "single" : "multiple")}
            options={toOpts(DEFAULT_CHOICES.invoice_types)} />
        </Form.Item>

      </div>
    </Form>
  );
});

// ─── ContactsSection ──────────────────────────────────────────────────────────
interface ContactsSectionProps {
  contacts: ContactRow[];
  addContact: () => void;
  removeContact: (id: number) => void;
  updateContact: (id: number, k: keyof ContactRow, v: string | File | boolean | null) => void;
  countries: Country[];
  loadingCountries: boolean;
  countryOpts: string[];
  setCountryOpts: React.Dispatch<React.SetStateAction<string[]>>;
}

const ContactsSection = React.memo(function ContactsSection({
  contacts, addContact, removeContact, updateContact,
  countries, loadingCountries, countryOpts, setCountryOpts,
}: ContactsSectionProps) {
  return (
    <FormCard icon={ContactRound} title="Company Contacts"
      subtitle="Add one or more contacts"
      action={
        <button className="db-card-action" onClick={addContact}
          style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PlusOutlined /> Add Contact
        </button>
      }>
      {contacts.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "28px 16px",
          color: "var(--text-muted)", fontSize: 13,
          border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-sm)",
        }}>
          No contacts added yet.
        </div>
      ) : contacts.map((c, idx) => (
        <div key={c.id} style={{
          borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)",
          padding: 16, marginBottom: idx < contacts.length - 1 ? 12 : 0,
          background: "var(--bg-card-hover)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Contact {idx + 1}
              {idx > 0 && <span style={{ marginLeft: 8, color: "var(--amber)", fontWeight: 500, textTransform: "none" }}>(client-side only)</span>}
            </span>
            <button onClick={() => removeContact(c.id)} style={{
              background: "var(--red-bg)", border: "1px solid var(--red)", borderRadius: "var(--radius-sm)",
              color: "var(--red)", cursor: "pointer", padding: "3px 8px", fontSize: 12,
            }}>
              <DeleteOutlined />
            </button>
          </div>
          <Form layout="vertical">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0 16px" }}>
              <Form.Item label="Name" required>
                <Input placeholder="Full name" value={c.contact_name} style={inputStyle}
                  onChange={(e) => updateContact(c.id, "contact_name", e.target.value)} />
              </Form.Item>
              <Form.Item label="Phone Number" required>
                <PhoneInput phone={c.contact_phone} phone_code={c.contact_phone_code ?? "+91"}
                  phone_cca2={c.contact_phone_cca2 ?? "IN"} countries={countries}
                  onPhoneChange={(v) => updateContact(c.id, "contact_phone", v)}
                  onCountryChange={(code, cca2) => {
                    updateContact(c.id, "contact_phone_code" as keyof ContactRow, code);
                    updateContact(c.id, "contact_phone_cca2" as keyof ContactRow, cca2);
                  }} />
              </Form.Item>
              <Form.Item label="Email" required>
                <Input placeholder="email@company.com" value={c.contact_email} style={inputStyle}
                  onChange={(e) => updateContact(c.id, "contact_email", e.target.value)} />
              </Form.Item>
              <Form.Item label="Designation" required>
                <Input placeholder="Finance Director" value={c.contact_designation} style={inputStyle}
                  onChange={(e) => updateContact(c.id, "contact_designation", e.target.value)} />
              </Form.Item>
              <Form.Item label="Address Line 1" required>
                <Input placeholder="350 Mission St" value={c.contact_address_1} style={inputStyle}
                  onChange={(e) => updateContact(c.id, "contact_address_1", e.target.value)} />
              </Form.Item>
              <Form.Item label="Address Line 2">
                <Input placeholder="Suite 100" value={c.contact_address_2} style={inputStyle}
                  onChange={(e) => updateContact(c.id, "contact_address_2", e.target.value)} />
              </Form.Item>
              <Form.Item label="Country" required>
                <AddNewSelect placeholder="Select country…" loading={loadingCountries} showSearch
                  value={c.contact_country} onChange={(v) => updateContact(c.id, "contact_country", v ?? "")}
                  options={countryOpts} setOptions={setCountryOpts} />
              </Form.Item>
              <Form.Item label="Zip Code" required>
                <Input placeholder="560001" value={c.contact_zipcode} style={inputStyle}
                  onChange={(e) => updateContact(c.id, "contact_zipcode", e.target.value)} />
              </Form.Item>
              <Form.Item label="Digital Signature">
                <Upload maxCount={1} accept="image/*,.pdf"
                  beforeUpload={(file) => { updateContact(c.id, "digital_signature", file); return false; }}
                  onRemove={() => updateContact(c.id, "digital_signature", null)}
                  showUploadList={{ showRemoveIcon: true }}>
                  <Button icon={<UploadOutlined />} block style={{ ...inputStyle, width: "100%" }}>
                    {c.digital_signature ? (c.digital_signature as File).name : "Upload Signature"}
                  </Button>
                </Upload>
              </Form.Item>

              {/* ── Per-contact Is Active — was wrongly wired to company.is_active before ── */}
              <Form.Item label="Is Active">
                <div style={{ display: "flex", alignItems: "center", gap: 10, height: 38 }}>
                  <Switch checked={c.is_active} onChange={(checked) => updateContact(c.id, "is_active", checked)}
                    style={{ background: c.is_active ? "var(--accent)" : "var(--text-muted)" }} />
                  <Text style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {c.is_active ? "Active" : "Inactive"}
                  </Text>
                </div>
              </Form.Item>
            </div>
          </Form>
        </div>
      ))}
    </FormCard>
  );
});

// ─── AddressesSection ─────────────────────────────────────────────────────────
interface AddressesSectionProps {
  addresses: AddressRow[];
  addAddress: () => void;
  removeAddress: (id: number) => void;
  updateAddress: (id: number, k: keyof AddressRow, v: string | boolean) => void;
  loadingCountries: boolean;
  countryOpts: string[];
  setCountryOpts: React.Dispatch<React.SetStateAction<string[]>>;
}

const AddressesSection = React.memo(function AddressesSection({
  addresses, addAddress, removeAddress, updateAddress,
  loadingCountries, countryOpts, setCountryOpts,
}: AddressesSectionProps) {
  return (
    <FormCard icon={MapPinned} title="Company Addresses"
      subtitle="Add one or more address"
      action={
        <button className="db-card-action" onClick={addAddress}
          style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PlusOutlined /> Add Address
        </button>
      }>
      {addresses.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "28px 16px",
          color: "var(--text-muted)", fontSize: 13,
          border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-sm)",
        }}>
          No addresses added yet.
        </div>
      ) : addresses.map((a, idx) => (
        <div key={a.id} style={{
          borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)",
          padding: 16, marginBottom: idx < addresses.length - 1 ? 12 : 0,
          background: "var(--bg-card-hover)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Address {idx + 1}
              {idx > 0 && <span style={{ marginLeft: 8, color: "var(--amber)", fontWeight: 500, textTransform: "none" }}>(client-side only)</span>}
            </span>
            <button onClick={() => removeAddress(a.id)} style={{
              background: "var(--red-bg)", border: "1px solid var(--red)", borderRadius: "var(--radius-sm)",
              color: "var(--red)", cursor: "pointer", padding: "3px 8px", fontSize: 12,
            }}>
              <DeleteOutlined />
            </button>
          </div>
          <Form layout="vertical">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0 16px" }}>
              <Form.Item label="Address Line 1" style={{ gridColumn: "span 2" }} required>
                <Input placeholder="350 Mission Street" value={a.company_address_line1} style={inputStyle}
                  onChange={(e) => updateAddress(a.id, "company_address_line1", e.target.value)} />
              </Form.Item>
              <Form.Item label="Address Line 2" style={{ gridColumn: "span 2" }}>
                <Input placeholder="Suite 1200" value={a.company_address_line2} style={inputStyle}
                  onChange={(e) => updateAddress(a.id, "company_address_line2", e.target.value)} />
              </Form.Item>
              <Form.Item label="Country" required>
                <AddNewSelect placeholder="Select country…" loading={loadingCountries} showSearch
                  value={a.company_country} onChange={(v) => updateAddress(a.id, "company_country", v ?? "")}
                  options={countryOpts} setOptions={setCountryOpts} />
              </Form.Item>
              <Form.Item label="Zipcode" required>
                <Input placeholder="560001" value={a.company_zipcode} style={inputStyle}
                  onChange={(e) => updateAddress(a.id, "company_zipcode", e.target.value)} />
              </Form.Item>

              {/* ── Per-address Is Active — was wrongly wired to company.is_active before ── */}
              <Form.Item label="Is Active">
                <div style={{ display: "flex", alignItems: "center", gap: 10, height: 38 }}>
                  <Switch checked={a.is_active} onChange={(checked) => updateAddress(a.id, "is_active", checked)}
                    style={{ background: a.is_active ? "var(--accent)" : "var(--text-muted)" }} />
                  <Text style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {a.is_active ? "Active" : "Inactive"}
                  </Text>
                </div>
              </Form.Item>
            </div>
          </Form>
        </div>
      ))}
    </FormCard>
  );
});

// ─── useLocationData ──────────────────────────────────────────────────────────
function useLocationData() {
  const [countryOpts, setCountryOpts] = useState<string[]>([]);
  const [stateOpts, setStateOpts] = useState<string[]>([]);
  const [cityOpts, setCityOpts] = useState<string[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const allStatesRef = useRef<string[]>([]);
  const allCitiesRef = useRef<string[]>([]);

  useEffect(() => {
    setLoadingCountries(true);
    fetch("https://countriesnow.space/api/v0.1/countries/positions")
      .then((r) => r.json())
      .then((data) => { const names: string[] = (data.data || []).map((c: any) => c.name).sort(); setCountryOpts(names); })
      .catch(() => console.warn("Failed to load countries"))
      .finally(() => setLoadingCountries(false));
  }, []);

  useEffect(() => {
    setLoadingStates(true);
    fetch("https://countriesnow.space/api/v0.1/countries/states")
      .then((r) => r.json())
      .then((data) => {
        const all: string[] = (data.data || []).flatMap((c: any) => (c.states || []).map((s: any) => s.name)).filter(Boolean).sort();
        const unique = [...new Set<string>(all)];
        allStatesRef.current = unique; setStateOpts(unique);
      })
      .catch(() => console.warn("Failed to load states"))
      .finally(() => setLoadingStates(false));
  }, []);

  useEffect(() => {
    setLoadingCities(true);
    fetch("https://countriesnow.space/api/v0.1/countries")
      .then((r) => r.json())
      .then((data) => {
        const all: string[] = (data.data || []).flatMap((c: any) => c.cities || []).sort();
        const unique = [...new Set<string>(all)];
        allCitiesRef.current = unique; setCityOpts(unique);
      })
      .catch(() => console.warn("Failed to load cities"))
      .finally(() => setLoadingCities(false));
  }, []);

  const fetchCitiesForCountry = useCallback((countryName: string): Promise<string[]> =>
    fetch("https://countriesnow.space/api/v0.1/countries/cities", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: countryName }),
    }).then((r) => r.json()).then((data) => (data.data || []).sort()).catch(() => []), []);

  const fetchStatesForCountry = useCallback((countryName: string): Promise<string[]> =>
    fetch("https://countriesnow.space/api/v0.1/countries/states", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: countryName }),
    }).then((r) => r.json()).then((data) => (data.data?.states || []).map((s: any) => s.name).sort()).catch(() => []), []);

  const fetchCitiesForState = useCallback(async (countryName: string, stateName: string): Promise<string[]> => {
    try {
      const res = await fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: countryName, state: stateName }),
      });
      const data = await res.json();
      const cities: string[] = (data.data || []).sort();
      if (cities.length > 0) return cities;
    } catch { }
    if (countryName) {
      const fallback = await fetchCitiesForCountry(countryName);
      if (fallback.length > 0) return fallback;
    }
    return allCitiesRef.current;
  }, [fetchCitiesForCountry]);

  const handleCountryChange = useCallback((country: string, onStateClear: () => void, onCityClear: () => void) => {
    onStateClear(); onCityClear();
    if (!country) { setStateOpts(allStatesRef.current); setCityOpts(allCitiesRef.current); return; }
    setLoadingStates(true);
    fetchStatesForCountry(country).then((states) => setStateOpts(states.length > 0 ? states : allStatesRef.current)).finally(() => setLoadingStates(false));
    setLoadingCities(true);
    fetchCitiesForCountry(country).then((cities) => setCityOpts(cities.length > 0 ? cities : allCitiesRef.current)).finally(() => setLoadingCities(false));
  }, [fetchStatesForCountry, fetchCitiesForCountry]);

  const handleStateChange = useCallback((state: string, country: string, onCityClear: () => void) => {
    onCityClear();
    if (!state) {
      if (country) { setLoadingCities(true); fetchCitiesForCountry(country).then((cities) => setCityOpts(cities.length > 0 ? cities : allCitiesRef.current)).finally(() => setLoadingCities(false)); }
      else { setCityOpts(allCitiesRef.current); }
      return;
    }
    setLoadingCities(true);
    fetchCitiesForState(country, state).then((cities) => setCityOpts(cities)).finally(() => setLoadingCities(false));
  }, [fetchCitiesForCountry, fetchCitiesForState]);

  return {
    countryOpts, setCountryOpts, stateOpts, setStateOpts, cityOpts, setCityOpts,
    loadingCountries, loadingStates, loadingCities, handleCountryChange, handleStateChange,
  };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Onboarding() {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("basic");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [countries, setCountries] = useState<Country[]>([]);
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(["INR"]);

  const [agencyTypes, setAgencyTypes] = useState<string[]>(DEFAULT_CHOICES.agency_types);
  const [placesOfSupply, setPlacesOfSupply] = useState<string[]>(DEFAULT_CHOICES.place_of_supply);
  const [taxTypes, setTaxTypes] = useState<string[]>(DEFAULT_CHOICES.tax_types);

  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";
  const leadId = searchParams.get("leadId");

  const {
    countryOpts, setCountryOpts, stateOpts, setStateOpts, cityOpts, setCityOpts,
    loadingCountries, loadingStates, loadingCities,
    handleCountryChange: _handleCountryChange, handleStateChange: _handleStateChange,
  } = useLocationData();

  // ── Categories-backed lookups ──────────────────────────────────────────
  const [authorizedPersons, setAuthorizedPersons] = useState<{ id: number; name: string }[]>([]);
  const [loadingAuthorizedPersons, setLoadingAuthorizedPersons] = useState(false);

  const [paymentTerms, setPaymentTerms] = useState<{ id: number; title: string; days: number }[]>([]);
  const [loadingPaymentTerms, setLoadingPaymentTerms] = useState(false);

  const [companyAddresses, setCompanyAddresses] = useState<{ id: number; label: string }[]>([]);
  const [loadingCompanyAddresses, setLoadingCompanyAddresses] = useState(false);

  const [bankDetails, setBankDetails] = useState<{ id: number; label: string }[]>([]);
  const [loadingBankDetails, setLoadingBankDetails] = useState(false);

  useEffect(() => {
    setLoadingAuthorizedPersons(true);
    // ← fixed: was `/authorized-persons/`, now matches categories/urls.py
    fetch(`${BASE_URL}/categories/get_all_authorized_persons/`)
      .then((r) => r.json())
      .then((data) => setAuthorizedPersons(Array.isArray(data) ? data : data.results || []))
      .catch(() => console.warn("Failed to load authorized persons"))
      .finally(() => setLoadingAuthorizedPersons(false));
  }, []);

  useEffect(() => {
    setLoadingPaymentTerms(true);
    fetch(`${BASE_URL}/categories/get_all_payment_terms/`)
      .then((r) => r.json())
      .then((data) => setPaymentTerms(Array.isArray(data) ? data : data.results || []))
      .catch(() => console.warn("Failed to load payment terms"))
      .finally(() => setLoadingPaymentTerms(false));
  }, []);

  useEffect(() => {
    setLoadingCompanyAddresses(true);
    fetch(`${BASE_URL}/categories/get_all_company_addresses/`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setCompanyAddresses(
          list.map((a: any) => ({
            id: a.id,
            label: `${a.company_name} — ${a.city}, ${a.state_name}`,
          }))
        );
      })
      .catch(() => console.warn("Failed to load company addresses"))
      .finally(() => setLoadingCompanyAddresses(false));
  }, []);

  useEffect(() => {
    setLoadingBankDetails(true);
    fetch(`${BASE_URL}/categories/get_all_bank_details/`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setBankDetails(
          list.map((b: any) => ({
            id: b.id,
            label: `${b.bank_name}${b.nick_name ? ` (${b.nick_name})` : ""} — ${b.account_number}`,
          }))
        );
      })
      .catch(() => console.warn("Failed to load bank details"))
      .finally(() => setLoadingBankDetails(false));
  }, []);

  const [company, setCompany] = useState<CompanyForm>({
    company_name: "", report_id: "", company_type: "", agency_type: "",
    brand: "", website: "", phone_code: "+91", phone_cca2: "IN", phone: "", email: "",
    billing_currency: "INR", address_line1: "", address_line2: "",
    country: "", state: "", city: "", zipcode: "", cin_number: "", gst_number: "",
    place_of_supply: "", is_active: true, is_domestic: true, credit_period_days: "", show_campaign_name_in_email: false,
    payment_terms: "", payment_type: "Prepaid", tax_type: "", tds_applicable: "",
    tds_section: "", advance_amount: "", credit_limit: "", outstanding_limit: "",
    billing_contact: "", default_market: "", default_platform: "", inventory_type: "",
    campaign_objective: "", language: "", audience_focus: "", ad_formats: "", timezone: "",
    account_manager: "", sales_owner: "", campaign_manager: "", finance_owner: "",
    client_type: "", priority: "", risk_level: "", payment_behavior: "",
    avg_response_time: "", notes: "", additional_internal_notes: "", additional_tags: "",
    default_invoice_address: "", default_invoice_bank: "", default_authorized_person: "", default_email_send_to: "", default_email_send_cc: "",
    invoice_type: "single",
  });
  const [contacts, setContacts] = useState<ContactRow[]>([makeContact()]);
  const [addresses, setAddresses] = useState<AddressRow[]>([makeAddress()]);

  useEffect(() => {
    fetch("https://api.countrystatecity.in/v1/countries", {
      headers: { "X-CSCAPI-KEY": import.meta.env.VITE_CSC_API_KEY },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`CSC API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Unexpected response shape");
        const list: Country[] = data
          .map((c: any) => ({
            name: c.name,
            cca2: c.iso2,
            code: `+${c.phonecode}`,
            emoji: c.emoji,
            flagUrl: `https://flagcdn.com/24x18/${c.iso2.toLowerCase()}.png`,
            currency: c.currency,
          }))
          .sort((a: Country, b: Country) => a.name.localeCompare(b.name));
        setCountries(list);
      })
      .catch((err) => console.error("Failed to load countries:", err));
  }, []);

  const sf = useCallback(
    (k: keyof CompanyForm, v: string | boolean) => setCompany((p) => ({ ...p, [k]: v })), []
  );

  useEffect(() => {
    if (prefillEmail) {
      sf("email", prefillEmail);
      form.setFieldsValue({ email: prefillEmail });
    }
  }, [prefillEmail, sf, form]);

  const onCompanyStateChange = useCallback((v: string) => {
    sf("state", v ?? "");
    _handleStateChange(v ?? "", company.country, () => { sf("city", ""); form.setFieldsValue({ city: undefined }); });
  }, [sf, _handleStateChange, company.country, form]);

  const onCompanyCountryChangeWithCurrency = useCallback((countryName: string) => {
    sf("country", countryName ?? "");
    _handleCountryChange(countryName ?? "",
      () => { sf("state", ""); form.setFieldsValue({ state: undefined }); },
      () => { sf("city", ""); form.setFieldsValue({ city: undefined }); }
    );

    const match = countries.find((c) => c.name === countryName);
    if (match?.currency) {
      setAvailableCurrencies([match.currency]);
      sf("billing_currency", match.currency);
    } else {
      setAvailableCurrencies(["INR"]);
      sf("billing_currency", "INR");
    }
  }, [sf, _handleCountryChange, form, countries]);

  const addContact = useCallback(() => setContacts((p) => [...p, { ...makeContact(), id: Date.now() }]), []);
  const removeContact = useCallback((id: number) => setContacts((p) => p.filter((c) => c.id !== id)), []);
  const updateContact = useCallback((id: number, k: keyof ContactRow, v: string | File | boolean | null) =>
    setContacts((p) => p.map((c) => (c.id === id ? { ...c, [k]: v } : c))), []);

  const addAddress = useCallback(() => setAddresses((p) => [...p, { ...makeAddress(), id: Date.now() }]), []);
  const removeAddress = useCallback((id: number) => setAddresses((p) => p.filter((a) => a.id !== id)), []);
  const updateAddress = useCallback((id: number, k: keyof AddressRow, v: string | boolean) =>
    setAddresses((p) => p.map((a) => (a.id === id ? { ...a, [k]: v } : a))), []);

  const getEmailDomain = (email: string) => {
    const at = email.lastIndexOf("@");
    return at === -1 ? null : email.slice(at + 1).toLowerCase().trim();
  };

  const checkDomainMismatch = useCallback((): string | null => {
    const contactDomains = new Set(
      contacts.map((c) => getEmailDomain(c.contact_email)).filter(Boolean)
    );
    if (contactDomains.size === 0) return null; // nothing to check against

    const fieldsToCheck: [string, string][] = [
      ["Default Email To", company.default_email_send_to],
      ["Default Email CC", company.default_email_send_cc],
    ];

    for (const [label, value] of fieldsToCheck) {
      if (!value) continue;
      const emails = value.split(",").map((e) => e.trim()).filter(Boolean);
      const invalid = emails.filter((e) => !contactDomains.has(getEmailDomain(e) || ""));
      if (invalid.length > 0) {
        return `${label}: these don't match any contact's domain (${[...contactDomains].join(", ")}): ${invalid.join(", ")}`;
      }
    }
    return null;
  }, [contacts, company.default_email_send_to, company.default_email_send_cc]);

  const buildPayload = useCallback(() => {
    const clientFields = {
      name: company.company_name, report_id: company.report_id, company_type: company.company_type,
      agency_type: company.agency_type, brand: company.brand, website: company.website,
      phone: company.phone, email: company.email, billing_currency: company.billing_currency,
      address_line1: company.address_line1, address_line2: company.address_line2,
      country: company.country, state: company.state, city: company.city, zipcode: company.zipcode,
      cin_number: company.cin_number, gst_number: company.gst_number,
      place_of_supply: company.place_of_supply,
      is_active: company.is_active,
      is_domestic: company.is_domestic, // ← added
      show_campaign_name_in_email: company.show_campaign_name_in_email,
      default_email_send_to: company.default_email_send_to,
      default_email_send_cc: company.default_email_send_cc,
    };
    const billing = {
      credit_period_days: parseInt(company.credit_period_days) || 0,
      payment_terms: company.payment_terms, // now a PaymentTerms ID
      payment_type: company.payment_type,
      tax_type: company.tax_type, tds_applicable: company.tds_applicable === "Yes",
      tds_section: company.tds_section, billing_currency: company.billing_currency,
      advance_amount: company.advance_amount, credit_limit: company.credit_limit,
      outstanding_limit: company.outstanding_limit,
      invoice_type: company.invoice_type,
      default_invoice_address: company.default_invoice_address, // InvoiceCompanyAddress ID
      default_invoice_bank: company.default_invoice_bank,       // InvoiceBankDetails ID
      default_authorized_person: company.default_authorized_person, // InvoiceAuthorizedPerson ID
    };
    const contactsPayload = contacts.map((c) => ({
      name: c.contact_name, phone: `${c.contact_phone_code ?? company.phone_code}${c.contact_phone}`,
      email: c.contact_email, designation: c.contact_designation, country: c.contact_country,
      zipcode: c.contact_zipcode, address_line1: c.contact_address_1, address_line2: c.contact_address_2,
      is_active: c.is_active, // ← added
    }));
    const addressesPayload = addresses.map((a, idx) => ({
      address_line1: a.company_address_line1, address_line2: a.company_address_line2,
      country: a.company_country, zipcode: a.company_zipcode, is_primary: idx === 0,
      is_active: a.is_active, // ← added
    }));
    const jsonBody = { ...clientFields, billing, contacts: contactsPayload, addresses: addressesPayload, ...(leadId ? { lead_id: Number(leadId) } : {}), };
    const signatureFile = contacts[0]?.digital_signature;
    if (signatureFile) {
      const fd = new FormData();
      fd.append("data", JSON.stringify(jsonBody));
      contacts.forEach((contact, index) => { if (contact.digital_signature) fd.append(`contact_signature_${index}`, contact.digital_signature); });
      return { body: fd, headers: {} as Record<string, string> };
    }
    return { body: JSON.stringify(jsonBody), headers: { "Content-Type": "application/json" } as Record<string, string> };
  }, [company, contacts, addresses]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    setCompany({
      company_name: "", report_id: "", company_type: "", agency_type: "", brand: "", website: "",
      phone_code: "+91", phone_cca2: "IN", phone: "", email: "", billing_currency: "INR",
      address_line1: "", address_line2: "", country: "", state: "", city: "", zipcode: "",
      cin_number: "", gst_number: "", place_of_supply: "", is_active: true,
      is_domestic: true, credit_period_days: "", show_campaign_name_in_email: false,
      payment_terms: "", payment_type: "Prepaid", tax_type: "", tds_applicable: "",
      tds_section: "", advance_amount: "", credit_limit: "", outstanding_limit: "",
      billing_contact: "", default_market: "", default_platform: "", inventory_type: "",
      campaign_objective: "", language: "", audience_focus: "", ad_formats: "", timezone: "",
      account_manager: "", sales_owner: "", campaign_manager: "", finance_owner: "",
      client_type: "", priority: "", risk_level: "", payment_behavior: "",
      avg_response_time: "", notes: "", additional_internal_notes: "", additional_tags: "",
      default_invoice_address: "", default_invoice_bank: "", default_authorized_person: "",
      invoice_type: "single", default_email_send_to: "", default_email_send_cc: "",
    });
    setContacts([makeContact()]); setAddresses([makeAddress()]); setActiveTab("basic");
  }, [form]);

  const handleSubmit = useCallback(async () => {
    try { await form.validateFields(); } catch { return; }

    const domainError = checkDomainMismatch();
    if (domainError) {
      setSubmitStatus("error");
      setErrorMessage(domainError);
      return;
    }

    setSubmitting(true); setSubmitStatus("idle"); setErrorMessage("");
    try {
      const { body, headers } = buildPayload();
      const res = await fetch(`${BASE_URL}/company_details/create_client/`, { method: "POST", headers, body });
      if (res.ok) {
        const json = await res.json(); // { message, client_id }
        setSubmitStatus("success");
        if (leadId && json.client_id) {
          const channel = new BroadcastChannel("leads-updates");
          channel.postMessage({
            type: "client_created",
            leadId: Number(leadId),
            client_id: json.client_id,
          });
          channel.close();
        }
      }
      else {
        let errMsg = `Server error ${res.status}`;
        try {
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            errMsg = json.error || JSON.stringify(json);
          } catch {
            errMsg = text || errMsg;
          }
        } catch { }
        setSubmitStatus("error"); setErrorMessage(errMsg);
      }
    } catch (err: unknown) {
      setSubmitStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Network error");
    } finally { setSubmitting(false); }
  }, [form, buildPayload, checkDomainMismatch]);

  const tabItems = useMemo(
    () =>
      TABS.map((t) => {
        const Icon = t.icon;

        return {
          key: t.id,
          label: (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon size={16} />
              {t.label}
            </span>
          ),
        };
      }),
    []
  );

  const billingFormProps = useMemo<BillingFormProps>(() => ({
    company, sf, form, taxTypes, setTaxTypes,
    availableCurrencies, authorizedPersons, loadingAuthorizedPersons,
    paymentTerms, loadingPaymentTerms,
    companyAddresses, loadingCompanyAddresses,
    bankDetails, loadingBankDetails,
  }), [
    company, sf, form, taxTypes, availableCurrencies, authorizedPersons, loadingAuthorizedPersons,
    paymentTerms, loadingPaymentTerms, companyAddresses, loadingCompanyAddresses, bankDetails, loadingBankDetails,
  ]);

  const contactsSectionProps = useMemo<ContactsSectionProps>(() => ({
    contacts, addContact, removeContact, updateContact, countries,
    loadingCountries, countryOpts, setCountryOpts,
  }), [contacts, countries, loadingCountries, countryOpts, addContact, removeContact, updateContact]);

  const addressesSectionProps = useMemo<AddressesSectionProps>(() => ({
    addresses, addAddress, removeAddress, updateAddress,
    loadingCountries, countryOpts, setCountryOpts,
  }), [addresses, loadingCountries, countryOpts, addAddress, removeAddress, updateAddress]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="db-root" style={{ flexDirection: "column" }}>
      <header className="db-header" style={{ position: "sticky", top: 0, zIndex: 100, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              height: 32, padding: "0 12px",
              background: "var(--bg-input)", border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-sm)", cursor: "pointer",
              color: "var(--text-secondary)", fontSize: 12, fontWeight: 600,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <ArrowLeftOutlined /> Back
          </button>
          <div className="db-logo-icon">B</div>
          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--accent)", letterSpacing: "-0.02em" }}>
            BILLION <span style={{ color: "var(--text-primary)" }}>TAGS</span>
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/ New Client Onboarding</span>
        </div>
      </header>

      <div style={{ width: "100%", padding: "24px 34px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => navigate(-1)} style={{
              width: 35, height: 35, display: "grid", placeItems: "center",
              borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
              background: "transparent", cursor: "pointer", color: "var(--text-muted)",
            }}>
              <ArrowLeftOutlined style={{ fontSize: 12 }} />
            </button>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                Add New Client
              </h1>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Create a new client profile with all required details</p>
            </div>
          </div>
        </div>

        {submitStatus === "success" && (
          <div style={{
            marginBottom: 16, padding: "12px 16px",
            background: "var(--green-bg)", border: "1px solid var(--green)",
            borderRadius: "var(--radius-sm)", color: "var(--green)", fontSize: 13, fontWeight: 500,
          }}>
            ✅ Client submitted successfully! Client ID will be auto-assigned.
          </div>
        )}
        {submitStatus === "error" && (
          <div style={{
            marginBottom: 16, padding: "12px 16px",
            background: "var(--red-bg)", border: "1px solid var(--red)",
            borderRadius: "var(--radius-sm)", color: "var(--red)", fontSize: 13, fontWeight: 500,
          }}>
            ❌ Submission failed: {errorMessage}
          </div>
        )}

        <div className="db-card" style={{ overflow: "hidden", padding: 0 }}>

          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

          <div style={{ padding: "22px 22px", background: "var(--bg-page)", display: "flex", flexDirection: "column", gap: 16 }}>

            {activeTab === "basic" && (
              <>
                <FormCard icon={FileText} title="Basic Information">
                  <Form form={form} layout="vertical">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0 16px" }}>

                      <Form.Item label="Client ID (Auto)">
                        <Input disabled value="Auto-generated" style={inputStyle} />
                      </Form.Item>

                      <Form.Item label="Reporting ID" name="report_id">
                        <Input placeholder="RE0001" value={company.report_id} style={inputStyle}
                          onChange={(e) => sf("report_id", e.target.value)} />
                      </Form.Item>

                      <Form.Item label="Company Name" name="company_name"
                        rules={[{ required: true, message: "Company name is required" }]}>
                        <Input placeholder="Acme Corp" value={company.company_name} style={inputStyle}
                          onChange={(e) => sf("company_name", e.target.value)} />
                      </Form.Item>

                      <Form.Item label="Company Type" name="company_type"
                        rules={[{ required: true, message: "Company type is required" }]}>
                        <Input placeholder="Private Limited" value={company.company_type} style={inputStyle}
                          onChange={(e) => sf("company_type", e.target.value)} />
                      </Form.Item>

                      <Form.Item label="Agency Type" name="agency_type"
                        rules={[{ required: true, message: "Agency type is required" }]}>
                        <AddNewSelect value={company.agency_type} onChange={(v: any) => sf("agency_type", v)}
                          options={agencyTypes} setOptions={setAgencyTypes} placeholder="Select Agency Type" />
                      </Form.Item>

                      <Form.Item label="Brand / Parent Company">
                        <Input placeholder="Parent Group" value={company.brand} style={inputStyle}
                          onChange={(e) => sf("brand", e.target.value)} />
                      </Form.Item>

                      <Form.Item label="Website" name="website"
                        rules={[
                          { required: true, message: "Website is required" },
                          { pattern: /^(https?:\/\/)(localhost|\d{1,3}(\.\d{1,3}){3}|[\w\-]+(\.[\w\-]+)+)(:\d+)?(\/[^\s]*)?$/, message: "Enter a valid URL (https://…)" },
                        ]}>
                        <Input placeholder="https://" value={company.website} style={inputStyle}
                          onChange={(e) => sf("website", e.target.value)} />
                      </Form.Item>

                      <Form.Item label="Phone Number" name="phone"
                        rules={[{ required: true, message: "Phone number is required" }]}
                        getValueProps={() => ({ value: company.phone })}>
                        <PhoneInput phone={company.phone} phone_code={company.phone_code}
                          phone_cca2={company.phone_cca2} countries={countries}
                          onPhoneChange={(v) => { sf("phone", v); form.setFieldValue("phone", v); }}
                          onCountryChange={(code, cca2) => { sf("phone_code", code); sf("phone_cca2", cca2); }} />
                      </Form.Item>

                      <Form.Item label="Email" name="email"
                        rules={[{ required: true, message: "Email is required" }, { type: "email", message: "Enter a valid email" }]}>
                        <Input placeholder="contact@company.com" value={company.email} style={inputStyle}
                          onChange={(e) => sf("email", e.target.value)} />
                      </Form.Item>

                      <Form.Item label="Address Line 1" name="address_line1"
                        rules={[{ required: true, message: "Address line 1 is required" }]}>
                        <Input placeholder="Street address" value={company.address_line1} style={inputStyle}
                          onChange={(e) => sf("address_line1", e.target.value)} />
                      </Form.Item>

                      <Form.Item label="Address Line 2">
                        <Input placeholder="Suite / Floor" value={company.address_line2} style={inputStyle}
                          onChange={(e) => sf("address_line2", e.target.value)} />
                      </Form.Item>

                      <Form.Item label="Country" name="country"
                        rules={[{ required: true, message: "Country is required" }]}>
                        <AddNewSelect placeholder="Select country…" loading={loadingCountries} showSearch
                          value={company.country} onChange={onCompanyCountryChangeWithCurrency}
                          options={countryOpts} setOptions={setCountryOpts} />
                      </Form.Item>

                      <Form.Item label="State / Province" name="state"
                        rules={[{ required: true, message: "State is required" }]}>
                        <AddNewSelect
                          placeholder={loadingStates ? "Loading…" : company.country ? "Select state…" : "Select country first…"}
                          loading={loadingStates} showSearch value={company.state}
                          onChange={onCompanyStateChange} options={stateOpts} setOptions={setStateOpts} />
                      </Form.Item>

                      <Form.Item label="City" name="city"
                        rules={[{ required: true, message: "City is required" }]}>
                        <AddNewSelect
                          placeholder={loadingCities ? "Loading…" : company.state ? "Select city…" : "Select state first…"}
                          loading={loadingCities} showSearch value={company.city}
                          onChange={(v) => sf("city", v ?? "")} options={cityOpts} setOptions={setCityOpts} />
                      </Form.Item>

                      <Form.Item label="Zip Code" name="zipcode"
                        rules={[{ required: true, message: "Zip code is required" }]}>
                        <Input type="number" placeholder="560001" value={company.zipcode} style={inputStyle}
                          onChange={(e) => sf("zipcode", e.target.value)} />
                      </Form.Item>

                      <Form.Item label="CIN Number" name="cin_number">
                        <Input placeholder="U12345KA2020PTC123456" value={company.cin_number} style={inputStyle}
                          onChange={(e) => sf("cin_number", e.target.value)} />
                      </Form.Item>
                      <Form.Item label="Gst Number" name="gst_number">
                        <Input placeholder="Enter GST number" value={company.gst_number} style={inputStyle}
                          onChange={(e) => sf("gst_number", e.target.value)} />
                      </Form.Item>

                      <Form.Item label="Place of Supply" name="place_of_supply">
                        <AddNewSelect value={company.place_of_supply} onChange={(v: any) => sf("place_of_supply", v)}
                          options={placesOfSupply} setOptions={setPlacesOfSupply} placeholder="Select place of supply" />
                      </Form.Item>

                      <Form.Item label="Default Email To" name="default_email_send_to"
                        rules={[{ validator: validateEmailList }]}>
                        <Input placeholder="abc@gmail.com, xyz@gmail.com" value={company.default_email_send_to}
                          onChange={(e) => sf("default_email_send_to", e.target.value)} style={inputStyle} />
                      </Form.Item>

                      <Form.Item label="Default Email CC" name="default_email_send_cc"
                        rules={[{ validator: validateEmailList }]}>
                        <Input placeholder="abc@gmail.com, xyz@gmail.com" value={company.default_email_send_cc}
                          onChange={(e) => sf("default_email_send_cc", e.target.value)} style={inputStyle} />
                      </Form.Item>

                      <Form.Item label="Show Campaign Name in the Email">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 38 }}>
                          <Switch checked={company.show_campaign_name_in_email} onChange={(checked) => sf("show_campaign_name_in_email", checked)}
                            style={{ background: company.show_campaign_name_in_email ? "var(--accent)" : "var(--text-muted)" }} />
                          <Text style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {company.show_campaign_name_in_email ? "Show" : "Not Show"}
                          </Text>
                        </div>
                      </Form.Item>

                      {/* ── Is Domestic — now correctly bound to its own field ── */}
                      <Form.Item label="Is Domestic">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 38 }}>
                          <Switch checked={company.is_domestic} onChange={(checked) => sf("is_domestic", checked)}
                            style={{ background: company.is_domestic ? "var(--accent)" : "var(--text-muted)" }} />
                          <Text style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {company.is_domestic ? "Domestic" : "International"}
                          </Text>
                        </div>
                      </Form.Item>

                      {/* ── Is Active — separate from Is Domestic now ── */}
                      <Form.Item label="Is Active">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 38 }}>
                          <Switch checked={company.is_active} onChange={(checked) => sf("is_active", checked)}
                            style={{ background: company.is_active ? "var(--accent)" : "var(--text-muted)" }} />
                          <Text style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {company.is_active ? "Active" : "Inactive"}
                          </Text>
                        </div>
                      </Form.Item>

                    </div>
                  </Form>
                </FormCard>

                <FormCard icon={CreditCard} title="Billing & Commercials">
                  <BillingForm {...billingFormProps} />
                </FormCard>

                <ContactsSection {...contactsSectionProps} />
                <AddressesSection {...addressesSectionProps} />

                <div style={{
                  position: "sticky", bottom: 0,
                  background: "var(--bg-header)", borderTop: "1px solid var(--border)",
                  margin: "8px -22px -22px", padding: "14px 22px",
                  display: "flex", justifyContent: "flex-end", gap: 10,
                }}>
                  <button onClick={handleCancel} style={{
                    height: 38, padding: "0 18px",
                    background: "var(--bg-input)", border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600,
                    color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Poppins', sans-serif",
                    transition: "border-color 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}>
                    Cancel
                  </button>
                  <button onClick={handleSubmit} disabled={submitting} style={{
                    height: 38, padding: "0 20px",
                    background: submitting ? "var(--text-muted)" : "var(--accent)",
                    border: "none", borderRadius: "var(--radius-sm)",
                    fontSize: 13, fontWeight: 700, color: "#fff",
                    cursor: submitting ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                    fontFamily: "'Poppins', sans-serif",
                    boxShadow: submitting ? "none" : "0 0 16px rgba(152,62,245,0.35)",
                    opacity: submitting ? 0.7 : 1, transition: "opacity 0.15s",
                  }}>
                    {submitting ? (
                      <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "ob-spin 0.7s linear infinite" }} /> Submitting…</>
                    ) : (
                      <><SaveOutlined /> Submit</>
                    )}
                  </button>
                </div>
              </>
            )}

            {activeTab === "billing" && (
              <FormCard icon={CreditCard} title="Billing & Commercials">
                <BillingForm {...billingFormProps} />
              </FormCard>
            )}

            {activeTab === "contacts" && (
              <>
                <ContactsSection {...contactsSectionProps} />
                <AddressesSection {...addressesSectionProps} />
              </>
            )}

            {activeTab === "review" && (
              <>
                <FormCard icon={CheckCircle2} title="Review & Summary" subtitle="Confirm all details before final submission">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
                        Company Details
                      </p>
                      {[
                        ["Company Name", company.company_name],
                        ["Company Type", company.company_type],
                        ["Email", company.email],
                        ["Phone", `${company.phone_code} ${company.phone}`],
                        ["Country", company.country],
                        ["State", company.state],
                        ["City", company.city],
                        ["CIN Number", company.cin_number],
                        ["GST Number", company.gst_number],
                        ["Domestic", company.is_domestic ? "Yes" : "No"],
                        ["Show Campaign Name", company.show_campaign_name_in_email ? "Yes" : "No"],
                        ["Status", company.is_active ? "Active" : "Inactive"],
                      ].map(([label, value]) => (
                        <div key={label} style={{
                          display: "flex", justifyContent: "space-between",
                          padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12,
                        }}>
                          <span style={{ color: "var(--text-muted)" }}>{label}</span>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)", maxWidth: "55%", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {typeof value === "string" ? (value || "–") : value}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
                        Billing Details
                      </p>
                      {[
                        ["Billing Currency", company.billing_currency],
                        ["Payment Type", company.payment_type],
                        ["Payment Terms", paymentTerms.find((t) => String(t.id) === company.payment_terms)?.title || "–"],
                        ["Tax Type", company.tax_type],
                        ["Credit Limit", company.credit_limit],
                        ["From Company Address", companyAddresses.find((a) => String(a.id) === company.default_invoice_address)?.label || "–"],
                        ["From Bank Account", bankDetails.find((b) => String(b.id) === company.default_invoice_bank)?.label || "–"],
                        ["Authorized Person", authorizedPersons.find((p) => String(p.id) === company.default_authorized_person)?.name || "–"],
                      ].map(([label, value]) => (
                        <div key={label} style={{
                          display: "flex", justifyContent: "space-between",
                          padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12,
                        }}>
                          <span style={{ color: "var(--text-muted)" }}>{label}</span>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value || "–"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {contacts[0]?.contact_name && (
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
                        Primary Contact
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                        {[
                          ["Name", contacts[0].contact_name],
                          ["Email", contacts[0].contact_email],
                          ["Phone", contacts[0].contact_phone],
                          ["Designation", contacts[0].contact_designation],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{value || "–"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </FormCard>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={handleSubmit} disabled={submitting} style={{
                    height: 40, padding: "0 24px",
                    background: submitting ? "var(--text-muted)" : "var(--accent)",
                    border: "none", borderRadius: "var(--radius-sm)",
                    fontSize: 13, fontWeight: 700, color: "#fff",
                    cursor: submitting ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                    fontFamily: "'Poppins', sans-serif",
                    boxShadow: submitting ? "none" : "0 0 16px rgba(152,62,245,0.35)",
                    opacity: submitting ? 0.7 : 1,
                  }}>
                    {submitting ? "Submitting…" : <><SaveOutlined /> Submit for Approval</>}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>

    </div>
  );
}