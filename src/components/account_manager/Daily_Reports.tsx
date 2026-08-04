import { useEffect, useState, useCallback, useRef } from "react";
import { Table, Input, Button, Modal, Form, DatePicker } from "antd";
import {
    SearchOutlined,
    ReloadOutlined,
    FilterOutlined,
    PlusOutlined,
    DownloadOutlined,
    UploadOutlined,
    MailOutlined
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineItemRow {
    _key: string;
    _campaignRowSpan: number;
    _campaignIndex: number;
    ticket_id: string;
    campaign_name: string;
    client_name: string;
    line_item_id: string;
    line_item_name: string;
    start_date: string;
    end_date: string;
    ad_format: string;
    impressions: string;
    units: string;
    status: string;
    dv_id: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(v?: string) {
    if (!v) return "—";
    return new Date(v).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

function fmtImpressions(v?: string) {
    if (!v) return "—";
    const n = Number(v);
    return isNaN(n) ? v : n.toLocaleString("en-IN");
}

function resolveAdFormat(raw: string | string[] | undefined): string {
    if (!raw) return "—";
    if (Array.isArray(raw)) return raw.join(", ") || "—";
    return raw || "—";
}

function isVideoFormat(adFormat?: string): boolean {
    if (!adFormat) return false;
    return adFormat.toLowerCase().includes("video") || adFormat.toLowerCase().includes("youtube");
}

function getLineItemStatus(s: string, e: string): "active" | "upcoming" | "closed" {
    if (!s || !e) return "upcoming";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(s);
    const end = new Date(e); end.setHours(23, 59, 59, 999);
    if (today > end) return "closed";
    if (today >= start) return "active";
    return "upcoming";
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
    return (
        <div style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9999,
            background: "var(--bg-card)",
            border: `1px solid ${type === "success" ? "var(--green)" : "var(--red)"}`,
            borderRadius: 12, padding: "14px 20px",
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: "var(--shadow)", minWidth: 280,
        }}>
            <span style={{ fontSize: 18 }}>{type === "success" ? "✅" : "❌"}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{message}</span>
        </div>
    );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, colorVar, bgVar, icon }: {
    label: string; value: number; colorVar: string; bgVar: string; icon: string;
}) {
    return (
        <div style={{
            background: "var(--bg-card)", borderRadius: "var(--radius-card)", padding: 20,
            border: "1px solid var(--border)", boxShadow: "var(--shadow-card)",
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: colorVar, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{label}</span>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: bgVar, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: colorVar, letterSpacing: "-1px", lineHeight: 1 }}>{value}</div>
        </div>
    );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { bg: string; border: string; color: string; label: string }> = {
        active: { bg: "var(--green-bg)", border: "var(--green)", color: "var(--green)", label: "Active" },
        upcoming: { bg: "var(--amber-bg)", border: "var(--amber)", color: "var(--amber)", label: "Upcoming" },
        closed: { bg: "var(--red-bg)", border: "var(--red)", color: "var(--red)", label: "Closed" },
    };
    const s = map[status] ?? map.upcoming;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px",
            borderRadius: 20, background: s.bg, border: `1px solid ${s.border}`,
            fontSize: 10, fontWeight: 700, color: s.color,
            letterSpacing: "0.05em", textTransform: "uppercase" as const,
        }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            {s.label}
        </span>
    );
}

// ── Ad Format Badge ───────────────────────────────────────────────────────────
function AdFormatBadge({ format }: { format: string }) {
    if (!format || format === "—") return <span style={{ color: "var(--text-muted)" }}>—</span>;

    const colorMap: Record<string, { color: string; bg: string; border: string }> = {
        banner: { color: "var(--accent)", bg: "var(--accent-light)", border: "var(--accent)" },
        video: { color: "var(--accent)", bg: "var(--accent-light)", border: "var(--accent)" },
        youtube: { color: "var(--red)", bg: "var(--red-bg)", border: "var(--red)" },
        interstitial: { color: "var(--accent-3)", bg: "rgba(67,188,205,0.12)", border: "var(--accent-3)" },
    };

    const base = format.split(" › ")[0].toLowerCase().trim();
    const st = colorMap[base] ?? {
        color: "var(--text-muted)",
        bg: "var(--bg-input)",
        border: "var(--border)",
    };

    return (
        <span style={{
            display: "inline-flex", padding: "3px 9px", borderRadius: 8,
            background: st.bg, border: `1px solid ${st.border}`,
            fontSize: 11, fontWeight: 600, color: st.color,
            maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
        }} title={format}>
            {format}
        </span>
    );
}

