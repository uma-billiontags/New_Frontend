import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Form, Input, Select, DatePicker, Button, Divider, message } from "antd";
import {
    SaveOutlined, PlusOutlined, CloseOutlined, EnvironmentOutlined,
    InfoCircleOutlined, CheckOutlined, DeleteOutlined,
    FileImageOutlined, VideoCameraOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import getSymbolFromCurrency from "currency-symbol-map";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const { TextArea } = Input;

function currencySymbolFor(code?: string): string {
    if (!code) return "$";
    return getSymbolFromCurrency(code.toUpperCase()) ?? "$";
}

const CPM_RATES: Record<string, number> = { banner: 1, Interstitial: 1, video: 1.25, youtube: 1.25 };
const CPC_RATES: Record<string, number> = { banner: 1, Interstitial: 1, video: 1.25, youtube: 1.25 };

const AD_FORMAT_OPTIONS = [
    { value: "banner", label: "Banner" },
    { value: "video", label: "Video" },
    { value: "youtube", label: "Youtube" },
    { value: "Interstitial", label: "Interstitial" },
];

// Which upload page a given ad format should route to.
const IMAGE_FORMATS = ["banner", "Interstitial"];
const VIDEO_FORMATS = ["video", "youtube"];

const UNITS_OPTIONS = ["CPM", "CPC"];
const toOpts = (arr: string[]) => arr.map((s) => ({ value: s, label: s }));

// Route names for the two upload pages built alongside this file.
// Adjust these two paths to match your router if your app mounts them elsewhere.
const IMAGE_UPLOAD_ROUTE = "/account_manager/creative_image_upload_campaign";
const VIDEO_UPLOAD_ROUTE = "/account_manager/creative_video_upload_campaign";

// ── Shared types ──────────────────────────────────────────────────────────────
export interface GeoLocation {
    country: string;
    state: string;
    city: string;
    address: string;
    zipcode: string;
    range?: string;
}

export interface CreativeData {
    creative_name: string;
    main_asset?: File | null;
    backup_image?: File | null;
    dimensions?: string;
    aspect_ratio?: string;
    file_size?: string;
    click_through_url?: string;
    appended_html_tag?: string;
    integration_code?: string;
    notes?: string;
    type?: "standard" | "third_party";
}

interface LeadLineItem {
    id: string;
    lineItemName: string;
    ethnicity: string;
    startDate: string;
    endDate: string;
    adFormat: string;
    impressions: string;
    units: string;
    rate: string;
    // KPI defaults — editable, flagged with a note when changed
    ctr: string;
    viewability: string;
    vcr: string;
    ctrNotes: string;
    // Targeting & Settings — lives per line item
    age: string[];
    gender: string[];
    geoLocations: GeoLocation[];
}

type LineItemCreativesMap = Record<string, CreativeData[]>;

const NAV_FLAG_KEY = "campaign_create_leads_nav_to_creative";
const DRAFT_KEY = "campaign_create_leads_draft";

function setNavFlag() { try { sessionStorage.setItem(NAV_FLAG_KEY, "1"); } catch { /* ignore */ } }
function consumeNavFlag(): boolean {
    try {
        const v = sessionStorage.getItem(NAV_FLAG_KEY);
        sessionStorage.removeItem(NAV_FLAG_KEY);
        return v === "1";
    } catch { return false; }
}
function saveDraft(data: object) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* ignore */ } }
function loadDraft(): Record<string, any> | null {
    try { const raw = sessionStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function clearDraft() { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }

function generateLineItemId(index: number, offset: number, prefix: string): string {
    const paddedIndex = String(offset + index - 1).padStart(3, "0");
    return `LI${prefix}${paddedIndex}`;
}

function emptyLineItem(index: number, offset: number, prefix: string): LeadLineItem {
    return {
        id: generateLineItemId(index, offset, prefix),
        lineItemName: "", ethnicity: "", startDate: "", endDate: "",
        adFormat: "", impressions: "", units: "", rate: "",
        ctr: "0.4", viewability: "70", vcr: "70", ctrNotes: "",
        age: [], gender: [], geoLocations: [],
    };
}

function isLineItemComplete(li: LeadLineItem): boolean {
    return !!(li.lineItemName.trim() && li.startDate && li.endDate && li.adFormat);
}

// ── FIX: template literals now use proper backticks so this actually compiles,
// and it's wired up below (previously dead code) so LEAD### IDs stay globally
// unique against LineItem.line_item_id's unique=True constraint on the backend.
async function fetchLastLineItemOffset(prefixRaw: string): Promise<number> {
    try {
        const prefix = `LI${prefixRaw}`;
        const res = await fetch(`${BASE_URL}/campaigns/get_campaigns/`, {
            headers: { Accept: "application/json", "ngrok-skip-browser-warning": "1" },
        });
        if (!res.ok) return 1;
        const data = await res.json();
        const allIds: string[] = [];
        (data || []).forEach((c: any) => {
            (c.line_items || []).forEach((li: any) => {
                if (li.line_item_id && li.line_item_id.startsWith(prefix)) allIds.push(li.line_item_id);
            });
        });
        if (allIds.length === 0) return 1;
        const nums = allIds.map((id) => parseInt(id.replace(prefix, ""), 10)).filter((n) => !isNaN(n));
        return nums.length === 0 ? 1 : Math.max(...nums) + 1;
    } catch { return 1; }
}

// ── Geo Targeting (country → state → city cascade, with "+ Add new" support) ──
function GeoTargeting({ locations, onAdd, onRemove }: {
    locations: GeoLocation[];
    onAdd: (l: GeoLocation) => void;
    onRemove: (i: number) => void;
}) {
    const [country, setCountry] = useState("");
    const [state, setState] = useState("");
    const [city, setCity] = useState("");
    const [zipcode, setZipcode] = useState("");
    const [address, setAddress] = useState("");
    const [range, setRange] = useState("");
    const [countryOpts, setCountryOpts] = useState<string[]>([]);
    const [stateOpts, setStateOpts] = useState<string[]>([]);
    const [cityOpts, setCityOpts] = useState<string[]>([]);
    const [loadingC, setLoadingC] = useState(false);
    const [loadingS, setLoadingS] = useState(false);
    const [loadingCt, setLoadingCt] = useState(false);

    // ── "Add new" inline-entry state ──
    const [addingCountry, setAddingCountry] = useState(false);
    const [addingState, setAddingState] = useState(false);
    const [addingCity, setAddingCity] = useState(false);
    const [newCountry, setNewCountry] = useState("");
    const [newState, setNewState] = useState("");
    const [newCity, setNewCity] = useState("");

    useEffect(() => {
        setLoadingC(true);
        fetch("https://countriesnow.space/api/v0.1/countries/positions")
            .then((r) => r.json())
            .then((d) => setCountryOpts((d.data || []).map((c: any) => c.name).sort()))
            .catch(() => { })
            .finally(() => setLoadingC(false));
    }, []);

    // ── State + City only populate AFTER a country is picked — unchanged cascade ──
    const handleCountryChange = (v: string) => {
        setCountry(v); setState(""); setCity(""); setStateOpts([]); setCityOpts([]);
        if (!v) return;
        setLoadingS(true);
        fetch("https://countriesnow.space/api/v0.1/countries/states", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ country: v }),
        }).then((r) => r.json())
            .then((d) => setStateOpts((d.data?.states || []).map((s: any) => s.name).sort()))
            .catch(() => { }).finally(() => setLoadingS(false));

        setLoadingCt(true);
        fetch("https://countriesnow.space/api/v0.1/countries/cities", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ country: v }),
        }).then((r) => r.json()).then((d) => setCityOpts((d.data || []).sort()))
            .catch(() => { }).finally(() => setLoadingCt(false));
    };

    const handleStateChange = (v: string) => {
        setState(v); setCity("");
        if (!v || !country) return;
        setLoadingCt(true);
        fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ country, state: v }),
        }).then((r) => r.json()).then((d) => setCityOpts((d.data || []).sort()))
            .catch(() => { }).finally(() => setLoadingCt(false));
    };

    const rangeEnabled = !!city || !!address;
    const canAdd = !!(country || state || city || zipcode.trim() || address.trim());

    const handleAdd = () => {
        if (!canAdd) return;
        onAdd({ country, state, city, address, zipcode: zipcode.trim(), range: range.trim() });
        setCountry(""); setState(""); setCity(""); setAddress(""); setZipcode(""); setRange("");
        setStateOpts([]); setCityOpts([]);
    };

    const fmt = (l: GeoLocation) =>
        [l.country, l.state, l.city, l.address, l.zipcode, l.range].filter(Boolean).join(" › ");

    // ── Commit a manually-typed value into the relevant options list + select it ──
    const commitNew = (
        val: string, opts: string[], setOpts: (o: string[]) => void,
        setValue: (v: string) => void, setAdding: (b: boolean) => void,
        setNew: (s: string) => void, extra?: () => void
    ) => {
        const trimmed = val.trim();
        if (trimmed && !opts.includes(trimmed)) setOpts([...opts, trimmed].sort());
        if (trimmed) setValue(trimmed);
        extra?.(); setNew(""); setAdding(false);
    };

    const dropdownFooter = (setAdding: (b: boolean) => void, menu: React.ReactNode) => (
        <>
            {menu}
            <Divider style={{ margin: "4px 0" }} />
            <div
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAdding(true)}
                style={{
                    padding: "8px 12px", cursor: "pointer", color: "var(--accent)", fontSize: 13,
                    display: "flex", alignItems: "center", gap: 6,
                }}
            >
                <PlusOutlined /> Add new
            </div>
        </>
    );

    return (
        <div style={{ borderRadius: 10, padding: 16, background: "var(--bg-page)", border: "1px solid var(--border)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{
                    width: 30, height: 30, borderRadius: 8, background: "var(--blue-bg)",
                    border: "1px solid var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                    <EnvironmentOutlined style={{ color: "var(--blue)", fontSize: 13 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>Location Targeting</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Country → State → City</div>
                </div>
                {locations.length > 0 && (
                    <span style={{
                        fontSize: 11, fontWeight: 700, color: "var(--green)", background: "var(--green-bg)",
                        border: "1px solid var(--green)", padding: "2px 10px", borderRadius: 20, whiteSpace: "nowrap",
                    }}>
                        {locations.length} location{locations.length > 1 ? "s" : ""} added
                    </span>
                )}
            </div>

            {/* Country / State / City */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                {/* Country */}
                <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <EnvironmentOutlined style={{ fontSize: 10, color: "var(--blue)" }} /> Country
                    </div>
                    {addingCountry ? (
                        <Input
                            autoFocus placeholder="Type and press Enter to save" value={newCountry}
                            suffix={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>↵ Enter</span>}
                            onChange={(e) => setNewCountry(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    commitNew(newCountry, countryOpts, setCountryOpts, setCountry, setAddingCountry, setNewCountry,
                                        () => { setState(""); setCity(""); setStateOpts([]); setCityOpts([]); });
                                }
                                if (e.key === "Escape") { setNewCountry(""); setAddingCountry(false); }
                            }}
                            onBlur={() => { setNewCountry(""); setAddingCountry(false); }}
                        />
                    ) : (
                        <Select showSearch allowClear placeholder={loadingC ? "Loading…" : "Select country…"} loading={loadingC}
                            style={{ width: "100%" }} value={country || undefined} onChange={(v) => handleCountryChange(v ?? "")}
                            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                            dropdownRender={(menu) => dropdownFooter(setAddingCountry, menu)}
                            options={countryOpts.map((c) => ({ value: c, label: c }))} />
                    )}
                </div>

                {/* State */}
                <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <EnvironmentOutlined style={{ fontSize: 10, color: "var(--blue)" }} /> State
                    </div>
                    {addingState ? (
                        <Input
                            autoFocus placeholder="Type and press Enter to save" value={newState}
                            suffix={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>↵ Enter</span>}
                            onChange={(e) => setNewState(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    commitNew(newState, stateOpts, setStateOpts, setState, setAddingState, setNewState,
                                        () => { setCity(""); setCityOpts([]); });
                                }
                                if (e.key === "Escape") { setNewState(""); setAddingState(false); }
                            }}
                            onBlur={() => { setNewState(""); setAddingState(false); }}
                        />
                    ) : (
                        <Select showSearch allowClear placeholder={loadingS ? "Loading…" : "Select state…"} loading={loadingS}
                            style={{ width: "100%" }} value={state || undefined} onChange={(v) => handleStateChange(v ?? "")}
                            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                            dropdownRender={(menu) => dropdownFooter(setAddingState, menu)}
                            options={stateOpts.map((s) => ({ value: s, label: s }))} />
                    )}
                </div>

                {/* City */}
                <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <EnvironmentOutlined style={{ fontSize: 10, color: "var(--blue)" }} /> City
                    </div>
                    {addingCity ? (
                        <Input
                            autoFocus placeholder="Type and press Enter to save" value={newCity}
                            suffix={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>↵ Enter</span>}
                            onChange={(e) => setNewCity(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") commitNew(newCity, cityOpts, setCityOpts, setCity, setAddingCity, setNewCity);
                                if (e.key === "Escape") { setNewCity(""); setAddingCity(false); }
                            }}
                            onBlur={() => { setNewCity(""); setAddingCity(false); }}
                        />
                    ) : (
                        <Select showSearch allowClear placeholder={loadingCt ? "Loading…" : "Select city…"} loading={loadingCt}
                            style={{ width: "100%" }} value={city || undefined} onChange={(v) => setCity(v ?? "")}
                            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                            dropdownRender={(menu) => dropdownFooter(setAddingCity, menu)}
                            options={cityOpts.map((c) => ({ value: c, label: c }))} />
                    )}
                </div>
            </div>

            {/* Address / Zip / Range / Add */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px auto", gap: 10, alignItems: "end", marginBottom: 10 }}>
                <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Address</div>
                    <Input placeholder="e.g. 123 Main St" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Zip Code</div>
                    <Input placeholder="e.g. 560001" value={zipcode} onChange={(e) => setZipcode(e.target.value)} />
                </div>
                <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: rangeEnabled ? "var(--text-secondary)" : "var(--text-muted)", marginBottom: 4 }}>
                        Range
                    </div>
                    <Input placeholder="e.g. 10 km" value={range} disabled={!rangeEnabled} onChange={(e) => setRange(e.target.value)} />
                </div>
                <Button type="primary" icon={<PlusOutlined />} disabled={!canAdd} onClick={handleAdd}>Add</Button>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11.5, color: "var(--text-muted)", marginBottom: 12 }}>
                <InfoCircleOutlined style={{ fontSize: 12, marginTop: 1 }} />
                <span>Select at least one field or enter a Zip Code. Range enables after city or address is entered.</span>
            </div>

            {locations.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {locations.map((l, i) => (
                        <span key={i} style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            fontSize: 12, padding: "4px 10px", borderRadius: 6,
                            background: "var(--accent-light)", border: "1px solid var(--border-strong)",
                            color: "var(--text-primary)",
                        }}>
                            <EnvironmentOutlined style={{ fontSize: 10 }} /> {fmt(l)}
                            <CloseOutlined style={{ fontSize: 10, cursor: "pointer" }} onClick={() => onRemove(i)} />
                        </span>
                    ))}
                </div>
            ) : (
                <div style={{
                    border: "1px dashed var(--border-strong)", borderRadius: 8, padding: "12px 14px",
                    textAlign: "center", fontSize: 12, color: "var(--text-muted)",
                }}>
                    No geo targets added yet.
                </div>
            )}
        </div>
    );
}
// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ number, icon, title, subtitle, right, children }: {
    number?: number; icon: string; title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <div className="db-card" style={{ padding: "22px 24px", marginBottom: 16, borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                {number ? (
                    <div style={{
                        width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0,
                    }}>{number}</div>
                ) : (
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="db-card-title" style={{ textTransform: "none", fontSize: 14, fontWeight: 700 }}>{title}</div>
                    {subtitle && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-muted)" }}>{subtitle}</p>}
                </div>
                {right}
            </div>
            {children}
        </div>
    );
}

// ── Summary sidebar row ────────────────────────────────────────────────────────
function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div style={{
            display: "flex", justifyContent: "space-between", gap: 12,
            padding: "8px 0", borderBottom: "1px solid var(--border)",
        }}>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{label}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>{value}</span>
        </div>
    );
}

