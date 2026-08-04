import { useEffect, useState, useCallback, useRef } from "react";
import {
    Table, Button, Input, Select, Modal, message,
} from "antd";
import {
    SearchOutlined, ReloadOutlined, EyeOutlined, EditOutlined,
    PlusOutlined, DeleteOutlined, CloseOutlined,
    UsergroupAddOutlined, ClockCircleOutlined
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const { Option } = Select;
const BASE_URL = import.meta.env.VITE_BASE_URL;

// ── Departments this campaign's work can be split across ─────────────────────
// (mirrors the Department / Role setup administered from the Management Dashboard)
const TASK_DEPARTMENTS = [
    "Creative Ops",
    "Campaign Ops",
    "Ad Ops",
    "Finance",
    "Design",
];

const TURNAROUND_OPTIONS = [
    { value: 0.1667, label: "10 minutes (TEST)" },   // ← add this for testing
    { value: 1, label: "1 hour" },
    { value: 2, label: "2 hours" },
    { value: 3, label: "3 hours" },
    { value: 4, label: "4 hours" },
    { value: 6, label: "6 hours" },
    { value: 8, label: "8 hours" },
    { value: 24, label: "1 day" },
    { value: 48, label: "2 days" },
];

function departmentToTaskType(department: string) {
    return department.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

interface GeoLocation {
    country?: string;
    state?: string;
    city?: string;
    zipcode?: string;
    range?: string;
}

interface Creative {
    creative_name?: string;
    dimensions?: string;
    aspect_ratio?: string;
    file_size?: string;
    click_through_url?: string;
    appended_html_tag?: string;
    integration_code?: string;
    notes?: string;
    type?: string;
}

interface LineItem {
    line_item_id: string;
    line_item_name?: string;
    lineItemName?: string;
    start_date?: string;
    end_date?: string;
    ad_format?: string | string[];
    impressions?: string;
    units?: string;
    ctr?: string;
    viewability?: string;
    vcr?: string;
    kpi_notes?: string;
    unit_cost?: string;
    unit_value?: string;
    ethnicity?: string[];
    creatives?: Creative[];
    third_party_creatives?: Creative[];
    dv_id?: string;
    status?: 'live' | 'upcoming' | 'completed' | 'paused';
}

interface Campaign {
    id: number;
    campaign_id: string | null;
    ticket_id?: string | null;   // ← links this campaign back to its originating lead/ticket for task assignment
    approval_status?: 'pending' | 'approved';
    client_campaign_ID?: string;
    purchase_order_ID?: string;
    campaign_name: string;
    client_name: string;
    client?: string;
    client_id?: string;
    advertiser?: string;
    website_url?: string;
    campaign_type?: string;
    buying_type?: string;
    objective?: string;
    notes?: string;
    start_date?: string;
    end_date?: string;
    created_at: string;
    age?: string;
    gender?: string;
    platforms?: string;
    frequency_cap?: string;
    brand_safety?: string;
    geo_targeting?: GeoLocation[] | string;
    line_items?: LineItem[];
    new_cpm?: string | number;
    new_price?: string | number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isActiveCampaign(c: Campaign): boolean {
    if (!c.start_date || !c.end_date) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(c.start_date);
    const end = new Date(c.end_date); end.setHours(23, 59, 59, 999);
    return today >= start && today <= end;
}

function isClosedCampaign(c: Campaign): boolean {
    if (!c.end_date) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(c.end_date); end.setHours(23, 59, 59, 999);
    return today > end;
}

function fmtDate(v?: string) {
    if (!v) return "—";
    return new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}


function makeAssignmentKey() {
    return `as_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── StatCard — flat style matching Platform Overview cards ───────────────────
function StatCard({ label, value, changeLabel, changeType, active, onClick }: {
    label: string; value: number; changeLabel: string;
    changeType: "up" | "down" | "neutral"; active: boolean; onClick: () => void;
}) {
    return (
        <div
            onClick={onClick}
            className="db-stat-card"
            style={{
                cursor: "pointer",
                border: active ? "1px solid var(--text-muted)" : "2px solid transparent",
                transition: "border-color 0.15s",
            }}
        >
            <div className="db-stat-label">{label}</div>
            <div className="db-stat-value">{value}</div>
            <div
                className={`db-stat-change ${changeType === "neutral" ? "" : changeType}`}
                style={changeType === "neutral" ? { color: "var(--text-muted)" } : undefined}
            >
                {changeLabel}
            </div>
        </div>
    );
}
// ── Assign Task Modal — assign a campaign's work to multiple departments/roles/people at once ──
interface DepartmentRoleUsers {
    role_id: number;
    role_title: string;
    users: { id: number; username: string; email: string }[];
}

interface AssignmentRow {
    key: string;
    department: string | undefined;
    loadingDept: boolean;
    roles: DepartmentRoleUsers[];
    role_id: number | undefined;
    users: { id: number; username: string; email: string }[];
    user_id: number | undefined;
    deadline_hours: number | undefined;
}

function emptyAssignmentRow(): AssignmentRow {
    return { key: makeAssignmentKey(), department: undefined, loadingDept: false, roles: [], role_id: undefined, users: [], user_id: undefined, deadline_hours: undefined };
}

function AssignTaskModal({ campaign, open, onClose, onAssigned }: {
    campaign: Campaign | null; open: boolean; onClose: () => void; onAssigned: () => void;
}) {
    const [rows, setRows] = useState<AssignmentRow[]>([emptyAssignmentRow()]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) setRows([emptyAssignmentRow()]);
    }, [open, campaign?.id]);

    const updateRow = (key: string, patch: Partial<AssignmentRow>) => {
        setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
    };

    const addRow = () => setRows(prev => [...prev, emptyAssignmentRow()]);
    const removeRow = (key: string) => setRows(prev => prev.length > 1 ? prev.filter(r => r.key !== key) : prev);

    const handleDepartmentChange = async (key: string, department: string) => {
        updateRow(key, { department, loadingDept: true, roles: [], role_id: undefined, users: [], user_id: undefined });
        try {
            const res = await fetch(`${BASE_URL}/tasks/get_department_users/${encodeURIComponent(department)}/`, {
                headers: { "ngrok-skip-browser-warning": "1" },
            });
            if (!res.ok) throw new Error();
            const data: DepartmentRoleUsers[] = await res.json();
            updateRow(key, { roles: Array.isArray(data) ? data : [], loadingDept: false });
        } catch {
            updateRow(key, { roles: [], loadingDept: false });
            message.error(`Couldn't load roles/users for ${department}.`);
        }
    };

    const handleRoleChange = (key: string, role_id: number) => {
        const row = rows.find(r => r.key === key);
        const users = row?.roles.find(r => r.role_id === role_id)?.users ?? [];
        updateRow(key, { role_id, users, user_id: undefined });
    };

    const completeRows = rows.filter(r => r.department && r.role_id && r.user_id && r.deadline_hours);

    const handleSubmit = async () => {
        if (!campaign) return;
        if (!campaign.ticket_id) {
            message.error("This campaign has no linked ticket, so tasks can't be assigned yet.");
            return;
        }
        if (completeRows.length === 0) {
            message.warning("Fill in department, role, person and turnaround for at least one row.");
            return;
        }

        setSubmitting(true);
        const assignedById = localStorage.getItem("user_id");
        const results = await Promise.allSettled(
            completeRows.map(row =>
                fetch(`${BASE_URL}/tasks/assign_task/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                    body: JSON.stringify({
                        ticket_id: campaign.ticket_id,
                        task_type: departmentToTaskType(row.department!),
                        role_id: row.role_id,
                        user_id: row.user_id,
                        assigned_by_id: assignedById ? Number(assignedById) : undefined,
                        deadline_hours: row.deadline_hours,
                    }),
                }).then(res => {
                    if (!res.ok) throw new Error(row.department);
                    return row.department;
                })
            )
        );

        const succeeded = results.filter(r => r.status === "fulfilled").length;
        const failed = results.length - succeeded;

        setSubmitting(false);

        if (succeeded > 0) {
            message.success(`Task assigned to ${succeeded} department${succeeded !== 1 ? "s" : ""}.`);
            onAssigned();
        }
        if (failed > 0) {
            message.error(`${failed} assignment${failed !== 1 ? "s" : ""} failed. Please retry those rows.`);
        }
        if (failed === 0) onClose();
    };

    if (!campaign) return null;

    return (
        <Modal
            open={open} onCancel={onClose} footer={null} width={760} centered destroyOnClose
            closeIcon={
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.28)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, cursor: "pointer" }}>
                    <CloseOutlined style={{ fontSize: 13 }} />
                </div>
            }
            style={{ padding: 10, borderRadius: 16, overflow: "hidden" }}
            className="assign-task-modal"
        >
            <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "22px 28px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(79,70,229,0.25)", border: "1.5px solid rgba(79,70,229,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    <UsergroupAddOutlined style={{ color: "#93C5FD" }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Assign Task</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#93C5FD", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.campaign_name}</span>
                        {campaign.ticket_id ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#93C5FD", background: "rgba(147,197,253,0.15)", padding: "2px 9px", borderRadius: 12 }}>{campaign.ticket_id}</span>
                        ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#FCA5A5", background: "rgba(252,165,165,0.15)", padding: "2px 9px", borderRadius: 12 }}>No ticket linked</span>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ padding: "20px 28px", background: "var(--bg-page)", maxHeight: "56vh", overflowY: "auto" }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>
                    Split this campaign's work across departments — each row assigns one person in one department, with its own turnaround time.
                </p>

                {rows.map((row, idx) => (
                    <div key={row.key} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", background: "var(--bg-card)", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-light)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--accent)" }}>{idx + 1}</div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Department assignment</span>
                            </div>
                            {rows.length > 1 && (
                                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRow(row.key)} style={{ fontSize: 12 }} />
                            )}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Department</div>
                                <Select
                                    value={row.department}
                                    onChange={val => handleDepartmentChange(row.key, val)}
                                    placeholder="Select department…"
                                    style={{ width: "100%" }}
                                    options={TASK_DEPARTMENTS.map(d => ({ value: d, label: d }))}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Role</div>
                                <Select
                                    value={row.role_id}
                                    onChange={val => handleRoleChange(row.key, val)}
                                    placeholder={row.loadingDept ? "Loading…" : "Select role…"}
                                    style={{ width: "100%" }}
                                    loading={row.loadingDept}
                                    disabled={!row.department || row.loadingDept}
                                    options={row.roles.map(r => ({ value: r.role_id, label: r.role_title }))}
                                />
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Assign To</div>
                                <Select
                                    value={row.user_id}
                                    onChange={val => updateRow(row.key, { user_id: val })}
                                    placeholder={!row.role_id ? "Select role first" : "Select person…"}
                                    style={{ width: "100%" }}
                                    disabled={!row.role_id}
                                    options={row.users.map(u => ({ value: u.id, label: u.username || u.email }))}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Turnaround Time</div>
                                <Select
                                    value={row.deadline_hours}
                                    onChange={val => updateRow(row.key, { deadline_hours: val })}
                                    placeholder="Select turnaround…"
                                    style={{ width: "100%" }}
                                    suffixIcon={<ClockCircleOutlined />}
                                    options={TURNAROUND_OPTIONS}
                                />
                            </div>
                        </div>
                    </div>
                ))}

                <button
                    onClick={addRow}
                    style={{ width: "100%", padding: "10px", border: "1px dashed var(--accent)", borderRadius: 8, background: "none", cursor: "pointer", color: "var(--accent)", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                    <PlusOutlined /> Assign Another Department
                </button>
            </div>

            <div style={{ padding: "14px 28px", background: "var(--bg-card)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {completeRows.length} of {rows.length} row{rows.length !== 1 ? "s" : ""} ready
                </span>
                <div style={{ display: "flex", gap: 10 }}>
                    <Button onClick={onClose} style={{ height: 36, borderRadius: 8, border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>Cancel</Button>
                    <Button type="primary" loading={submitting} onClick={handleSubmit} icon={<UsergroupAddOutlined />}
                        style={{ height: 36, borderRadius: 8, background: "var(--accent)", borderColor: "var(--accent)", fontSize: 12, fontWeight: 700 }}>
                        {submitting ? "Assigning…" : "Assign Task"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message: msg, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
    const color = type === "success" ? "var(--green)" : "var(--red)";
    return (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1999, background: "var(--bg-card)", border: `1px solid ${color}`, borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow)" }}>
            <span style={{ fontSize: 18 }}>{type === "success" ? "✅" : "❌"}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{msg}</span>
        </div>
    );
}

// ── Inline DV ID Editor ───────────────────────────────────────────────────────
function DvIdCell({ lineItemId, initialValue }: { lineItemId: string; initialValue?: string }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(initialValue || "");
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${BASE_URL}/campaigns/update_line_item_dv_id/${lineItemId}/`, { method: "PATCH", headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" }, body: JSON.stringify({ dv_id: value }) });
            if (res.ok) setEditing(false);
            else alert("Failed to save DV ID");
        } catch { alert("Network error"); }
        finally { setSaving(false); }
    };

    if (editing) {
        return (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
                    style={{ height: 28, padding: "0 8px", borderRadius: 6, border: `1px solid var(--green)`, fontSize: 12, width: 120, outline: "none", background: "var(--green-bg)", color: "var(--green)" }}
                    placeholder="Enter DV ID" />
                <Button size="small" loading={saving} onClick={handleSave} style={{ height: 26, borderRadius: 6, fontSize: 11, background: "var(--green)", color: "#fff", border: "none", fontWeight: 600 }}>Save</Button>
                <Button size="small" onClick={() => { setEditing(false); setValue(initialValue || ""); }} style={{ height: 26, borderRadius: 6, fontSize: 11, border: `1px solid var(--green)`, color: "var(--green)" }}>✕</Button>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {value ? (
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", background: "var(--green-bg)", padding: "2px 8px", borderRadius: 6, border: `1px solid var(--green)` }}>{value}</span>
            ) : (
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
            )}
            <Button size="small" icon={<EditOutlined style={{ fontSize: 10 }} />} onClick={() => setEditing(true)}
                style={{ height: 22, width: 22, padding: 0, borderRadius: 5, border: `1px solid var(--border)`, background: "var(--bg-card)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }} />
        </div>
    );
}

function LineItemStatusCell({ lineItemId, initialStatus }: { lineItemId: string; initialStatus?: string }) {
    const [status, setStatus] = useState(initialStatus || 'upcoming');
    const [saving, setSaving] = useState(false);

    const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
        live: { color: 'var(--green)', bg: 'var(--green-bg)', label: '🟢 Live' },
        upcoming: { color: 'var(--amber)', bg: 'var(--amber-bg)', label: '🟡 Upcoming' },
        completed: { color: 'var(--red)', bg: 'var(--red-bg)', label: '🔴 Completed' },
        paused: { color: 'var(--accent)', bg: 'var(--accent-light)', label: '⏸ Paused' },
    };

    const handleChange = async (newStatus: string) => {
        setSaving(true);
        try {
            const res = await fetch(`${BASE_URL}/campaigns/update_line_item_status/${lineItemId}/`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }, body: JSON.stringify({ status: newStatus }) });
            if (res.ok) setStatus(newStatus);
            else alert('Failed to update status');
        } catch { alert('Network error'); }
        finally { setSaving(false); }
    };

    return (
        <Select value={status} onChange={handleChange} loading={saving} size="small" style={{ width: 130 }} styles={{ popup: { root: { minWidth: 130 } } }}>
            {Object.entries(statusConfig).map(([key, cfg]) => (
                <Option key={key} value={key}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '1px 7px' }}>{cfg.label}</span>
                </Option>
            ))}
        </Select>
    );
}

function InfoRow({ label, value, mono = false }: { label: string; value?: string | number | null; mono?: boolean }) {
    return (
        <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "9px 0", borderBottom: `1px solid var(--border)`,
        }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {label}
            </span>
            <span style={{
                fontSize: 12.5, color: mono ? "var(--blue)" : "var(--text-primary)",
                fontWeight: mono ? 700 : 500,
                maxWidth: "60%", textAlign: "right", wordBreak: "break-all",
            }}>
                {value || value === 0 ? value : "—"}
            </span>
        </div>
    );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 20 }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {title}
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
    );
}