// ── Campaign Group Cell ───────────────────────────────────────────────────────
function CampaignGroupCell({ record }: { record: LineItemRow }) {
    const isEven = record._campaignIndex % 2 === 0;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0", paddingLeft: 10 }}>
            <span style={{
                fontSize: 12, fontWeight: 700,
                color: "var(--accent)",
                background: "var(--accent-light)",
                padding: "3px 8px", borderRadius: 6,
                border: `1px solid ${isEven ? "var(--accent)" : "var(--color-purple)"}`,
                display: "inline-block", alignSelf: "flex-start",
            }}>
                {record.ticket_id}
            </span>
        </div>
    );
}

function CampaignDownloadCell({
    record,
    onDownload,
    onSendEmail,
}: {
    record: LineItemRow;
    onDownload: (ticketId: string) => void;
    onSendEmail: (ticketId: string) => void;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0", paddingLeft: 10 }}>
            <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => onDownload(record.ticket_id)}
                style={{
                    height: 28, borderRadius: 6,
                    border: "1px solid var(--accent)",
                    background: "var(--accent-light)",
                    color: "var(--accent)",
                    fontSize: 11, fontWeight: 600, alignSelf: "flex-start",
                }}
            >
                Download
            </Button>
            <Button
                size="small"
                icon={<MailOutlined />}
                onClick={() => onSendEmail(record.ticket_id)}
                style={{
                    height: 28, borderRadius: 6,
                    border: "1px solid var(--blue)",
                    background: "var(--blue-bg)",
                    color: "var(--blue)",
                    fontSize: 11, fontWeight: 600, alignSelf: "flex-start",
                }}
            >
                Send Email
            </Button>
        </div>
    );
}

