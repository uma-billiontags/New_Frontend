import { useEffect, useState, useCallback } from "react";
import { Table, Button, Input, message, Spin } from "antd";
import {
    SearchOutlined,
    ReloadOutlined,
    EyeOutlined,
    DownloadOutlined,
    CloudUploadOutlined,
    SaveOutlined,
    CloseOutlined,
    FileExcelOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import * as XLSX from "xlsx";

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReportRow {
    ticket_id: string;          // e.g. "TIK0022" or "TIK0022-A"
    ticket_id_raw: string;      // e.g. "TIK0022" (no suffix, used for API calls)
    report_type: "cpm" | "cpc";
    campaign_name: string;
    client_name: string;
    client_id: string;
    start_date: string;
    end_date: string;
    line_items_count: number;
    excel_generated: boolean;
    excel_url: string | null;
    generated_at: string | null;
    publish_status: "published" | null;
    has_edits: boolean;        // ← ADD
    needs_republish: boolean;  // ← ADD
}

interface InternalEdits {
    impressions: string;
    start_date: string;
    end_date: string;
    advertiser_id: string;
    target_cpm: string;
    target_ctr: string;
    target_cpc: string;
    booked_budget: string;
    sitelist: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(v?: string) {
    if (!v) return "—";
    return new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
    return (
        <div className="db-stat-card" style={{ border: "2px solid transparent" }}>
            <div className="db-stat-label">{label}</div>
            <div className="db-stat-value" style={color ? { color } : undefined}>{value}</div>
        </div>
    );
}

// ── Preview Modal — reads the actual generated .xlsx (client tab, read-only) ──
// and CampaignLineItemExcelDetails (internal tab, editable) ────────────────────
interface PreviewModalProps {
    open: boolean;
    sheetNames: string[];
    activeSheet: string;
    onSheetChange: (name: string) => void;
    ticketId: string;
    reportType: "cpm" | "cpc";
    saving: boolean;
    onClose: () => void;
    clientData: any[][];
    internalEdits: InternalEdits;
    onInternalChange: (field: keyof InternalEdits, value: string) => void;
    onSave: () => void;
}

function PreviewModal({
    open, sheetNames, activeSheet, onSheetChange,
    ticketId, reportType, saving, onClose,
    clientData, internalEdits, onInternalChange, onSave,
}: PreviewModalProps) {
    const [activeTab, setActiveTab] = useState<"client" | "internal">("client");

    if (!open) return null;

    const isCpc = reportType === "cpc";
    const isCpm = reportType === "cpm";

    const getInternalFields = () => {
        if (isCpc) {
            return [
                { label: "Advertiser ID", field: "advertiser_id" as keyof InternalEdits, placeholder: "e.g. CL00001" },
                { label: "Clicks Booked", field: "impressions" as keyof InternalEdits, placeholder: "e.g. 50000" },
                { label: "Start Date", field: "start_date" as keyof InternalEdits, placeholder: "YYYY-MM-DD" },
                { label: "End Date", field: "end_date" as keyof InternalEdits, placeholder: "YYYY-MM-DD" },
                { label: "Target CPC", field: "target_cpc" as keyof InternalEdits, placeholder: "e.g. 1 INR" },
                { label: "Booked Budget", field: "booked_budget" as keyof InternalEdits, placeholder: "e.g. 5000" },
                { label: "Sitelist", field: "sitelist" as keyof InternalEdits, placeholder: "Site list…" },
            ];
        }
        return [
            { label: "Advertiser ID", field: "advertiser_id" as keyof InternalEdits, placeholder: "e.g. CL00001" },
            { label: "Impressions Booked", field: "impressions" as keyof InternalEdits, placeholder: "e.g. 500000" },
            { label: "Start Date", field: "start_date" as keyof InternalEdits, placeholder: "YYYY-MM-DD" },
            { label: "End Date", field: "end_date" as keyof InternalEdits, placeholder: "YYYY-MM-DD" },
            { label: "Target CPM", field: "target_cpm" as keyof InternalEdits, placeholder: "e.g. 10 INR" },
            { label: "Target CTR", field: "target_ctr" as keyof InternalEdits, placeholder: "e.g. 0.30%" },
            { label: "Sitelist", field: "sitelist" as keyof InternalEdits, placeholder: "Site list…" },
        ];
    };

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
            zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
            <div style={{
                background: "var(--bg-card)", borderRadius: 16, width: "80vw", maxWidth: 960,
                maxHeight: "90vh", display: "flex", flexDirection: "column",
                boxShadow: "var(--shadow)", border: "1px solid var(--border)",
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: "18px 24px", borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 9, background: "var(--accent-light)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <FileExcelOutlined style={{ color: "var(--accent)", fontSize: 17 }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                                Campaign Excel Preview
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                                <span style={{ fontWeight: 700, color: isCpm ? "var(--accent)" : "var(--accent-3)" }}>
                                    {ticketId}{!isCpm ? "-A" : ""}
                                </span>
                                &nbsp;·&nbsp;
                                <span style={{
                                    fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
                                    textTransform: "uppercase",
                                    background: isCpm ? "var(--accent-light)" : "rgba(67,188,205,0.12)",
                                    color: isCpm ? "var(--accent)" : "var(--accent-3)",
                                    border: `1px solid ${isCpm ? "var(--accent)" : "var(--accent-3)"}`,
                                }}>
                                    {isCpm ? "CPM — Impressions" : "CPC — Clicks"}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--text-muted)", display: "flex", alignItems: "center", padding: 4, borderRadius: 6,
                    }}>
                        <CloseOutlined style={{ fontSize: 16 }} />
                    </button>
                </div>

                {/* Two main tabs: Client vs Internal */}
                <div style={{
                    display: "flex", gap: 0, borderBottom: "1px solid var(--border)",
                    padding: "0 24px", background: "var(--bg-input)", flexShrink: 0,
                }}>
                    {[
                        { key: "client", label: "👤 Client Campaign Details", desc: "Read-only" },
                        { key: "internal", label: "🛠 Internal Team", desc: "Editable" },
                    ].map((tab) => {
                        const isActive = activeTab === tab.key;
                        const isInternal = tab.key === "internal";
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as "client" | "internal")}
                                style={{
                                    padding: "12px 20px", fontSize: 13,
                                    fontWeight: isActive ? 700 : 500,
                                    color: isActive ? (isInternal ? "var(--green)" : "var(--accent)") : "var(--text-muted)",
                                    background: "none", border: "none",
                                    borderBottom: isActive ? `2px solid ${isInternal ? "var(--green)" : "var(--accent)"}` : "2px solid transparent",
                                    cursor: "pointer", marginBottom: -1, transition: "all 0.15s",
                                    display: "flex", alignItems: "center", gap: 6,
                                }}
                            >
                                {tab.label}
                                <span style={{
                                    fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                                    background: isInternal ? "var(--green-bg)" : "var(--accent-light)",
                                    color: isInternal ? "var(--green)" : "var(--accent)",
                                    border: `1px solid ${isInternal ? "var(--green)" : "var(--accent)"}`,
                                    textTransform: "uppercase",
                                }}>
                                    {tab.desc}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Sheet Tabs — only shown for client tab */}
                {/* {activeTab === "client" && ( */}
                {sheetNames.length > 0 && (
                    <div style={{
                        display: "flex", gap: 0, borderBottom: "1px solid var(--border)",
                        padding: "0 24px", background: "var(--bg-card-hover)", flexShrink: 0, overflowX: "auto",
                    }}>
                        {sheetNames.map((name) => (
                            <button
                                key={name}
                                onClick={() => onSheetChange(name)}
                                style={{
                                    padding: "8px 16px", fontSize: 11,
                                    fontWeight: activeSheet === name ? 700 : 500,
                                    color: activeSheet === name ? "var(--accent)" : "var(--text-muted)",
                                    background: "none", border: "none",
                                    borderBottom: activeSheet === name ? "2px solid var(--accent)" : "2px solid transparent",
                                    cursor: "pointer", marginBottom: -1, transition: "all 0.15s", whiteSpace: "nowrap",
                                }}
                            >
                                📄 {name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Body */}
                <div style={{ overflowY: "auto", flex: 1, padding: "16px 24px" }}>

                    {/* ── CLIENT TAB ── */}
                    {activeTab === "client" && (
                        <>
                            <div style={{
                                marginBottom: 12, padding: "8px 12px",
                                background: "var(--accent-light)", borderRadius: 8,
                                border: "1px solid var(--accent)",
                                fontSize: 12, color: "var(--accent)", fontWeight: 500,
                                display: "flex", alignItems: "center", gap: 6,
                            }}>
                                🔒 This is the original data submitted by the client. It is read-only and cannot be modified.
                            </div>
                            <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                                <colgroup>
                                    <col style={{ width: "35%" }} />
                                    <col style={{ width: "65%" }} />
                                </colgroup>
                                <tbody>
                                    {clientData.map((row, rIdx) => (
                                        <tr key={rIdx}>
                                            {rIdx === 0 ? (
                                                <td colSpan={2} style={{
                                                    background: "var(--accent)", padding: "8px 12px",
                                                    border: "1px solid var(--accent)",
                                                    color: "#fff", fontWeight: 700, fontSize: 13,
                                                }}>
                                                    {row[0] ?? ""}
                                                </td>
                                            ) : (
                                                row.map((cell: any, cIdx: number) => (
                                                    <td key={cIdx} style={{
                                                        border: "1px solid var(--border)",
                                                        padding: "6px 10px",
                                                        background: cIdx === 0
                                                            ? "var(--accent-light)"
                                                            : (rIdx % 2 === 0 ? "var(--bg-input)" : "var(--bg-card)"),
                                                        fontSize: 12,
                                                        fontWeight: cIdx === 0 ? 600 : 400,
                                                        color: cIdx === 0 ? "var(--text-primary)" : "var(--text-muted)",
                                                    }}>
                                                        {cell ?? ""}
                                                    </td>
                                                ))
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* ── INTERNAL TAB ── */}
                    {activeTab === "internal" && (
                        <>
                            <div style={{
                                marginBottom: 16, padding: "8px 12px",
                                background: "var(--green-bg)", borderRadius: 8,
                                border: "1px solid var(--green)",
                                fontSize: 12, color: "var(--green)", fontWeight: 500,
                                display: "flex", alignItems: "center", gap: 6,
                            }}>
                                ✏️ These fields are for internal use only. The client's original data is never modified.
                            </div>

                            <div style={{
                                marginBottom: 14, padding: "6px 12px",
                                background: "var(--accent-light)", borderRadius: 8,
                                border: "1px solid var(--accent)",
                                fontSize: 11, color: "var(--accent)", fontWeight: 600,
                                display: "flex", alignItems: "center", gap: 6,
                            }}>
                                📋 Currently editing: <span style={{ fontWeight: 700 }}>{activeSheet}</span>
                                &nbsp;— Switch line item using the sheet tabs in Client Campaign Details tab
                            </div>

                            <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                                <colgroup>
                                    <col style={{ width: "35%" }} />
                                    <col style={{ width: "65%" }} />
                                </colgroup>
                                <tbody>
                                    {getInternalFields().map(({ label, field, placeholder }) => (
                                        <tr key={field}>
                                            <td style={{
                                                border: "1px solid var(--border)",
                                                padding: "8px 12px",
                                                background: "var(--accent-light)",
                                                fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
                                            }}>
                                                {label}
                                            </td>
                                            <td style={{
                                                border: "1px solid var(--border)",
                                                padding: "4px 8px",
                                                background: "var(--bg-card)",
                                            }}>
                                                <input
                                                    value={internalEdits[field] ?? ""}
                                                    onChange={(e) => onInternalChange(field, e.target.value)}
                                                    placeholder={placeholder}
                                                    style={{
                                                        width: "100%", border: "none", outline: "none",
                                                        fontSize: 12, color: "var(--text-primary)", background: "transparent",
                                                        padding: "4px 0",
                                                    }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: "14px 24px", borderTop: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexShrink: 0, background: "var(--bg-input)", borderRadius: "0 0 16px 16px",
                }}>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        {activeTab === "client"
                            ? "🔒 Client data is read-only"
                            : "💾 Saves to CampaignLineItemExcelDetails only — original data preserved"}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <Button onClick={onClose} style={{ height: 36, borderRadius: 8, fontWeight: 600, fontSize: 13 }}>
                            Cancel
                        </Button>
                        {activeTab === "internal" && (
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                loading={saving}
                                onClick={onSave}
                                style={{
                                    height: 36, borderRadius: 8, fontWeight: 600,
                                    fontSize: 13, background: "var(--green)", borderColor: "var(--green)",
                                }}
                            >
                                {saving ? "Saving…" : "Save to DB"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Campaign_Reports() {
    const [rows, setRows] = useState<ReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [generatingKey, setGeneratingKey] = useState<string | null>(null);
    const [publishingKey, setPublishingKey] = useState<string | null>(null);

    // ── Preview modal state (xlsx-driven, tabbed) ──
    const [showPreview, setShowPreview] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [allSheetsData, setAllSheetsData] = useState<Record<string, any[][]>>({});
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [activeSheet, setActiveSheet] = useState<string>("");
    const [previewTicketId, setPreviewTicketId] = useState("");
    const [previewReportType, setPreviewReportType] = useState<"cpm" | "cpc">("cpm");
    const [internalEdits, setInternalEdits] = useState<InternalEdits>({
        impressions: "", start_date: "", end_date: "",
        advertiser_id: "", target_cpm: "", target_ctr: "",
        target_cpc: "", booked_budget: "", sitelist: "",
    });

    const fetchRows = useCallback(() => {
        setLoading(true);
        fetch(`${BASE_URL}/reports/get_campaigns_excel_list/`, { headers: { "ngrok-skip-browser-warning": "1" } })
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then((data) => setRows(Array.isArray(data) ? data : []))
            .catch(() => { setRows([]); message.error("Failed to load reports."); })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    const rowKey = (r: ReportRow) => `${r.ticket_id_raw}_${r.report_type}`;

    const handleGenerate = async (row: ReportRow) => {
        setGeneratingKey(rowKey(row));
        try {
            const res = await fetch(`${BASE_URL}/reports/generate_campaign_excel/${row.ticket_id_raw}/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                body: JSON.stringify({ report_type: row.report_type }),
            });
            if (!res.ok) throw new Error();
            message.success(`Excel generated for ${row.ticket_id}.`);
            fetchRows();
        } catch {
            message.error("Failed to generate Excel.");
        } finally {
            setGeneratingKey(null);
        }
    };

    const handleDownload = (row: ReportRow) => {
        window.open(`${BASE_URL}/reports/download_campaign_excel/${row.ticket_id_raw}/?report_type=${row.report_type}`, "_blank");
    };

    const handlePublish = async (row: ReportRow) => {
        setPublishingKey(rowKey(row));
        try {
            const res = await fetch(`${BASE_URL}/reports/publish_campaign_excel/${row.ticket_id_raw}/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                body: JSON.stringify({ report_type: row.report_type }),
            });
            if (!res.ok) throw new Error();
            message.success(`Published ${row.ticket_id}.`);
            fetchRows();
        } catch {
            message.error("Failed to publish.");
        } finally {
            setPublishingKey(null);
        }
    };

    // ── Open preview: regenerate to be safe, download + parse the .xlsx with SheetJS,
    // then load any saved internal overrides for the first sheet ──
    const handlePreview = async (row: ReportRow) => {
        if (!row.excel_url) return;
        setPreviewLoading(true);
        setShowPreview(true);
        setPreviewTicketId(row.ticket_id_raw);
        setPreviewReportType(row.report_type);
        try {
            await fetch(`${BASE_URL}/reports/generate_campaign_excel/${row.ticket_id_raw}/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                body: JSON.stringify({ report_type: row.report_type }),
            });

            // Fetch the UN-overridden original — this is what "Client Campaign Details" renders
            const originalUrl = `${BASE_URL}/reports/preview_campaign_excel_original/${row.ticket_id_raw}/?report_type=${row.report_type}`;
            const res = await fetch(originalUrl, { headers: { "ngrok-skip-browser-warning": "1" } });
            const arrayBuffer = await res.arrayBuffer();
            const wb = XLSX.read(arrayBuffer, { type: "array" });

            // const downloadUrl = `${BASE_URL}/reports/download_campaign_excel/${row.ticket_id_raw}/?report_type=${row.report_type}`;
            // const res = await fetch(downloadUrl, { headers: { "ngrok-skip-browser-warning": "1" } });
            // const arrayBuffer = await res.arrayBuffer();
            // const wb = XLSX.read(arrayBuffer, { type: "array" });

            const allSheets: Record<string, any[][]> = {};
            wb.SheetNames.forEach((name) => {
                const ws = wb.Sheets[name];
                allSheets[name] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
            });
            setAllSheetsData(JSON.parse(JSON.stringify(allSheets)));
            setSheetNames(wb.SheetNames);
            const firstSheet = wb.SheetNames[0];
            setActiveSheet(firstSheet);

            const editsRes = await fetch(
                `${BASE_URL}/reports/get_line_item_excel_data/${row.ticket_id_raw}/?report_type=${row.report_type}`,
                { headers: { "ngrok-skip-browser-warning": "1" } }
            );
            if (editsRes.ok) {
                const editsData = await editsRes.json();
                const existing = editsData[firstSheet] || {};
                setInternalEdits({
                    impressions: existing.impressions ? String(existing.impressions) :
                        (existing.clicks ? String(existing.clicks) : ""),
                    start_date: existing.start_date || "",
                    end_date: existing.end_date || "",
                    advertiser_id: existing.advertiser_id || "",
                    target_cpm: existing.target_cpm != null ? String(existing.target_cpm) : "",
                    target_ctr: existing.target_ctr != null ? String(existing.target_ctr) : "",
                    target_cpc: existing.target_cpc != null ? String(existing.target_cpc) : "",
                    booked_budget: existing.booked_budget != null ? String(existing.booked_budget) : "",
                    sitelist: existing.sitelist || "",
                });
            }
        } catch {
            message.error("Failed to load Excel for preview.");
            setShowPreview(false);
        } finally {
            setPreviewLoading(false);
        }
    };

    // ── Switching sheet tabs just reloads that line item's saved internal overrides ──
    const handleSheetChange = async (name: string) => {
        setActiveSheet(name);
        try {
            const editsRes = await fetch(
                `${BASE_URL}/reports/get_line_item_excel_data/${previewTicketId}/?report_type=${previewReportType}`,
                { headers: { "ngrok-skip-browser-warning": "1" } }
            );
            if (editsRes.ok) {
                const editsData = await editsRes.json();
                const existing = editsData[name] || {};
                setInternalEdits({
                    impressions: existing.impressions ? String(existing.impressions) :
                        (existing.clicks ? String(existing.clicks) : ""),
                    start_date: existing.start_date || "",
                    end_date: existing.end_date || "",
                    advertiser_id: existing.advertiser_id || "",
                    target_cpm: existing.target_cpm != null ? String(existing.target_cpm) : "",
                    target_ctr: existing.target_ctr != null ? String(existing.target_ctr) : "",
                    target_cpc: existing.target_cpc != null ? String(existing.target_cpc) : "",
                    booked_budget: existing.booked_budget != null ? String(existing.booked_budget) : "",
                    sitelist: existing.sitelist || "",
                });
            }
        } catch {
            /* ignore */
        }
    };

    const handleSaveEdits = async () => {
        setSaving(true);
        try {
            const payload = {
                report_type: previewReportType,
                line_item_id: activeSheet,
                ...internalEdits,
            };
            const res = await fetch(`${BASE_URL}/reports/save_excel_edits_to_db/${previewTicketId}/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Save failed");
            }
            message.success("Saved to internal DB — client data unchanged!");
            setShowPreview(false);
            fetchRows();
        } catch (err: any) {
            message.error(err.message || "Failed to save.");
        } finally {
            setSaving(false);
        }
    };

    const totalCount = rows.length;
    const generatedCount = rows.filter((r) => r.excel_generated).length;
    const pendingCount = totalCount - generatedCount;

    const filtered = rows.filter((r) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return [r.ticket_id, r.campaign_name, r.client_name, r.client_id].some((f) => f?.toLowerCase().includes(q));
    });

    const columns: ColumnsType<ReportRow> = [
        {
            title: "Ticket ID", dataIndex: "ticket_id", key: "ticket_id", width: 140,
            render: (v: string) => (
                <span style={{
                    fontSize: 11, fontWeight: 700, color: "var(--blue)", background: "var(--blue-bg)",
                    border: "1px solid var(--blue)", padding: "2px 10px", borderRadius: 6, display: "inline-block",
                }}>{v}</span>
            ),
        },
        {
            title: "Type", dataIndex: "report_type", key: "report_type", width: 160,
            render: (v: "cpm" | "cpc") => (
                <span style={{
                    fontSize: 11, fontWeight: 600, color: v === "cpm" ? "var(--purple)" : "var(--accent)",
                    background: v === "cpm" ? "var(--purple-bg)" : "var(--accent-light)",
                    padding: "3px 9px", borderRadius: 6, display: "inline-block",
                }}>
                    {v === "cpm" ? "CPM — Impressions" : "CPC — Clicks"}
                </span>
            ),
        },
        { title: "Campaign Name", dataIndex: "campaign_name", key: "campaign_name", width: 200,
            render: (v: string) => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{v || "—"}</span> },
        {
            title: "Client", key: "client", width: 200,
            render: (_: any, r: ReportRow) => (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{r.client_name || "—"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.client_id || ""}</div>
                </div>
            ),
        },
        { title: "Start Date", dataIndex: "start_date", key: "start_date", width: 110, render: (v: string) => fmtDate(v) },
        { title: "End Date", dataIndex: "end_date", key: "end_date", width: 110, render: (v: string) => fmtDate(v) },
        {
            title: "Line Items", dataIndex: "line_items_count", key: "line_items_count", width: 100,
            render: (v: number) => (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--blue)", background: "var(--blue-bg)", padding: "3px 9px", borderRadius: 6 }}>
                    {v} sheet{v !== 1 ? "s" : ""}
                </span>
            ),
        },
        {
            title: "Excel Status", key: "excel_status", width: 130,
            render: (_: any, r: ReportRow) => r.excel_generated ? (
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", background: "var(--green-bg)", border: "1px solid var(--green)", padding: "2px 10px", borderRadius: 20 }}>✓ Generated</span>
            ) : (
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", background: "var(--amber-bg)", border: "1px solid var(--amber)", padding: "2px 10px", borderRadius: 20 }}>⏳ Pending</span>
            ),
        },
        {
            title: "Publish Status", key: "publish_status", width: 130,
            render: (_: any, r: ReportRow) => r.publish_status === "published" ? (
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", background: "var(--green-bg)", border: "1px solid var(--green)", padding: "2px 10px", borderRadius: 20 }}>✓ Published</span>
            ) : (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— Not published</span>
            ),
        },
        {
            title: "Actions", key: "actions", width: 260, fixed: "right",
            render: (_: any, r: ReportRow) => {
                const key = rowKey(r);
                return (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {!r.excel_generated ? (
                            <Button size="small" type="primary" loading={generatingKey === key} onClick={() => handleGenerate(r)}
                                style={{ fontSize: 11, fontWeight: 600, borderRadius: 6 }}>
                                Generate
                            </Button>
                        ) : (
                            <>
                                <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(r)}
                                    style={{ fontSize: 11, fontWeight: 600, borderRadius: 6 }}>
                                    {r.has_edits ? "Updated" : "Preview"}
                                    {/* Preview */}
                                </Button>
                                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r)}
                                    style={{ fontSize: 11, fontWeight: 600, borderRadius: 6 }}>
                                    Download
                                </Button>
                                {/* {r.publish_status !== "published" && ( */}
                                {r.needs_republish && (
                                    <Button size="small" icon={<CloudUploadOutlined />} loading={publishingKey === key} onClick={() => handlePublish(r)}
                                        style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, color: "var(--green)", background: "var(--green-bg)", border: "1px solid var(--green)" }}>
                                        Publish
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <div>
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 8,
            }}>
                <div>
                    <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>Reports</h1>
                    <p style={{ fontSize: 9, color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        Generate &amp; download campaign excel reports
                    </p>
                </div>
            </div>

            <div className="db-stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <StatCard label="Total Reports" value={totalCount} />
                <StatCard label="Excel Generated" value={generatedCount} color="var(--green)" />
                <StatCard label="Pending" value={pendingCount} color="var(--amber)" />
            </div>

            <div style={{
                background: "var(--accent-light)", border: "1px solid var(--border-strong)", borderRadius: 10,
                padding: "10px 16px", margin: "16px 0", fontSize: 12, color: "var(--text-secondary)",
            }}>
                📊 Each campaign has two reports — <b>CPM (Impressions)</b> and <b>CPC (Clicks)</b>, based on the units used in its line items. Click <b>Generate</b>, then <b>Preview</b> to review, then <b>Download</b>.
            </div>

            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Input
                    placeholder="Search by ticket ID, campaign name, client…"
                    prefix={<SearchOutlined style={{ color: "var(--text-muted)" }} />}
                    value={search} onChange={(e) => setSearch(e.target.value)} allowClear
                    style={{ flex: 1, minWidth: 240, height: 36 }}
                />
                <Button onClick={fetchRows} icon={<ReloadOutlined />}
                    style={{ height: 36, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, paddingInline: 14 }}>
                    Refresh
                </Button>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{filtered.length} of {rows.length} reports</span>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
                <Table
                    columns={columns}
                    dataSource={filtered}
                    rowKey={rowKey}
                    loading={loading}
                    scroll={{ x: 1500 }}
                    pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50"], showTotal: (t, r) => `${r[0]}–${r[1]} of ${t} reports`, style: { padding: "12px 16px" } }}
                    style={{ fontSize: 13 }}
                />
            </div>

            {/* ── Preview Modal (xlsx-driven, tabbed) ── */}
            {showPreview && (
                previewLoading ? (
                    <div style={{
                        position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
                        zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <div style={{
                            background: "var(--bg-card)", borderRadius: 16, padding: "40px 60px",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
                        }}>
                            <Spin size="large" />
                            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
                                Loading Excel…
                            </span>
                        </div>
                    </div>
                ) : (
                    <PreviewModal
                        open={showPreview}
                        clientData={allSheetsData[activeSheet] ?? []}
                        sheetNames={sheetNames}
                        activeSheet={activeSheet}
                        onSheetChange={handleSheetChange}
                        ticketId={previewTicketId}
                        reportType={previewReportType}
                        saving={saving}
                        onClose={() => setShowPreview(false)}
                        onSave={handleSaveEdits}
                        internalEdits={internalEdits}
                        onInternalChange={(field, value) => setInternalEdits((prev) => ({ ...prev, [field]: value }))}
                    />
                )
            )}
        </div>
    );
}