function CampaignDetailModal({ campaign, open, onClose }: {
    campaign: Campaign | null; open: boolean; onClose: () => void;
}) {
    if (!campaign) return null;

    const campaignState = isActiveCampaign(campaign) ? "active" : isClosedCampaign(campaign) ? "closed" : "upcoming";
    const stateCfg = campaignState === "active"
        ? { color: "var(--green)", bg: "var(--green-bg)", label: "Active" }
        : campaignState === "closed"
            ? { color: "var(--red)", bg: "var(--red-bg)", label: "Closed" }
            : { color: "var(--amber)", bg: "var(--amber-bg)", label: "Upcoming" };

    const geoText = Array.isArray(campaign.geo_targeting)
        ? campaign.geo_targeting.map(g => [g.city, g.state, g.country].filter(Boolean).join(", ")).join(" | ")
        : campaign.geo_targeting;

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={820}
            centered
            destroyOnClose
            footer={null}
            closeIcon={<div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.28)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, cursor: "pointer" }}><CloseOutlined style={{ fontSize: 13 }} /></div>}
            style={{ padding: 10, borderRadius: 16, overflow: "hidden" }}
            className="campaign-detail-modal"
        >
            {/* Header */}
            <div style={{
                background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
                padding: "22px 28px 18px", display: "flex", alignItems: "center", gap: 14,
            }}>
                <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: "rgba(79,70,229,0.25)", border: "1.5px solid rgba(79,70,229,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                }}>📣</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {campaign.campaign_name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "#93C5FD" }}>{campaign.campaign_id || "No ID yet"}</span>
                        <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700,
                            padding: "3px 10px", borderRadius: 20, background: `${stateCfg.color}22`,
                            color: stateCfg.color, border: `1px solid ${stateCfg.color}`,
                            textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: stateCfg.color }} />
                            {stateCfg.label}
                        </span>
                        {campaign.ticket_id && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#93C5FD", background: "rgba(147,197,253,0.15)", padding: "2px 9px", borderRadius: 12 }}>
                                {campaign.ticket_id}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div style={{ padding: "8px 28px 20px", maxHeight: "66vh", overflowY: "auto", background: "var(--bg-page)" }}>

                <SectionTitle icon="🏢" title="Client & Advertiser" />
                <InfoRow label="Company" value={campaign.client_name} />
                <InfoRow label="Advertiser" value={campaign.advertiser} />
                <InfoRow label="Website URL" value={campaign.website_url} mono />

                <SectionTitle icon="📋" title="Campaign Information" />
                <InfoRow label="Client Campaign ID" value={campaign.client_campaign_ID} mono />
                <InfoRow label="Purchase Order ID" value={campaign.purchase_order_ID} mono />
                <InfoRow label="Campaign Type" value={campaign.campaign_type} />
                <InfoRow label="Objective" value={campaign.objective} />
                <InfoRow label="Buying Type" value={campaign.buying_type} />
                <InfoRow label="Notes" value={campaign.notes} />

                <SectionTitle icon="📅" title="Schedule" />
                <InfoRow label="Start Date" value={fmtDate(campaign.start_date)} />
                <InfoRow label="End Date" value={fmtDate(campaign.end_date)} />
                <InfoRow label="Created On" value={fmtDate(campaign.created_at)} />

                <SectionTitle icon="🎯" title="Audience & Targeting" />
                <InfoRow label="Age" value={campaign.age} />
                <InfoRow label="Gender" value={campaign.gender} />
                <InfoRow label="Platform / Inventory" value={campaign.platforms} />
                <InfoRow label="Geo Targeting" value={geoText as string} />

                <SectionTitle icon="💰" title="Final CPM & Price" />
                <InfoRow label="CPM" value={campaign.new_cpm} mono />
                <InfoRow label="Price" value={campaign.new_price} mono />

                <SectionTitle icon="📦" title={`Line Items (${campaign.line_items?.length ?? 0})`} />
                {(!campaign.line_items || campaign.line_items.length === 0) ? (
                    <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "8px 0" }}>No line items.</div>
                ) : (
                    campaign.line_items.map(li => (
                        <div key={li.line_item_id} style={{
                            border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px",
                            marginBottom: 10, background: "var(--bg-card)",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", background: "var(--amber-bg)", padding: "2px 8px", borderRadius: 6 }}>
                                    {li.line_item_id}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                    {li.line_item_name || li.lineItemName}
                                </span>
                            </div>
                            <InfoRow label="Ad Format" value={Array.isArray(li.ad_format) ? li.ad_format.join(", ") : li.ad_format} />
                            <InfoRow label="Impressions" value={li.impressions ? Number(li.impressions).toLocaleString("en-IN") : undefined} />
                            <InfoRow label="Units / Rate" value={li.units ? `${li.units} @ ${li.unit_value ?? "—"}` : undefined} />
                            <InfoRow label="Start – End" value={li.start_date && li.end_date ? `${fmtDate(li.start_date)} – ${fmtDate(li.end_date)}` : undefined} />
                            <InfoRow label="DV ID" value={li.dv_id} mono />
                            <InfoRow label="Status" value={li.status} />
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
}

// ── Assigned Members: types ───────────────────────────────────────────────
interface AssignmentHistoryEntry {
    id: number;
    role_title: string | null;
    assigned_to_name: string | null;
    assigned_at: string | null;
    due_at: string | null;
    status: string;
}

// ticket_id -> task_type(department slug) -> entries
type AssignmentHistoryMap = Record<string, Record<string, AssignmentHistoryEntry[]>>;

// Full set of departments shown as sub-columns (mirrors your Excel sheet + TASK_DEPARTMENTS)
const ASSIGNED_MEMBERS_DEPARTMENTS = [
    "Creative Ops",
    "Campaign Ops",
    "Finance",
    "HR",
    "Ad Ops",
    "Design",
    "Tech Team",
];

function fmtDateTimeShort(v?: string | null) {
    if (!v) return "—";
    return new Date(v).toLocaleString("en-GB", {
        day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit",
    });
}
// ── Main Component ────────────────────────────────────────────────────────────
export default function All_Campaigns() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [cardFilter, setCardFilter] = useState<"all" | "active" | "closed">("all");
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [assignCampaign, setAssignCampaign] = useState<Campaign | null>(null);
    const [viewCampaign, setViewCampaign] = useState<Campaign | null>(null);

    const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistoryMap>({});
    const [historyModal, setHistoryModal] = useState<{ ticketId: string; department: string; entries: AssignmentHistoryEntry[] } | null>(null);

    const fetchAssignmentHistory = useCallback((campaignList: Campaign[]) => {
        const ticketIds = campaignList.filter(c => c.ticket_id).map(c => c.ticket_id as string);
        if (ticketIds.length === 0) { setAssignmentHistory({}); return; }
        fetch(`${BASE_URL}/tasks/get_assignment_history_for_tickets/?ticket_ids=${ticketIds.join(",")}`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then(r => r.json())
            .then((data: AssignmentHistoryMap) => setAssignmentHistory(data || {}))
            .catch(() => setAssignmentHistory({}));
    }, []);

    // update fetchCampaigns to also pull history
    const fetchCampaigns = useCallback(() => {
        setLoading(true);
        fetch(`${BASE_URL}/campaigns/get_campaigns/`, { headers: { "ngrok-skip-browser-warning": "1" } })
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(data => {
                const list: Campaign[] = Array.isArray(data) ? data : Array.isArray(data?.campaigns) ? data.campaigns : [];
                setCampaigns(list);
                fetchAssignmentHistory(list);   // ← added
            })
            .catch(() => { setCampaigns([]); setToast({ message: "Failed to load campaigns.", type: "error" }); })
            .finally(() => setLoading(false));
    }, [fetchAssignmentHistory]);

    useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

    function AssignedMembersCell({
        ticketId, department, entries, onShowMore,
    }: {
        ticketId: string; department: string; entries: AssignmentHistoryEntry[];
        onShowMore: (ticketId: string, department: string, entries: AssignmentHistoryEntry[]) => void;
    }) {
        if (!entries || entries.length === 0) {
            return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>;
        }

        const visible = entries.slice(0, 1);
        const remaining = entries.length - visible.length;

        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0" }}>
                {visible.map(e => (
                    <div key={e.id} style={{ fontSize: 11, lineHeight: 1.5 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--green)", background: "var(--green-bg)", border: `1px solid var(--green)`, borderRadius: 6, paddingLeft: "2px" }}>
                            {e.role_title || "—"} : {e.assigned_to_name || "—"}
                        </div>
                        <div style={{ color: "var(--text-muted)" }}>
                            Assigned: {fmtDateTimeShort(e.assigned_at)}
                        </div>
                        <div style={{ color: "var(--text-muted)" }}>
                            Due: {fmtDateTimeShort(e.due_at)}
                        </div>
                    </div>
                ))}
                {remaining > 0 && (
                    <span
                        onClick={() => onShowMore(ticketId, department, entries)}
                        style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", cursor: "pointer" }}
                    >
                        +{remaining} more…
                    </span>
                )}
            </div>
        );
    }

    function AssignmentHistoryModal({ data, onClose }: {
        data: { ticketId: string; department: string; entries: AssignmentHistoryEntry[] } | null;
        onClose: () => void;
    }) {
        if (!data) return null;

        const statusCfg: Record<string, { color: string; bg: string }> = {
            pending: { color: "var(--amber)", bg: "var(--amber-bg)" },
            in_progress: { color: "var(--blue)", bg: "var(--blue-bg)" },
            completed: { color: "var(--green)", bg: "var(--green-bg)" },
            cancelled: { color: "var(--red)", bg: "var(--red-bg)" },
            reassigned: { color: "var(--text-muted)", bg: "var(--bg-page)" },
        };

        return (
            <Modal
                open={!!data} onCancel={onClose} footer={null} width={520} centered destroyOnClose
                title={`${data.department} — ${data.ticketId}`}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "60vh", overflowY: "auto" }}>
                    {data.entries.map(e => {
                        const s = statusCfg[e.status] ?? { color: "var(--text-muted)", bg: "var(--bg-page)" };
                        return (
                            <div key={e.id} style={{
                                border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px",
                                background: "var(--bg-card)",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>
                                        {e.role_title || "—"} : {e.assigned_to_name || "—"}
                                    </span>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, color: s.color, background: s.bg,
                                        border: `1px solid ${s.color}`, padding: "2px 8px", borderRadius: 6,
                                        textTransform: "capitalize",
                                    }}>
                                        {e.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                    Assigned: {fmtDateTimeShort(e.assigned_at)} · Due: {fmtDateTimeShort(e.due_at)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Modal>
        );
    }

    const totalCount = campaigns.length;
    const activeCount = campaigns.filter(isActiveCampaign).length;
    const closedCount = campaigns.filter(isClosedCampaign).length;
    const uniqueTypes = [...new Set(campaigns.map(c => c.campaign_type).filter(Boolean))] as string[];

    const filtered = campaigns.filter(c => {
        if (cardFilter === "active" && !isActiveCampaign(c)) return false;
        if (cardFilter === "closed" && !isClosedCampaign(c)) return false;
        if (typeFilter !== "all" && c.campaign_type !== typeFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            const match = [c.campaign_name, c.campaign_id, c.client_campaign_ID, c.client_name, c.advertiser].some(f => f?.toLowerCase().includes(q));
            if (!match) return false;
        }
        return true;
    });

    const columns: ColumnsType<Campaign> = [
        {
            title: "Ticket ID", dataIndex: "ticket_id", key: "ticket_id", width: 140, fixed: "left",
            render: (id: string | null) =>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", background: "var(--blue-bg)", border: "1px solid var(--blue)", padding: "2px 10px", borderRadius: 6, display: "inline-block", whiteSpace: "nowrap" }}>{id}</span>
        },
        { title: "Client Campaign ID", dataIndex: "client_campaign_ID", key: "client_campaign_ID", width: 160, render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{v || "—"}</span> },
        { title: "Purchase Order ID", dataIndex: "purchase_order_ID", key: "purchase_order_ID", width: 160, render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{v || "—"}</span> },
        { title: "Campaign Name", dataIndex: "campaign_name", key: "campaign_name", width: 200, render: (name: string) => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{name || "—"}</span> },
        { title: "Advertiser", dataIndex: "advertiser", key: "advertiser", width: 160, render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{v || "—"}</span> },
        { title: "Company", dataIndex: "client_name", key: "client_name", width: 160, render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{v || "—"}</span> },
        {
            title: "Type", dataIndex: "campaign_type", key: "campaign_type", width: 150,
            render: (v: string) => v ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--purple)", background: "var(--purple-bg)", padding: "3px 9px", borderRadius: 6, display: "inline-block", whiteSpace: "nowrap" }}>{v}</span>
            ) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>,
        },
        { title: "Objective", dataIndex: "objective", key: "objective", width: 180, render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{v || "—"}</span> },
        { title: "Buying Type", dataIndex: "buying_type", key: "buying_type", width: 180, render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{v || "—"}</span> },
        { title: "Start Date", dataIndex: "start_date", key: "start_date", width: 100, render: (v: string) => v ? <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{fmtDate(v)}</span> : <span style={{ color: "var(--text-muted)" }}>—</span> },
        { title: "End Date", dataIndex: "end_date", key: "end_date", width: 100, render: (v: string) => v ? <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{fmtDate(v)}</span> : <span style={{ color: "var(--text-muted)" }}>—</span> },
        {
            title: "Campaign State", key: "campaign_state", width: 140,
            render: (_: any, record: Campaign) => {
                const isActive = isActiveCampaign(record);
                const isClosed = isClosedCampaign(record);
                const cfg = isActive
                    ? { color: "var(--green)", background: "var(--green-bg)", label: "Active" }
                    : isClosed
                        ? { color: "var(--red)", background: "var(--red-bg)", label: "Closed" }
                        : { color: "var(--amber)", background: "var(--amber-bg)", label: "Upcoming" };
                return (
                    <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 20,
                        background: cfg.background,           // ← fixed: use the valid token
                        border: `1px solid ${cfg.color}`,
                        fontSize: 10, fontWeight: 700, color: cfg.color,
                        letterSpacing: "0.06em", textTransform: "uppercase",
                    }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color }} />
                        {cfg.label}
                    </span>
                );
            },
        },
        {
            title: "Line Items", key: "line_items", width: 100,
            render: (_: any, record: Campaign) => (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--blue)", background: "var(--blue-bg)", padding: "3px 9px", borderRadius: 6, display: "inline-block", whiteSpace: "nowrap" }}>
                    {record.line_items?.length ?? 0} item{(record.line_items?.length ?? 0) !== 1 ? "s" : ""}
                </span>
            ),
        },
        { title: "Created", dataIndex: "created_at", key: "created_at", width: 130, render: (v: string) => v ? <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>{fmtDate(v)}</span> : <span style={{ color: "var(--text-muted)" }}>—</span> },
        {
            title: "Actions", key: "actions", width: 200, fixed: "right",
            render: (_: any, record: Campaign) => (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => setViewCampaign(record)}
                        style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", background: "var(--accent-light)", border: `1px solid var(--border-strong)`, borderRadius: 6 }}>View</Button>                    <Button
                            size="small"
                            icon={<UsergroupAddOutlined />}
                            onClick={() => setAssignCampaign(record)}
                            disabled={!record.ticket_id}
                            title={!record.ticket_id ? "No ticket linked to this campaign" : "Assign to departments"}
                            style={{ fontSize: 11, fontWeight: 600, color: "var(--purple)", background: "var(--purple-bg)", border: `1px solid var(--purple)`, borderRadius: 6 }}
                        >
                        Assign Task
                    </Button>
                </div>
            ),
        },
        {
            title: "Assigned Members",
            key: "assigned_members_group",
            children: ASSIGNED_MEMBERS_DEPARTMENTS.map(dept => ({
                title: dept,
                key: `assigned_${departmentToTaskType(dept)}`,
                width: 190,
                render: (_: any, record: Campaign) => {
                    if (!record.ticket_id) return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>;
                    const entries = assignmentHistory[record.ticket_id]?.[departmentToTaskType(dept)] || [];
                    return (
                        <AssignedMembersCell
                            ticketId={record.ticket_id}
                            department={dept}
                            entries={entries}
                            onShowMore={(ticketId, department, entries) => setHistoryModal({ ticketId, department, entries })}
                        />
                    );
                },
            })),
        },
    ];

    const lineItemColumns: ColumnsType<LineItem> = [
        { title: "Line Item ID", dataIndex: "line_item_id", key: "line_item_id", render: (v: string) => <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", background: "var(--amber-bg)", padding: "2px 6px", borderRadius: 6 }}>{v}</span> },
        { title: "DV ID", key: "dv_id", width: 150, render: (_: any, record: LineItem) => <DvIdCell lineItemId={record.line_item_id} initialValue={record.dv_id || ""} /> },
        { title: "Name", dataIndex: "line_item_name", width: 150, key: "line_item_name", render: (v: string) => <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{v || "—"}</span> },
        { title: "Status", key: "status", width: 150, render: (_: any, record: LineItem) => <LineItemStatusCell lineItemId={record.line_item_id} initialStatus={record.status || "upcoming"} /> },
        { title: "Start Date", dataIndex: "start_date", key: "start_date", width: 100, render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{v || "—"}</span> },
        { title: "End Date", dataIndex: "end_date", key: "end_date", width: 100, render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{v || "—"}</span> },
        {
            title: "Ad Format", dataIndex: "ad_format", key: "ad_format",
            render: (v: string | string[]) => {
                const formats = Array.isArray(v) ? v : (v ? [v] : []);
                return formats.length > 0 ? formats.map((f: string) => (
                    <span key={f} style={{ fontSize: 10, fontWeight: 600, color: "var(--blue)", background: "var(--blue-bg)", padding: "2px 7px", borderRadius: 5, marginRight: 4, display: "inline-block" }}>{f}</span>
                )) : <span style={{ color: "var(--text-muted)" }}>—</span>;
            },
        },
        { title: "Impressions", dataIndex: "impressions", key: "impressions", render: (v: string) => <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{v ? Number(v).toLocaleString("en-IN") : "—"}</span> },
    ];

    return (
        <div>
            {/* ── Page Header ── */}
            <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 8,
            }}>
                <div>
                    <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                        All Campaigns
                    </h1>
                    <p style={{ fontSize: 9, color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        MANAGE & TRACK ALL CLIENT CAMPAIGNS
                    </p>
                </div>
            </div>

            {/* ── Stat Cards — flat style matching Platform Overview ── */}
            <div className="db-stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <StatCard
                    label="Total Campaigns"
                    value={totalCount}
                    changeLabel={`${activeCount} active now`}
                    changeType="up"
                    active={cardFilter === "all"}
                    onClick={() => setCardFilter("all")}
                />
                <StatCard
                    label="Active Campaigns"
                    value={activeCount}
                    changeLabel="Currently running"
                    changeType="up"
                    active={cardFilter === "active"}
                    onClick={() => setCardFilter(cardFilter === "active" ? "all" : "active")}
                />
                <StatCard
                    label="Closed Campaigns"
                    value={closedCount}
                    changeLabel={closedCount > 0 ? "Past end date" : "None closed"}
                    changeType={closedCount > 0 ? "down" : "neutral"}
                    active={cardFilter === "closed"}
                    onClick={() => setCardFilter(cardFilter === "closed" ? "all" : "closed")}
                />
            </div>

            {cardFilter !== "all" && (
                <div style={{ marginBottom: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Filtered by:</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 12px", borderRadius: 5, background: cardFilter === "active" ? "var(--green-bg)" : "var(--red-bg)", border: `1px solid ${cardFilter === "active" ? "var(--green)" : "var(--red)"}`, fontSize: 9, fontWeight: 600, color: cardFilter === "active" ? "var(--green)" : "var(--red)" }}>
                        {cardFilter === "active" ? "Active Campaigns" : "Closed Campaigns"}
                        <button onClick={() => setCardFilter("all")} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 8, padding: 0 }}>✕</button>
                    </span>
                </div>
            )}

            {/* ── Search Bar ── */}
            <div style={{ marginBottom: 16, marginTop: 4, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Input placeholder="Search by name, ID, advertiser, company…"
                    prefix={<SearchOutlined style={{ color: "var(--text-muted)" }} />}
                    value={search} onChange={e => setSearch(e.target.value)} allowClear
                    style={{ flex: 1, minWidth: 240, height: 36, background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 180, height: 36 }}>
                    <Option value="all">All Types</Option>
                    {uniqueTypes.map(t => <Option key={t} value={t}>{t}</Option>)}
                </Select>
                <Button
                    onClick={fetchCampaigns}
                    icon={<ReloadOutlined />}
                    style={{
                        height: 36,
                        borderRadius: 8,
                        border: "1px solid var(--text-muted)",
                        background: "var(--bg-input)",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        paddingInline: 14,
                        transition: "background 0.15s, color 0.15s, border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--accent-light)";
                        e.currentTarget.style.color = "var(--accent)";
                        e.currentTarget.style.borderColor = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--bg-input)";
                        e.currentTarget.style.color = "var(--text-secondary)";
                        e.currentTarget.style.borderColor = "var(--border)";
                    }}
                >
                    Refresh
                </Button>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{filtered.length} of {campaigns.length} campaigns</span>
            </div>

            {/* ── Table ── */}
            <div style={{ background: "var(--bg-card)", borderRadius: 14, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
                <Table
                    columns={columns} dataSource={filtered} rowKey="id" loading={loading}
                    scroll={{ x: 2200 }}
                    pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50"], showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} campaigns`, style: { padding: "12px 16px" } }}
                    expandable={{
                        expandedRowRender: (record: Campaign) => {
                            if (!record.line_items || record.line_items.length === 0) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>No line items.</span>;
                            return (
                                <div style={{ padding: "8px 0" }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, display: "block" }}>Line Items ({record.line_items.length})</span>
                                    <Table size="small" dataSource={record.line_items} rowKey="line_item_id" pagination={false} columns={lineItemColumns} style={{ background: "var(--bg-page)", borderRadius: 8 }} />
                                </div>
                            );
                        },
                        rowExpandable: () => true,
                    }}
                    rowClassName={(record) => isClosedCampaign(record) ? "all-campaigns-row all-campaigns-row-closed" : "all-campaigns-row"}
                    style={{ fontSize: 13 }}
                />
            </div>

            <AssignTaskModal campaign={assignCampaign} open={!!assignCampaign} onClose={() => setAssignCampaign(null)} onAssigned={fetchCampaigns} />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <CampaignDetailModal campaign={viewCampaign} open={!!viewCampaign} onClose={() => setViewCampaign(null)} />
            <AssignmentHistoryModal data={historyModal} onClose={() => setHistoryModal(null)} />
            <style>{`
                .all-campaigns-row:hover td { background: var(--bg-card-hover) !important; }
                .all-campaigns-row-closed td { opacity: 0.75; }
                .edit-campaign-modal .ant-modal-content { padding: 0 !important; border-radius: 16px !important; overflow: hidden !important; border: none !important; }
                .edit-campaign-modal .ant-modal-header { display: none !important; }
                .edit-campaign-modal .ant-modal-close { display: none !important; }
                .edit-campaign-modal .ant-modal-body { padding: 0 !important; }
                .assign-task-modal .ant-modal-content { padding: 0 !important; border-radius: 16px !important; overflow: hidden !important; border: none !important; }
                .assign-task-modal .ant-modal-header { display: none !important; }
                .assign-task-modal .ant-modal-close { display: none !important; }
                .assign-task-modal .ant-modal-body { padding: 0 !important; }
                .campaign-detail-modal .ant-modal-content { padding: 0 !important; border-radius: 16px !important; overflow: hidden !important; border: none !important; }
.campaign-detail-modal .ant-modal-header { display: none !important; }
.campaign-detail-modal .ant-modal-close { display: none !important; }
.campaign-detail-modal .ant-modal-body { padding: 0 !important; }
            `}</style>
        </div>
    );
}