// ── Line Item Card — targeting & settings now live inside each card ─────────
interface LineItemCardProps {
    item: LeadLineItem;
    index: number;
    total: number;
    canRemove: boolean;
    clientCurrencySymbol: string;
    creativesCount: number;
    ethnicityOptions: { id: number; label: string }[];
    onChange: (id: string, field: keyof LeadLineItem, value: any) => void;
    onRemove: (id: string) => void;
    onUploadCreatives: (item: LeadLineItem) => void;
}

function LineItemCard({
    item, index, canRemove, clientCurrencySymbol, creativesCount, ethnicityOptions,
    onChange, onRemove, onUploadCreatives,
}: LineItemCardProps) {
    const isImageFormat = IMAGE_FORMATS.includes(item.adFormat);
    const isVideoFormat = VIDEO_FORMATS.includes(item.adFormat);
    const showCTR = isImageFormat || isVideoFormat;
    const showViewability = isImageFormat || isVideoFormat;
    const showVCR = isVideoFormat;
    const currencySymbol = clientCurrencySymbol || "$";

    const handleAdFormatChange = (val: string) => {
        onChange(item.id, "adFormat", val ?? "");
        if (val && item.units) {
            onChange(item.id, "rate", String(item.units === "CPM" ? (CPM_RATES[val] ?? 1) : (CPC_RATES[val] ?? 1)));
        } else {
            onChange(item.id, "rate", "");
        }
        if (!val) {
            onChange(item.id, "ctr", "0.4");
            onChange(item.id, "viewability", "70");
            onChange(item.id, "vcr", "70");
        }
        if (!VIDEO_FORMATS.includes(val)) onChange(item.id, "vcr", "70");
    };

    const handleUnitsChange = (val: string) => {
        onChange(item.id, "units", val ?? "");
        if (val && item.adFormat) {
            onChange(item.id, "rate", String(val === "CPM" ? (CPM_RATES[item.adFormat] ?? 1) : (CPC_RATES[item.adFormat] ?? 1)));
        } else {
            onChange(item.id, "rate", "");
        }
    };

    const calculatedUnitCost = useMemo(() => {
        const impr = parseFloat(item.impressions);
        const r = parseFloat(item.rate) || (item.units === "CPM" ? (CPM_RATES[item.adFormat] ?? 1) : (CPC_RATES[item.adFormat] ?? 1));
        if (!impr || !item.units || !item.adFormat) return null;
        if (item.units === "CPM") {
            const budget = (impr * r) / 1000;
            return { budget, formula: `(${impr.toLocaleString("en-IN")} × ${r}) / 1000` };
        }
        const budget = impr * r;
        return { budget, formula: `${impr.toLocaleString("en-IN")} × ${r}` };
    }, [item.impressions, item.units, item.adFormat, item.rate]);

    const uploadDisabled = !isImageFormat && !isVideoFormat;

    return (
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-card)", padding: "20px 22px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                        width: 26, height: 26, borderRadius: "50%", background: "var(--accent)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>{index + 1}</div>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>
                        {item.lineItemName || `Line Item ${index + 1}`}
                    </span>
                    <span style={{
                        fontSize: 10.5, fontWeight: 700, color: "var(--green)",
                        background: "var(--green-bg)", border: "1px solid var(--green)",
                        padding: "1px 8px", borderRadius: 6,
                    }}>{item.id}</span>
                </div>
                {canRemove && (
                    <button onClick={() => onRemove(item.id)}
                        style={{
                            background: "none", border: "1px solid #fca5a5", borderRadius: 6, padding: "4px 10px",
                            cursor: "pointer", color: "#ef4444", fontSize: 12, display: "flex", alignItems: "center", gap: 4,
                        }}>
                        <DeleteOutlined style={{ fontSize: 12 }} /> Remove
                    </button>
                )}
            </div>

            <Form layout="vertical">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <Form.Item label="Line Item Name" required>
                        <Input value={item.lineItemName} onChange={(e) => onChange(item.id, "lineItemName", e.target.value)}
                            placeholder="e.g. Mumbai Display — 18-34" />
                    </Form.Item>
                    <Form.Item label="Ethnicity">
                        <Select value={item.ethnicity || undefined} onChange={(v) => onChange(item.id, "ethnicity", v || "")}
                            placeholder="Select ethnicity…"
                            options={ethnicityOptions.map((e) => ({ value: e.label, label: e.label }))} />
                    </Form.Item>
                    <Form.Item label="Start Date" required>
                        <DatePicker style={{ width: "100%" }} value={item.startDate ? dayjs(item.startDate) : null}
                            onChange={(_, ds) => onChange(item.id, "startDate", typeof ds === "string" ? ds : "")} />
                    </Form.Item>
                    <Form.Item label="End Date" required>
                        <DatePicker style={{ width: "100%" }} value={item.endDate ? dayjs(item.endDate) : null}
                            onChange={(_, ds) => onChange(item.id, "endDate", typeof ds === "string" ? ds : "")} />
                    </Form.Item>
                    <Form.Item label="Ad Format" required>
                        <Select value={item.adFormat || undefined} onChange={handleAdFormatChange} placeholder="Select format…"
                            options={AD_FORMAT_OPTIONS} />
                    </Form.Item>
                    <Form.Item label="Impressions">
                        <Input value={item.impressions}
                            onChange={(e) => onChange(item.id, "impressions", e.target.value.replace(/[^0-9]/g, ""))}
                            suffix={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>impr.</span>}
                            placeholder="e.g. 1000000" />
                    </Form.Item>
                    <Form.Item label="Units">
                        <Select value={item.units || undefined} onChange={handleUnitsChange} placeholder="Select unit…"
                            options={UNITS_OPTIONS.map((u) => ({ value: u, label: u }))} />
                    </Form.Item>
                    <Form.Item label={`Rate (${item.units || "—"})`}>
                        <Input value={item.rate} onChange={(e) => onChange(item.id, "rate", e.target.value.replace(/[^0-9.]/g, ""))}
                            placeholder={item.units === "CPM" ? "e.g. 1.25" : "e.g. 1.00"} />
                    </Form.Item>
                </div>

                <Form.Item label="Unit Cost (Budget)">
                    {calculatedUnitCost ? (
                        <div style={{
                            height: 38, padding: "0 12px", background: "var(--green-bg)",
                            border: "1.5px solid var(--green)", borderRadius: "var(--radius-sm)",
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                        }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--green)" }}>
                                {currencySymbol}{calculatedUnitCost.budget.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontStyle: "italic" }}>
                                = {calculatedUnitCost.formula}
                            </span>
                        </div>
                    ) : (
                        <div style={{
                            height: 38, padding: "0 12px", background: "var(--bg-input)",
                            border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-sm)",
                            display: "flex", alignItems: "center", color: "var(--text-muted)", fontSize: 12.5, gap: 6,
                        }}>
                            <InfoCircleOutlined style={{ fontSize: 11 }} /> Enter impressions, ad format &amp; unit to calculate
                        </div>
                    )}
                </Form.Item>

                <Form.Item label="Creatives">
                    {uploadDisabled ? (
                        <div style={{
                            border: "1px dashed var(--border-strong)", borderRadius: 8, padding: "12px 16px",
                            background: "var(--bg-input)", display: "flex", alignItems: "center", gap: 10,
                        }}>
                            <PlusOutlined style={{ fontSize: 15, color: "var(--text-muted)" }} />
                            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Select an Ad Format above to enable creative upload</span>
                        </div>
                    ) : (
                        <button type="button" onClick={() => onUploadCreatives(item)}
                            style={{
                                display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px",
                                border: "1px solid var(--border-strong)", borderRadius: 6, background: "var(--accent-light)",
                                color: "var(--accent)", fontWeight: 600, fontSize: 13, cursor: "pointer",
                            }}>
                            {isImageFormat ? <FileImageOutlined /> : <VideoCameraOutlined />}
                            {isImageFormat ? "Upload Image Creatives" : "Upload Video Creatives"}
                            {creativesCount > 0 && (
                                <span style={{ marginLeft: 4, background: "var(--green)", color: "#fff", borderRadius: 10, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>
                                    {creativesCount} added
                                </span>
                            )}
                        </button>
                    )}
                </Form.Item>

                {(showCTR || showVCR) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                            {showCTR && (
                                <Form.Item label="CTR" style={{ marginBottom: 0 }}>
                                    <Input value={item.ctr}
                                        onChange={(e) => onChange(item.id, "ctr", e.target.value.replace(/[^0-9.]/g, ""))}
                                        placeholder="e.g. 0.4"
                                        suffix={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>%</span>} />
                                </Form.Item>
                            )}
                            {showViewability && (
                                <Form.Item label="Viewability" style={{ marginBottom: 0 }}>
                                    <Input value={item.viewability}
                                        onChange={(e) => onChange(item.id, "viewability", e.target.value.replace(/[^0-9.]/g, ""))}
                                        placeholder="e.g. 70"
                                        suffix={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>%</span>} />
                                </Form.Item>
                            )}
                            {showVCR && (
                                <Form.Item label="VCR" style={{ marginBottom: 0 }}>
                                    <Input value={item.vcr}
                                        onChange={(e) => onChange(item.id, "vcr", e.target.value.replace(/[^0-9.]/g, ""))}
                                        placeholder="e.g. 60"
                                        suffix={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>%</span>} />
                                </Form.Item>
                            )}
                        </div>
                        {((showCTR && item.ctr !== "0.4") || (showViewability && item.viewability !== "70") || (showVCR && item.vcr !== "70")) && (
                            <div style={{ background: "var(--amber-bg)", border: "1px dashed var(--amber)", borderRadius: 8, padding: "12px 14px" }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--amber)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                    <InfoCircleOutlined style={{ fontSize: 12 }} /> You've changed one or more default values — add a note if needed
                                </div>
                                <TextArea placeholder="e.g. CTR adjusted based on client brief…" value={item.ctrNotes}
                                    onChange={(e) => onChange(item.id, "ctrNotes", e.target.value)} rows={2} style={{ fontSize: 12.5 }} />
                            </div>
                        )}
                    </div>
                )}

                {/* ── Targeting & Settings — embedded per line item ── */}
                <Divider style={{ margin: "16px 0" }} />
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)", marginBottom: 12 }}>🎯 Targeting &amp; Settings</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <Form.Item label="Age">
                        <Select mode="multiple" value={item.age} onChange={(vals: string[]) => onChange(item.id, "age", vals)}
                            optionRender={(option) => (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input type="checkbox" readOnly checked={item.age.includes(option.value as string)}
                                        style={{ accentColor: '#4f46e5', width: 14, height: 14, cursor: 'pointer' }} />
                                    <span>{option.label}</span>
                                </div>
                            )}
                            placeholder="Select Age" maxTagCount="responsive"
                            options={[
                                { value: "18 to 24", label: "18 to 24" },
                                { value: "25 to 34", label: "25 to 34" },
                                { value: "35 to 44", label: "35 to 44" },
                                { value: "45 to 54", label: "45 to 54" },
                                { value: "55 to 64", label: "55 to 64" },
                                { value: "Others", label: "Others" },
                            ]} />
                    </Form.Item>
                    <Form.Item label="Gender">
                        <Select mode="multiple" value={item.gender} onChange={(vals: string[]) => onChange(item.id, "gender", vals)}
                            placeholder="Select Gender" maxTagCount="responsive"
                            optionRender={(option) => (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input type="checkbox" readOnly checked={item.gender.includes(option.value as string)}
                                        style={{ accentColor: '#4f46e5', width: 14, height: 14, cursor: 'pointer' }} />
                                    <span>{option.label}</span>
                                </div>
                            )}
                            options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
                    </Form.Item>
                </div>
                {/* Geo Targeting — uses item.geoLocations, NOT campaign-level state */}
                <Form.Item label="Geo Targeting" style={{ marginBottom: 0 }}>
                    <GeoTargeting
                        locations={item.geoLocations}
                        onAdd={(loc) => onChange(item.id, "geoLocations", [...item.geoLocations, loc])}
                        onRemove={(idx) => onChange(item.id, "geoLocations", item.geoLocations.filter((_, i) => i !== idx))}
                    />
                </Form.Item>
            </Form>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Campaign_Create_Leads() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const ticketId = searchParams.get("ticketId") || "";
    const clientIdParam = searchParams.get("clientId") || "";

    const locationState = location.state as any;
    const isBackNav = consumeNavFlag();
    const isReturnFromCreative = !!locationState?.fromCreativeUpload;
    const shouldRestoreDraft = isBackNav || isReturnFromCreative;
    if (!shouldRestoreDraft) clearDraft();
    const restoredData = shouldRestoreDraft ? loadDraft() : null;

    const [clientName, setClientName] = useState("");
    const [clientCurrencySymbol, setClientCurrencySymbol] = useState("");
    const [loadingClient, setLoadingClient] = useState(!!clientIdParam);

    const [submitting, setSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    // ── Campaign-level fields ──
    const [clientCampaignId, setClientCampaignId] = useState<string>(restoredData?.clientCampaignId ?? "");
    const [purchaseOrderId, setPurchaseOrderId] = useState<string>(restoredData?.purchaseOrderId ?? "");
    const [campaignName, setCampaignName] = useState<string>(restoredData?.campaignName ?? "");
    const [campaignType, setCampaignType] = useState<string>(restoredData?.campaignType ?? "");
    const [startDate, setStartDate] = useState<string>(restoredData?.startDate ?? "");
    const [endDate, setEndDate] = useState<string>(restoredData?.endDate ?? "");
    const [buyingType, setBuyingType] = useState<string[]>(restoredData?.buyingType ?? []);
    const [objective, setObjective] = useState<string>(restoredData?.objective ?? "");
    const [notes, setNotes] = useState<string>(restoredData?.notes ?? "");

    const clientPrefix = "LEAD";

    // ── FIX: start at offset 1 as a safe fallback, but immediately resolve the
    // real next-available offset from the backend below (unless restoring a draft).
    const [lineItemOffset, setLineItemOffset] = useState<number>(restoredData?.lineItemOffset ?? 1);
    const [lineItems, setLineItems] = useState<LeadLineItem[]>(
        restoredData?.lineItems?.length ? restoredData.lineItems : [emptyLineItem(1, 1, clientPrefix)]
    );
    const [lineItemCreatives, setLineItemCreatives] = useState<LineItemCreativesMap>(() => {
        if (isReturnFromCreative && locationState?.allLineItemCreatives) {
            return locationState.allLineItemCreatives as LineItemCreativesMap;
        }
        return restoredData?.lineItemCreativesKeys ? {} : {};
    });

    const isMounted = useRef(false);

    const [ethnicity, setEthnicity] = useState<{ id: number; label: string }[]>([]);
    const [_loadingEthnicity, setLoadingEthnicty] = useState(false);

    useEffect(() => {
        setLoadingEthnicty(true);
        fetch(`${BASE_URL}/categories/get_all_ethnicities/`)
            .then((r) => r.json())
            .then((data) => {
                const list = Array.isArray(data) ? data : data.results || [];
                setEthnicity(
                    list.map((a: any) => ({
                        id: a.id,
                        label: `${a.title}`,
                    }))
                );
            })
            .catch(() => console.warn("Failed to load ethnicity"))
            .finally(() => setLoadingEthnicty(false));
    }, []);

    // ── FIX: on a fresh visit (not restoring a draft), fetch the real last-used
    // line item offset for this prefix and seed both the offset and the first
    // line item with it. Without this, every fresh session started at LEAD001,
    // which collides with LineItem.line_item_id's unique=True on the backend
    // as soon as more than one campaign has been created historically.
    useEffect(() => {
        if (!shouldRestoreDraft) {
            fetchLastLineItemOffset(clientPrefix).then((offset) => {
                setLineItemOffset(offset);
                setLineItems([emptyLineItem(1, offset, clientPrefix)]);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Load client name + currency, then seed line item IDs with the right prefix ──
    useEffect(() => {
        if (!clientIdParam) { setLoadingClient(false); return; }
        fetch(`${BASE_URL}/get_client/${clientIdParam}/`, {
            headers: { Accept: "application/json", "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => r.json())
            .then((data) => {
                setClientName(data.name || "");
                const currencyCode = data.billing?.billing_currency || data.billing_currency || "INR";
                setClientCurrencySymbol(currencySymbolFor(currencyCode));
            })
            .catch(() => setClientName(""))
            .finally(() => setLoadingClient(false));
    }, [clientIdParam]);

    // ── Pick up creatives handed back from the upload pages ──
    useEffect(() => {
        if (locationState?.uploadedCreatives && locationState?.lineItemId) {
            const lid = locationState.lineItemId as string;
            const returnedAll = (locationState.allLineItemCreatives ?? {}) as LineItemCreativesMap;
            setLineItemCreatives(() => ({ ...returnedAll, [lid]: locationState.uploadedCreatives }));
            window.history.replaceState({}, "");
        }
    }, [locationState]);

    // ── Persist a lightweight draft across the creative-upload round trip ──
    useEffect(() => {
        if (!isMounted.current) { isMounted.current = true; return; }
        saveDraft({
            clientCampaignId, purchaseOrderId, campaignName, campaignType,
            startDate, endDate, buyingType, objective, notes, lineItemOffset,
            lineItems,
        });
    }, [clientCampaignId, purchaseOrderId, campaignName, campaignType, startDate, endDate,
        buyingType, objective, notes, lineItemOffset, lineItems]);

    // ── Line item handlers ──
    const handleLineItemChange = useCallback((id: string, field: keyof LeadLineItem, value: any) => {
        setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)));
    }, []);

    const handleAddLineItem = () => {
        setLineItems((prev) => [...prev, emptyLineItem(prev.length + 1, lineItemOffset, clientPrefix)]);
    };

    // ── FIX: no longer renumbers surviving line items' IDs on removal.
    // Renumbering broke the link between a line item's ID and its uploaded
    // creatives in lineItemCreatives (keyed by "<id>_image" / "<id>_video"),
    // silently losing or misattributing creatives on submit. IDs are now
    // stable for the life of the form; we also clean up the removed item's
    // creative entries so they don't linger in state.
    const handleRemoveLineItem = (id: string) => {
        setLineItems((prev) => prev.filter((li) => li.id !== id));
        setLineItemCreatives((prev) => {
            const next = { ...prev };
            delete next[id + "_image"];
            delete next[id + "_video"];
            return next;
        });
    };

    // ── Route to the right creative upload page based on ad format ──
    const handleUploadCreatives = (item: LeadLineItem) => {
        const isImage = IMAGE_FORMATS.includes(item.adFormat);
        const isVideo = VIDEO_FORMATS.includes(item.adFormat);
        if (!isImage && !isVideo) return;

        const lineItemId = item.id + (isImage ? "_image" : "_video");
        setNavFlag();
        navigate(isImage ? IMAGE_UPLOAD_ROUTE : VIDEO_UPLOAD_ROUTE, {
            state: {
                lineItemId,
                returnTo: location.pathname + location.search,
                existingCreatives: lineItemCreatives[lineItemId] || [],
                allLineItemCreatives: lineItemCreatives,
            },
        });
    };

    const durationDays = startDate && endDate ? dayjs(endDate).diff(dayjs(startDate), "day") : 0;

    // ── Live summary, derived only from what's already entered — no new inputs ──
    const campaignSummary = useMemo(() => {
        let totalBudget = 0;
        const formatSet = new Set<string>();
        const geoSet = new Set<string>();

        lineItems.forEach((li) => {
            const impr = parseFloat(li.impressions);
            const rate = parseFloat(li.rate) || (li.units === "CPM" ? (CPM_RATES[li.adFormat] ?? 1) : (CPC_RATES[li.adFormat] ?? 1));
            if (impr && li.units && li.adFormat) {
                totalBudget += li.units === "CPM" ? (impr * rate) / 1000 : impr * rate;
            }
            if (li.adFormat) {
                const label = AD_FORMAT_OPTIONS.find((f) => f.value === li.adFormat)?.label ?? li.adFormat;
                formatSet.add(label);
            }
            li.geoLocations.forEach((loc) => {
                const s = [loc.city, loc.state, loc.country].filter(Boolean)[0];
                if (s) geoSet.add(s);
            });
        });

        return {
            totalBudget,
            formats: Array.from(formatSet),
            geos: Array.from(geoSet),
        };
    }, [lineItems]);

    const handleSubmit = async () => {
        const incomplete = lineItems.filter((li) => !isLineItemComplete(li));
        if (incomplete.length > 0) {
            const names = incomplete.map((li, i) => li.lineItemName.trim() ? `"${li.lineItemName}"` : `Line Item ${i + 1}`).join(", ");
            message.error(`Please fill all required fields for: ${names}`);
            return;
        }
        if (!campaignName.trim() || !campaignType || !objective || !startDate || !endDate || buyingType.length === 0) {
            message.error("Please fill all required campaign details.");
            return;
        }

        setSubmitting(true);
        setSubmitStatus("idle");
        setErrorMsg("");

        const fd = new FormData();
        if (ticketId) fd.append("ticket_id", ticketId);
        fd.append("client", clientIdParam);
        fd.append("client_name", clientName);
        fd.append("campaign_name", campaignName);
        fd.append("campaign_type", campaignType);
        fd.append("buying_type", buyingType.join(", "));
        fd.append("objective", objective);
        fd.append("start_date", startDate);
        fd.append("end_date", endDate);
        if (clientCampaignId) fd.append("client_campaign_ID", clientCampaignId);
        if (purchaseOrderId) fd.append("purchase_order_ID", purchaseOrderId);
        if (notes) fd.append("notes", notes);

        fd.append("line_items", JSON.stringify(
            lineItems.map((li) => {
                const imageCreatives = lineItemCreatives[li.id + "_image"] || [];
                const videoCreatives = lineItemCreatives[li.id + "_video"] || [];
                const allCreatives = [...imageCreatives, ...videoCreatives];

                const impressions = parseFloat(li.impressions);
                const unit = li.units;
                let unitCostBudget: number | string = "";
                if (impressions && unit && li.adFormat) {
                    const rate = parseFloat(li.rate) || (unit === "CPM" ? (CPM_RATES[li.adFormat] ?? 1) : (CPC_RATES[li.adFormat] ?? 1));
                    unitCostBudget = unit === "CPM" ? (impressions * rate) / 1000 : impressions * rate;
                }

                const adFormatLabel = AD_FORMAT_OPTIONS.find((f) => f.value === li.adFormat)?.label ?? li.adFormat;

                return {
                    line_item_id: li.id,
                    line_item_name: li.lineItemName,
                    ethnicity: li.ethnicity,
                    start_date: li.startDate,
                    end_date: li.endDate,
                    ad_format: adFormatLabel,
                    impressions: li.impressions,
                    units: li.units,
                    unit_value: li.rate || "",
                    unit_cost: unitCostBudget !== "" ? `${clientCurrencySymbol}${unitCostBudget}` : "",
                    age: li.age.join(", "),
                    gender: li.gender.join(", "),
                    ctr: li.ctr,
                    viewability: li.viewability,
                    vcr: li.vcr,
                    ctr_notes: li.ctrNotes,
                    geo_targeting: JSON.stringify(li.geoLocations.map((loc) => ({
                        country: loc.country || "", state: loc.state || "", address: loc.address || "",
                        city: loc.city || "", zipcode: loc.zipcode || "", range: loc.range || "",
                    }))),
                    creatives: allCreatives.filter((c) => c.type !== "third_party").map((c) => ({
                        creative_name: c.creative_name,
                        dimensions: c.dimensions,
                        aspect_ratio: c.aspect_ratio,
                        file_size: c.file_size,
                        click_through_url: c.click_through_url || "",
                        appended_html_tag: c.appended_html_tag || "",
                        integration_code: c.integration_code || "",
                        notes: c.notes || "",
                    })),
                    third_party_creatives: allCreatives.filter((c) => c.type === "third_party").map((c) => ({
                        input_file_name: c.main_asset?.name ?? "",
                        backup_image_name: c.backup_image?.name ?? "",
                    })),
                };
            })
        ));

        lineItems.forEach((li, i) => {
            const imageCreatives = lineItemCreatives[li.id + "_image"] || [];
            const videoCreatives = lineItemCreatives[li.id + "_video"] || [];
            const allCreatives = [...imageCreatives, ...videoCreatives];
            let standardIndex = 0;
            let tpIndex = 0;
            allCreatives.forEach((c) => {
                if (c.type === "third_party") {
                    if (c.main_asset) fd.append(`line_item_${i}thirdparty_file${tpIndex}`, c.main_asset, c.main_asset.name);
                    if (c.backup_image) fd.append(`line_item_${i}thirdparty_backup${tpIndex}`, c.backup_image, c.backup_image.name);
                    tpIndex++;
                } else {
                    if (c.main_asset) fd.append(`line_item_${i}main_asset${standardIndex}`, c.main_asset, c.main_asset.name);
                    standardIndex++;
                }
            });
        });

        try {
            const res = await fetch(`${BASE_URL}/campaigns/create_campaign/`, {
                method: "POST", body: fd, headers: { "ngrok-skip-browser-warning": "1" },
            });
            if (res.ok) {
                clearDraft();
                setSubmitStatus("success");
                message.success("Campaign created successfully!");
            } else {
                const text = await res.text();
                setSubmitStatus("error");
                setErrorMsg(text || `Server error: ${res.status}`);
            }
        } catch (err: unknown) {
            setSubmitStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Network error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            {/* ── Page Header ── */}
            <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 8,
            }}>
                <div>
                    <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                        Create Campaign
                    </h1>
                    <p style={{
                        fontSize: 9, color: "var(--text-muted)", margin: "4px 0 0",
                        fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>                        Follow the sections below to create a new campaign
                    </p>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-primary)", margin: 0, letterSpacing: "0.04em" }}>
                    {ticketId ? `TICKET ID - ${ticketId}` : "NEW CAMPAIGN"}
                    {clientName ? ` — ${clientName}` : loadingClient ? " — Loading client…" : ""}
                </p>
            </div>

            {submitStatus === "success" && (
                <div style={{
                    marginBottom: 16, padding: "12px 16px", background: "var(--green-bg)",
                    border: "1px solid var(--green)", borderRadius: "var(--radius-sm)",
                    color: "var(--green)", fontSize: 13, fontWeight: 500,
                    display: "flex", alignItems: "center", gap: 8,
                }}>
                    <CheckOutlined /> Campaign created successfully! You can close this tab now.
                </div>
            )}
            {submitStatus === "error" && (
                <div style={{
                    marginBottom: 16, padding: "12px 16px", background: "var(--red-bg)",
                    border: "1px solid var(--red)", borderRadius: "var(--radius-sm)",
                    color: "var(--red)", fontSize: 13, fontWeight: 500,
                }}>
                    ❌ Submission failed: {errorMsg}
                </div>
            )}

            {/* ── Body: form (left) + live summary (right) ── */}
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Section number={1} icon="📋" title="Campaign Details" subtitle="Provide basic information about this campaign">
                        <Form layout="vertical">
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                                <Form.Item label="Client Campaign ID">
                                    <Input value={clientCampaignId} onChange={(e) => setClientCampaignId(e.target.value)}
                                        placeholder="Enter Client Campaign ID" />
                                </Form.Item>
                                <Form.Item label="Purchase Order ID">
                                    <Input value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)}
                                        placeholder="Enter Purchase Order ID" />
                                </Form.Item>
                                <Form.Item label="Campaign Name" required>
                                    <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
                                        placeholder="e.g. Summer Awareness 2026" />
                                </Form.Item>
                                <Form.Item label="Campaign Type" required>
                                    <Select value={campaignType || undefined} onChange={setCampaignType} placeholder="Select type…"
                                        options={toOpts(["Brand Awareness", "Performance", "Retargeting", "Prospecting", "Lead Generation"])} />
                                </Form.Item>
                                <Form.Item label="Campaign Start Date" required>
                                    <DatePicker style={{ width: "100%" }} value={startDate ? dayjs(startDate) : null}
                                        onChange={(_, ds) => setStartDate(typeof ds === "string" ? ds : "")} />
                                </Form.Item>
                                <Form.Item label="Campaign End Date" required>
                                    <DatePicker style={{ width: "100%" }} value={endDate ? dayjs(endDate) : null}
                                        onChange={(_, ds) => setEndDate(typeof ds === "string" ? ds : "")} />
                                </Form.Item>
                                <Form.Item label="Buying Type" required>
                                    <Select mode="multiple" value={buyingType} onChange={(vals: string[]) => setBuyingType(vals)}
                                        placeholder="Select buying type…" style={{ width: '100%' }} maxTagCount="responsive" menuItemSelectedIcon={null}
                                        optionRender={(option) => (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <input type="checkbox" readOnly checked={buyingType.includes(option.value as string)}
                                                    style={{ accentColor: '#4f46e5', width: 14, height: 14, cursor: 'pointer' }} />
                                                <span>{option.label}</span>
                                            </div>
                                        )}
                                        options={[
                                            { value: 'Programmatic (DV360)', label: 'Programmatic (DV360)' },
                                            { value: 'Direct', label: 'Direct' },
                                            { value: 'Programmatic Guaranteed', label: 'Programmatic Guaranteed' },
                                            { value: 'Preferred Deal', label: 'Preferred Deal' },
                                            { value: 'Open Auction', label: 'Open Auction' },
                                        ]} />
                                </Form.Item>

                                <Form.Item label="Campaign Objective" required>
                                    <Select value={objective || undefined} onChange={setObjective} placeholder="Select objective…"
                                        options={toOpts(["Increase Brand Awareness", "Drive Website Traffic", "Generate Leads", "Boost Sales", "App Installs"])} />
                                </Form.Item>
                            </div>
                            <Form.Item label="Notes" style={{ marginBottom: 0 }}>
                                <TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add any notes for internal reference" />
                            </Form.Item>
                        </Form>
                    </Section>

                    <Section
                        number={2}
                        icon="🧾"
                        title={`Line Item Details (${lineItems.length})`}
                        subtitle="Each line item carries its own creatives, targeting and settings"
                    >
                        {lineItems.map((item, idx) => (
                            <LineItemCard
                                key={item.id}
                                item={item}
                                index={idx}
                                total={lineItems.length}
                                canRemove={lineItems.length > 1}
                                clientCurrencySymbol={clientCurrencySymbol}
                                creativesCount={
                                    (lineItemCreatives[item.id + "_image"]?.length || 0) +
                                    (lineItemCreatives[item.id + "_video"]?.length || 0)
                                }
                                ethnicityOptions={ethnicity}
                                onChange={handleLineItemChange}
                                onRemove={handleRemoveLineItem}
                                onUploadCreatives={handleUploadCreatives}
                            />
                        ))}
                        <button onClick={handleAddLineItem}
                            style={{
                                width: "100%", padding: "12px", border: "1px dashed var(--accent)", borderRadius: 8,
                                background: "none", cursor: "pointer", color: "var(--accent)", fontWeight: 600, fontSize: 13,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            }}>
                            <PlusOutlined /> Add Another Line Item
                        </button>
                    </Section>
                </div>

                {/* ── Live summary sidebar — mirrors values already entered above, sticky like a review panel ── */}
                <div style={{ width: 300, flexShrink: 0, position: "sticky", top: 16 }}>
                    <div className="db-card" style={{ padding: "20px 22px", borderRadius: 14, marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                            Summary
                        </div>
                        <SummaryRow label="Client" value={clientName || "—"} />
                        <SummaryRow label="Campaign Name" value={campaignName || "—"} />
                        <SummaryRow label="Type" value={campaignType || "—"} />
                        <SummaryRow label="Objective" value={objective || "—"} />
                        <SummaryRow label="Buying Type" value={buyingType.length ? buyingType.join(", ") : "—"} />
                        <SummaryRow label="Ad Formats" value={campaignSummary.formats.length ? campaignSummary.formats.join(", ") : "—"} />
                        <SummaryRow label="Geo" value={campaignSummary.geos.length ? campaignSummary.geos.join(", ") : "—"} />
                        <SummaryRow label="Line Items" value={lineItems.length} />
                        <SummaryRow
                            label="Duration"
                            value={startDate && endDate ? `${startDate} to ${endDate} (${durationDays} Days)` : "—"}
                        />
                        <div style={{ paddingTop: 10 }}>
                            <SummaryRow
                                label="Budget (Calculated)"
                                value={`${clientCurrencySymbol || "$"}${campaignSummary.totalBudget.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            />
                        </div>
                    </div>

                    <div style={{
                        display: "flex", background: "var(--amber-bg)", border: "1px dashed var(--amber)",
                        borderRadius: 10, padding: "10px 12px", gap: 8, marginBottom: 16, fontSize: 11.5, color: "var(--amber)",
                    }}>
                        <InfoCircleOutlined style={{ fontSize: 12, marginTop: 1 }} />
                        <span>Once created, you can edit line items, creatives and start the campaign.</span>
                    </div>

                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={submitting}
                        onClick={handleSubmit}
                        block
                        style={{ height: 42, fontWeight: 700 }}
                    >
                        {submitting ? "Creating…" : "Create Campaign"}
                    </Button>
                </div>
            </div>
        </div>
    );
}