// ── Add Report Modal ──────────────────────────────────────────────────────────
function AddReportModal({
    open, record, onClose, onSubmit, disabledDates,
}: {
    open: boolean;
    record: LineItemRow | null;
    onClose: () => void;
    onSubmit: (values: {
        date: string; impressions: number; clicks: number; ctr: number;
        viewable_impression: number; measurable_impression: number;
        video_start: number; video_end: number;
        revenue: number; media_cost: number;
        vcr?: number; viewability?: number;
    }) => void;
    disabledDates: string[];
}) {
    const [form] = Form.useForm();
    const isVideo = isVideoFormat(record?.ad_format);

    useEffect(() => { if (open) form.resetFields(); }, [open, form]);

    const handleOk = () => {
        form.validateFields().then((values) => {
            onSubmit({
                date: values.date.format("YYYY-MM-DD"),
                impressions: values.impressions,
                clicks: values.clicks,
                ctr: values.ctr,
                viewable_impression: values.viewable_impression,
                measurable_impression: values.measurable_impression,
                video_start: values.video_start,
                video_end: values.video_end,
                revenue: values.revenue,
                media_cost: values.media_cost,
                ...(isVideo ? { vcr: values.vcr, viewability: values.viewability } : {}),
            });
            form.resetFields();
        });
    };

    const isDateDisabled = (current: any) => {
        if (!current) return false;
        const dateStr = current.format("YYYY-MM-DD");
        if (disabledDates.includes(dateStr)) return true;
        if (record?.start_date && current.isBefore(record.start_date, "day")) return true;
        if (record?.end_date && current.isAfter(record.end_date, "day")) return true;
        return false;
    };

    const fieldLabel = (text: string) => (
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.02em" }}>{text}</span>
    );

    const inputStyle = {
        height: 40, borderRadius: 8,
        border: "1px solid var(--border)", fontSize: 13,
    };

    return (
        <Modal
            title={
                <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>
                        Add Daily Entry
                    </div>
                    {record && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                            <span style={{
                                fontSize: 11, fontWeight: 700,
                                color: "var(--accent)", background: "var(--accent-light)",
                                padding: "2px 8px", borderRadius: 6, border: "1px solid var(--accent)",
                            }}>
                                {record.line_item_id}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                                {record.line_item_name}
                            </span>
                        </div>
                    )}
                </div>
            }
            open={open}
            onCancel={onClose}
            onOk={handleOk}
            okText="Save"
            cancelText="Cancel"
            destroyOnClose
            centered
            width={700}
            styles={{
                header: { borderBottom: "1px solid var(--border)", paddingBottom: 16, marginBottom: 4 },
                body: { background: "var(--bg-page)", padding: 16, borderRadius: 8 },
                footer: { borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 },
            }}
            okButtonProps={{
                style: {
                    height: 38, borderRadius: 8,
                    background: "var(--accent)", borderColor: "var(--accent)",
                    fontWeight: 600, fontSize: 13, paddingInline: 20, boxShadow: "none",
                },
            }}
            cancelButtonProps={{
                style: {
                    height: 38, borderRadius: 8,
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    fontWeight: 600, fontSize: 13, paddingInline: 18,
                },
            }}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 1 }} requiredMark="optional">
                <Form.Item
                    label={fieldLabel("Date")}
                    name="date"
                    rules={[{ required: true, message: "Please select a date" }]}
                    style={{ marginBottom: 16 }}
                >
                    <DatePicker
                        style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid var(--border)" }}
                        format="DD-MMM-YYYY"
                        placeholder="Select date"
                        disabledDate={isDateDisabled}
                    />
                </Form.Item>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Form.Item label={fieldLabel("Impressions")} name="impressions"
                        rules={[{ required: true, message: "Required" }, { pattern: /^[0-9]+$/, message: "Numbers only" }]}
                        style={{ marginBottom: 16 }}>
                        <Input placeholder="e.g. 50000" inputMode="numeric" style={inputStyle} />
                    </Form.Item>
                    <Form.Item label={fieldLabel("Clicks")} name="clicks"
                        rules={[{ required: true, message: "Required" }, { pattern: /^[0-9]+$/, message: "Numbers only" }]}
                        style={{ marginBottom: 16 }}>
                        <Input placeholder="e.g. 1200" inputMode="numeric" style={inputStyle} />
                    </Form.Item>
                </div>

                <Form.Item label={fieldLabel("CTR (%)")} name="ctr"
                    rules={[{ required: true, message: "Please enter CTR" }, { pattern: /^[0-9]+(\.[0-9]{1,2})?$/, message: "Enter a valid number" }]}
                    style={{ marginBottom: 16 }}>
                    <Input placeholder="e.g. 2.45" inputMode="decimal"
                        suffix={<span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>%</span>}
                        style={inputStyle} />
                </Form.Item>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Form.Item label={fieldLabel("Viewable Impressions")} name="viewable_impression"
                        rules={[{ required: true, message: "Required" }, { pattern: /^[0-9]+$/, message: "Numbers only" }]}
                        style={{ marginBottom: 16 }}>
                        <Input placeholder="e.g. 2000" inputMode="numeric" style={inputStyle} />
                    </Form.Item>
                    <Form.Item label={fieldLabel("Measurable Impression")} name="measurable_impression"
                        rules={[{ required: true, message: "Required" }, { pattern: /^[0-9]+$/, message: "Numbers only" }]}
                        style={{ marginBottom: 16 }}>
                        <Input placeholder="e.g. 1000" inputMode="numeric" style={inputStyle} />
                    </Form.Item>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Form.Item label={fieldLabel("Video Start")} name="video_start"
                        rules={[{ required: true, message: "Required" }, { pattern: /^[0-9]+$/, message: "Numbers only" }]}
                        style={{ marginBottom: 16 }}>
                        <Input placeholder="e.g. 1000" inputMode="numeric" style={inputStyle} />
                    </Form.Item>
                    <Form.Item label={fieldLabel("Video End")} name="video_end"
                        rules={[{ required: true, message: "Required" }, { pattern: /^[0-9]+$/, message: "Numbers only" }]}
                        style={{ marginBottom: 16 }}>
                        <Input placeholder="e.g. 1000" inputMode="numeric" style={inputStyle} />
                    </Form.Item>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Form.Item label={fieldLabel("Revenue (Adv Currency)")} name="revenue"
                        rules={[{ required: true, message: "Required" }, { pattern: /^[0-9]+$/, message: "Numbers only" }]}
                        style={{ marginBottom: 16 }}>
                        <Input placeholder="e.g. 5000" inputMode="numeric" style={inputStyle} />
                    </Form.Item>
                    <Form.Item label={fieldLabel("Media Cost (Advertiser Currency)")} name="media_cost"
                        rules={[{ required: true, message: "Required" }, { pattern: /^[0-9]+$/, message: "Numbers only" }]}
                        style={{ marginBottom: 16 }}>
                        <Input placeholder="e.g. 5000" inputMode="numeric" style={inputStyle} />
                    </Form.Item>
                </div>

                {isVideo && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <Form.Item label={fieldLabel("Video Completion Rate (VCR)")} name="vcr"
                            rules={[{ required: true, message: "Required" }, { pattern: /^[0-9]+(\.[0-9]{1,2})?$/, message: "Enter a valid number" }]}
                            style={{ marginBottom: 16 }}>
                            <Input placeholder="e.g. 65.5" inputMode="decimal"
                                suffix={<span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>%</span>}
                                style={inputStyle} />
                        </Form.Item>
                        <Form.Item label={fieldLabel("Viewability")} name="viewability"
                            rules={[{ required: true, message: "Required" }, { pattern: /^[0-9]+(\.[0-9]{1,2})?$/, message: "Enter a valid number" }]}
                            style={{ marginBottom: 16 }}>
                            <Input placeholder="e.g. 72.3" inputMode="decimal"
                                suffix={<span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>%</span>}
                                style={inputStyle} />
                        </Form.Item>
                    </div>
                )}
            </Form>
        </Modal>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Daily_Reports() {
    const [rows, setRows] = useState<LineItemRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "upcoming" | "closed">("all");
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailPreview, setEmailPreview] = useState<any>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);
    const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);

    const openSendEmailModal = (ticketId: string) => {
        setCurrentTicketId(ticketId);
        setEmailModalOpen(true);
        setEmailPreview(null);

        fetch(`${BASE_URL}/reports/send-email-preview/${ticketId}/`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => r.json())
            .then((data) => {
                if (!data.status) {
                    showToast(data.message, "error");
                    setEmailModalOpen(false);
                    return;
                }
                setEmailPreview(data);
                setEmailSubject(data.subject);
                setEmailBody(`Please find attached the daily report for ${data.campaign_name}.`);
            })
            .catch(() => {
                showToast("Failed to load email details.", "error");
                setEmailModalOpen(false);
            });
    };

    const confirmSendEmail = () => {
        if (!currentTicketId) return;
        setSendingEmail(true);

        const formData = new FormData();
        formData.append("subject", emailSubject);
        formData.append("email_body", emailBody);

        fetch(`${BASE_URL}/reports/send-email/${currentTicketId}/`, {
            method: "POST",
            headers: { "ngrok-skip-browser-warning": "1" },
            body: formData,
        })
            .then((r) => r.json())
            .then((data) => {
                showToast(data.message, data.status ? "success" : "error");
                if (data.status) setEmailModalOpen(false);
            })
            .catch(() => showToast("Something went wrong sending the email.", "error"))
            .finally(() => setSendingEmail(false));
    };

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<LineItemRow | null>(null);
    const [usedDatesByLineItem, setUsedDatesByLineItem] = useState<Record<string, string[]>>({});

    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkUploading, setBulkUploading] = useState(false);
    const [bulkSelectedFile, setBulkSelectedFile] = useState<File | null>(null);
    const [bulkResult, setBulkResult] = useState<null | {
        inserted: number; skipped: number; errors: number;
        details: { inserted: any[]; skipped: any[]; errors: any[] };
    }>(null);
    const bulkFileRef = useRef<HTMLInputElement>(null);

    const openAddModal = (record: LineItemRow) => { setSelectedRecord(record); setAddModalOpen(true); };
    const closeAddModal = () => { setAddModalOpen(false); setSelectedRecord(null); };

    const handleAddSubmit = async (values: {
        date: string; impressions: number; clicks: number; ctr: number;
        viewable_impression: number; measurable_impression: number;
        video_start: number; video_end: number;
        revenue: number; media_cost: number; vcr?: number; viewability?: number;
    }) => {
        if (!selectedRecord) return;
        try {
            const res = await fetch(`${BASE_URL}/reports/add_daily_entry/${selectedRecord.ticket_id}/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                body: JSON.stringify({
                    line_item_id: selectedRecord.line_item_id,
                    date: values.date,
                    impressions: values.impressions,
                    clicks: values.clicks,
                    ctr: values.ctr,
                    viewable_impression: values.viewable_impression,
                    measurable_impression: values.measurable_impression,
                    video_start: values.video_start,
                    video_end: values.video_end,
                    revenue: values.revenue,
                    media_cost: values.media_cost,
                    ...(values.vcr !== undefined ? { vcr: values.vcr } : {}),
                    ...(values.viewability !== undefined ? { viewability: values.viewability } : {}),
                }),
            });
            const data = await res.json();
            if (res.status === 409) { showToast(data.error || "Entry already exists for this date.", "error"); return; }
            if (!res.ok) { showToast(data.error || "Failed to add entry.", "error"); return; }
            showToast("Entry added successfully.", "success");
            setUsedDatesByLineItem(prev => ({
                ...prev,
                [selectedRecord.line_item_id]: [...(prev[selectedRecord.line_item_id] || []), values.date],
            }));
            closeAddModal();
        } catch {
            showToast("Failed to add entry. Check your connection.", "error");
        }
    };

    const handleDownloadCampaignExcel = (ticketId: string) => {
        window.open(`${BASE_URL}/reports/download_daily_report_excel/${ticketId}/`, "_blank");
    };

    const handleBulkFileSelect = (file: File) => { setBulkResult(null); setBulkSelectedFile(file); };

    const handleBulkUploadConfirm = async () => {
        if (!bulkSelectedFile) return;
        setBulkUploading(true); setBulkResult(null);
        const formData = new FormData();
        formData.append("file", bulkSelectedFile);
        try {
            const res = await fetch(`${BASE_URL}/reports/bulk_upload_daily_entries/`, {
                method: "POST", headers: { "ngrok-skip-browser-warning": "1" }, body: formData,
            });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || "Bulk upload failed.", "error"); }
            else { setBulkResult(data); if (data.inserted > 0) fetchData(); }
        } catch { showToast("Bulk upload failed. Check your connection.", "error"); }
        finally { setBulkUploading(false); }
    };

    const clearBulkSelection = () => {
        setBulkSelectedFile(null); setBulkResult(null);
        if (bulkFileRef.current) bulkFileRef.current.value = "";
    };

    const showToast = (msg: string, type: "success" | "error" = "success") =>
        setToast({ message: msg, type });

    // ── Fetch & flatten ──────────────────────────────────────────────────────
    const fetchData = useCallback(() => {
        setLoading(true);
        fetch(`${BASE_URL}/campaigns/get_campaigns/`, { headers: { "ngrok-skip-browser-warning": "1" } })
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then((data: any[]) => {
                const campaigns = Array.isArray(data) ? data : [];
                const flatRows: LineItemRow[] = [];
                const ticketIds = new Set<string>();

                campaigns.forEach((campaign: any, campaignIndex: number) => {
                    if (campaign.ticket_id) ticketIds.add(campaign.ticket_id);
                    const lineItems: any[] = Array.isArray(campaign.line_items) ? campaign.line_items : [];
                    const liCount = lineItems.length;
                    lineItems.forEach((li: any, liIndex: number) => {
                        flatRows.push({
                            _key: `${campaign.ticket_id}_${li.line_item_id}_${liIndex}`,
                            _campaignRowSpan: liIndex === 0 ? liCount : 0,
                            _campaignIndex: campaignIndex,
                            ticket_id: campaign.ticket_id || "—",
                            campaign_name: campaign.campaign_name || "—",
                            client_name: campaign.client_name || "—",
                            line_item_id: li.line_item_id || "—",
                            line_item_name: li.line_item_name || "—",
                            start_date: li.start_date || "",
                            end_date: li.end_date || "",
                            ad_format: resolveAdFormat(li.ad_format),
                            impressions: li.impressions || "",
                            units: li.units || "",
                            status: getLineItemStatus(li.start_date || "", li.end_date || ""),
                            dv_id: li.dv_id || "",
                        });
                    });
                });

                setRows(flatRows);

                Promise.all(
                    Array.from(ticketIds).map(tid =>
                        fetch(`${BASE_URL}/reports/get_daily_entries/${tid}/`, { headers: { "ngrok-skip-browser-warning": "1" } })
                            .then(r => (r.ok ? r.json() : []))
                            .catch(() => [])
                    )
                ).then(results => {
                    const map: Record<string, string[]> = {};
                    results.flat().forEach((entry: any) => {
                        if (!map[entry.line_item_id]) map[entry.line_item_id] = [];
                        map[entry.line_item_id].push(entry.date);
                    });
                    setUsedDatesByLineItem(map);
                });
            })
            .catch(() => showToast("Failed to load line items.", "error"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Filter with rowspan recompute ────────────────────────────────────────
    const preFiltered = rows.filter(r => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return [r.ticket_id, r.campaign_name, r.client_name, r.line_item_id, r.line_item_name, r.ad_format]
                .some(f => f?.toLowerCase().includes(q));
        }
        return true;
    });

    const filtered: LineItemRow[] = [];
    const seenCampaigns = new Map<string, number>();
    preFiltered.forEach(row => {
        const tid = row.ticket_id;
        if (!seenCampaigns.has(tid)) {
            seenCampaigns.set(tid, filtered.length);
            filtered.push({ ...row, _campaignRowSpan: 1 });
        } else {
            const firstIdx = seenCampaigns.get(tid)!;
            filtered[firstIdx] = { ...filtered[firstIdx], _campaignRowSpan: filtered[firstIdx]._campaignRowSpan + 1 };
            filtered.push({ ...row, _campaignRowSpan: 0 });
        }
    });

    const totalCount = rows.length;
    const activeCount = rows.filter(r => r.status === "active").length;
    const upcomingCount = rows.filter(r => r.status === "upcoming").length;
    const closedCount = rows.filter(r => r.status === "closed").length;

    const filterPills = [
        { key: "all" as const, label: `All (${totalCount})`, activeColor: "var(--text-muted)", activeBg: "var(--bg-input)", activeBorder: "var(--border)" },
        { key: "active" as const, label: `Active (${activeCount})`, activeColor: "var(--green)", activeBg: "var(--green-bg)", activeBorder: "var(--green)" },
        { key: "upcoming" as const, label: `Upcoming (${upcomingCount})`, activeColor: "var(--amber)", activeBg: "var(--amber-bg)", activeBorder: "var(--amber)" },
        { key: "closed" as const, label: `Closed (${closedCount})`, activeColor: "var(--red)", activeBg: "var(--red-bg)", activeBorder: "var(--red)" },
    ];

    // ── Columns ──────────────────────────────────────────────────────────────
    const columns: ColumnsType<LineItemRow> = [
        {
            title: "Ticket ID",
            key: "ticket_id",
            width: 120,
            fixed: "left",
            onCell: (record) => ({ rowSpan: record._campaignRowSpan }),
            render: (_: any, record: LineItemRow) =>
                record._campaignRowSpan > 0 ? <CampaignGroupCell record={record} /> : null,
        },
        {
            title: "Line Item ID",
            dataIndex: "line_item_id",
            key: "line_item_id",
            width: 150,
            render: (v: string) => (
                <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: "var(--accent)", background: "var(--accent-light)",
                    padding: "3px 8px", borderRadius: 6,
                    border: "1px solid var(--accent)", display: "inline-block",
                }}>
                    {v}
                </span>
            ),
        },
        {
            title: "DV ID",
            dataIndex: "dv_id",
            key: "dv_id",
            width: 150,
            render: (v: string) => v ? (
                <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: "var(--color-purple)", background: "var(--accent-light)",
                    padding: "3px 8px", borderRadius: 6,
                    border: "1px solid var(--color-purple)", display: "inline-block",
                }}>
                    {v}
                </span>
            ) : (
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
            ),
        },
        {
            title: "Line Item Name",
            dataIndex: "line_item_name",
            key: "line_item_name",
            width: 200,
            render: (v: string) => (
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{v}</span>
            ),
        },
        {
            title: "Start Date",
            dataIndex: "start_date",
            key: "start_date",
            width: 120,
            render: (v: string) => <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{fmtDate(v)}</span>,
        },
        {
            title: "End Date",
            dataIndex: "end_date",
            key: "end_date",
            width: 120,
            render: (v: string) => <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{fmtDate(v)}</span>,
        },
        {
            title: "Ad Format",
            dataIndex: "ad_format",
            key: "ad_format",
            width: 190,
            render: (v: string) => <AdFormatBadge format={v} />,
        },
        {
            title: "Impressions",
            dataIndex: "impressions",
            key: "impressions",
            width: 140,
            render: (v: string, record: LineItemRow) => {
                const isCpm = record.units === "CPM";
                return (
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                            {fmtImpressions(v)}
                        </div>
                        {record.units && (
                            <span style={{
                                fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                                textTransform: "uppercase" as const,
                                background: isCpm ? "var(--accent-light)" : "rgba(67,188,205,0.12)",
                                color: isCpm ? "var(--accent)" : "var(--accent-3)",
                                border: `1px solid ${isCpm ? "var(--accent)" : "var(--accent-3)"}`,
                                marginTop: 3, display: "inline-block",
                            }}>
                                {record.units}
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: 110,
            render: (v: string) => <StatusBadge status={v} />,
        },
        {
            title: "Actions",
            key: "actions",
            width: 100,
            fixed: "right",
            render: (_: any, record: LineItemRow) => (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => openAddModal(record)}
                        style={{
                            height: 28, borderRadius: 6,
                            border: "1px solid var(--accent)",
                            background: "var(--accent-light)",
                            color: "var(--accent)",
                            fontSize: 11, fontWeight: 600,
                        }}
                    >
                        Add
                    </Button>
                </div>
            ),
        },
        {
            title: "Download",
            key: "download",
            width: 130,
            fixed: "right",
            onCell: (record) => ({ rowSpan: record._campaignRowSpan }),
            render: (_: any, record: LineItemRow) =>
                record._campaignRowSpan > 0 ? (
                    <CampaignDownloadCell
                        record={record}
                        onDownload={handleDownloadCampaignExcel}
                        onSendEmail={openSendEmailModal}   // ← add this
                    />
                ) : null,
        },
    ];

    return (
        <>
            {/* ── Header ── */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Daily Reports</h1>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, letterSpacing: "0.04em", fontWeight: 500, textTransform: "uppercase" }}>
                        ALL LINE ITEMS ACROSS CAMPAIGNS
                    </p>
                </div>
                <Button
                    icon={<span style={{ fontSize: 15 }}>📤</span>}
                    onClick={() => setBulkModalOpen(true)}
                    style={{
                        height: 38, borderRadius: 8,
                        border: "none",
                        background: "var(--accent)", color: "#fff",
                        fontWeight: 600, fontSize: 13,
                    }}
                >
                    Bulk Upload
                </Button>
            </div>

            {/* ── Stat Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
                <StatCard label="Total Line Items" value={totalCount} colorVar="var(--accent)" bgVar="var(--accent-light)" icon="📋" />
                <StatCard label="Active" value={activeCount} colorVar="var(--green)" bgVar="var(--green-bg)" icon="🟢" />
                <StatCard label="Upcoming" value={upcomingCount} colorVar="var(--amber)" bgVar="var(--amber-bg)" icon="⏳" />
                <StatCard label="Closed" value={closedCount} colorVar="var(--red)" bgVar="var(--red-bg)" icon="🔴" />
            </div>

            {/* ── Filters ── */}
            <div style={{
                background: "var(--bg-card)", borderRadius: 12, padding: "14px 18px",
                border: "1px solid var(--border)", marginBottom: 16,
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                boxShadow: "var(--shadow-card)",
            }}>
                <Input
                    placeholder="Search by ticket ID, name, line item, format…"
                    prefix={<SearchOutlined style={{ color: "var(--text-muted)" }} />}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    allowClear
                    style={{ flex: 1, minWidth: 260, height: 36, background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <FilterOutlined style={{ color: "var(--text-muted)", fontSize: 13 }} />
                    {filterPills.map(pill => {
                        const isActive = statusFilter === pill.key;
                        return (
                            <button
                                key={pill.key}
                                onClick={() => setStatusFilter(pill.key)}
                                style={{
                                    padding: "4px 12px", borderRadius: 20,
                                    border: `1px solid ${isActive ? pill.activeBorder : "var(--border)"}`,
                                    background: isActive ? pill.activeBg : "transparent",
                                    color: isActive ? pill.activeColor : "var(--text-muted)",
                                    fontSize: 11, fontWeight: 700, cursor: "pointer", outline: "none", transition: "all 0.15s",
                                }}
                            >
                                {pill.label}
                            </button>
                        );
                    })}
                </div>
                <Button
                    onClick={fetchData}
                    icon={<ReloadOutlined />}
                    style={{
                        height: 36, borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--bg-input)",
                        color: "var(--text-muted)",
                        fontSize: 12, fontWeight: 600,
                    }}
                >
                    Refresh
                </Button>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {filtered.length} of {rows.length} line items
                </span>
            </div>

            {/* ── Table ── */}
            <div style={{
                background: "var(--bg-card)", borderRadius: 14,
                border: "1px solid var(--border)", overflow: "hidden",
                boxShadow: "var(--shadow-card)",
            }}>
                <Table
                    columns={columns}
                    dataSource={filtered}
                    rowKey="_key"
                    loading={loading}
                    scroll={{ x: 1530 }}
                    pagination={{
                        pageSize: 20, showSizeChanger: true,
                        pageSizeOptions: ["20", "50", "100"],
                        showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} line items`,
                        style: { padding: "12px 16px" },
                    }}
                    style={{ fontSize: 13 }}
                    rowClassName={(record) => {
                        const isEven = record._campaignIndex % 2 === 0;
                        return `dr-row ${record.status === "closed" ? "dr-row-closed" : ""} ${isEven ? "dr-group-even" : "dr-group-odd"}`;
                    }}
                    bordered
                />
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <AddReportModal
                open={addModalOpen}
                record={selectedRecord}
                onClose={closeAddModal}
                onSubmit={handleAddSubmit}
                disabledDates={selectedRecord ? (usedDatesByLineItem[selectedRecord.line_item_id] || []) : []}
            />

            <Modal
                title="Send Daily Report Email"
                open={emailModalOpen}
                onCancel={() => setEmailModalOpen(false)}
                onOk={confirmSendEmail}
                confirmLoading={sendingEmail}
                okText="Confirm & Send"
            >
                {!emailPreview ? (
                    <div>Loading...</div>
                ) : (
                    <>
                        <p><b>Campaign:</b> {emailPreview.campaign_name}</p>
                        <p><b>Client:</b> {emailPreview.client_name}</p>
                        <p><b>To:</b> {emailPreview.to.join(", ")}</p>
                        <p><b>CC:</b> {emailPreview.cc.length ? emailPreview.cc.join(", ") : "(none)"}</p>
                        <label>Subject</label>
                        <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} style={{ marginBottom: 12 }} />
                        <label>Email Body</label>
                        <Input.TextArea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={4} />
                        <p style={{ marginTop: 12 }}><b>Attachments:</b> {emailPreview.attachments.join(", ")}</p>
                    </>
                )}
            </Modal>

            {/* ── Bulk Upload Modal ── */}
            <Modal
                title={<span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>📤 Bulk Upload Daily Entries</span>}
                open={bulkModalOpen}
                onCancel={() => { setBulkModalOpen(false); clearBulkSelection(); }}
                footer={null}
                centered
                width={560}
                destroyOnClose
            >
                <div style={{
                    background: "var(--accent-light)", border: "1px solid var(--accent)",
                    borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                    fontSize: 12, color: "var(--accent)",
                }}>
                    <strong>Accepted files:</strong> .csv or .xlsx (DV360 export format)<br />
                    <strong>Required columns:</strong> Campaign (ticket ID), Line Item ID, Date, Impressions, Clicks, Click Rate (CTR), Revenue (Adv Currency), Media Cost (Advertiser Currency), Start Views, Complete Views, Viewable Impressions, Measurable Impressions
                </div>

                <input
                    ref={bulkFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: "none" }}
                    onChange={e => { const file = e.target.files?.[0]; if (file) handleBulkFileSelect(file); }}
                />

                <Button
                    icon={<span>📂</span>}
                    onClick={() => bulkFileRef.current?.click()}
                    disabled={bulkUploading}
                    style={{
                        width: "100%", height: 44, borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--bg-card)",
                        fontSize: 13, fontWeight: 600,
                        color: "var(--text-primary)", marginBottom: 12,
                    }}
                >
                    {bulkSelectedFile ? "Change File (.csv / .xlsx)" : "Select File (.csv / .xlsx)"}
                </Button>

                {bulkSelectedFile && (
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: "var(--bg-input)", border: "1px solid var(--border)",
                        borderRadius: 8, padding: "10px 14px", marginBottom: 16, gap: 10,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                            <span style={{ fontSize: 16 }}>📄</span>
                            <span style={{
                                fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>
                                {bulkSelectedFile.name}
                            </span>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                            <Button size="small" onClick={clearBulkSelection} disabled={bulkUploading}
                                style={{ height: 30, borderRadius: 6, border: "1px solid var(--border)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                                Remove
                            </Button>
                            <Button size="small" type="primary" icon={<UploadOutlined />}
                                loading={bulkUploading} onClick={handleBulkUploadConfirm}
                                style={{ height: 30, borderRadius: 6, background: "var(--accent)", borderColor: "var(--accent)", fontSize: 11, fontWeight: 700 }}>
                                {bulkUploading ? "Uploading…" : "Upload"}
                            </Button>
                        </div>
                    </div>
                )}

                {bulkResult && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                            <div style={{ textAlign: "center", padding: "10px", background: "var(--green-bg)", borderRadius: 8, border: "1px solid var(--green)" }}>
                                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)" }}>{bulkResult.inserted}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--green)" }}>Inserted</div>
                            </div>
                            <div style={{ textAlign: "center", padding: "10px", background: "var(--amber-bg)", borderRadius: 8, border: "1px solid var(--amber)" }}>
                                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--amber)" }}>{bulkResult.skipped}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--amber)" }}>Skipped</div>
                            </div>
                            <div style={{ textAlign: "center", padding: "10px", background: "var(--red-bg)", borderRadius: 8, border: "1px solid var(--red)" }}>
                                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--red)" }}>{bulkResult.errors}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--red)" }}>Errors</div>
                            </div>
                        </div>

                        {bulkResult.details.errors.length > 0 && (
                            <div style={{ maxHeight: 180, overflowY: "auto", background: "var(--red-bg)", borderRadius: 8, border: "1px solid var(--red)", padding: "8px 12px" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", marginBottom: 6 }}>Error Details:</div>
                                {bulkResult.details.errors.map((e: any, i: number) => (
                                    <div key={i} style={{ fontSize: 11, color: "var(--red)", marginBottom: 3 }}>
                                        Row {e.row}: {e.reason} — <span>{e.data}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {bulkResult.details.skipped.length > 0 && (
                            <div style={{ maxHeight: 120, overflowY: "auto", background: "var(--amber-bg)", borderRadius: 8, border: "1px solid var(--amber)", padding: "8px 12px", marginTop: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", marginBottom: 6 }}>Skipped (already exist):</div>
                                {bulkResult.details.skipped.map((s: any, i: number) => (
                                    <div key={i} style={{ fontSize: 11, color: "var(--amber)", marginBottom: 3 }}>
                                        Row {s.row}: <span>{s.data}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <style>{`
                .ant-table-thead > tr > th {
                    background: var(--bg-input) !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    color: var(--text-muted) !important;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    border-right: 1px solid var(--border) !important;
                }
                .dr-row:hover td { background: var(--bg-card-hover) !important; }
                .dr-row-closed td { opacity: 0.72; }
                .dr-row-closed:hover td { background: var(--red-bg) !important; opacity: 1; }
                .dr-group-even td { background: var(--bg-card); }
                .dr-group-odd td { background: var(--bg-page); }
                .ant-table-tbody > tr.dr-row td {
                    border-right: 1px solid var(--border);
                }
            `}</style>
        </>
    );
}