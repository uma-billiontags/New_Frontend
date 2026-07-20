import { useEffect, useState, useCallback } from "react";
import { Table, Button, Input, Modal } from "antd";
import {
    SearchOutlined, ReloadOutlined, EyeOutlined,
    MailOutlined, LinkOutlined, CloseOutlined, PaperClipOutlined,
    RocketOutlined, CheckCircleOutlined
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const BASE_URL = import.meta.env.VITE_BASE_URL;

interface LeadAttachment {
    id: number;
    filename: string;
    mime_type: string;
    size: number;
    download_url: string;
}

interface Lead {
    id: number;
    sender: string;
    receiver: string;
    subject: string;
    body: string;
    thread_id: string;
    mail_link: string;
    received_at: string;
    created_at: string;
    category_status: "category" | "uncategory";
    category_name: string | null;
    attachments: LeadAttachment[];
    ticket_id: string | null;
    client_id: number | null;
    task_status?: string | null;
    assigned_at?: string | null;
    has_campaign?: boolean;   // ← ADD THIS
}

// ── Helpers (same as Leads.tsx) ───────────────────────────────────────────────
function fmtDateTime(v?: string) {
    if (!v) return "—";
    return new Date(v).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function truncate(text: string, len: number) {
    if (!text) return "—";
    return text.length > len ? text.slice(0, len) + "…" : text;
}

function parseSender(raw: string): { name: string; email: string } {
    if (!raw) return { name: "—", email: "" };
    const match = raw.match(/^(.*?)\s*<(.+)>\s*$/);
    if (match) return { name: match[1].trim() || match[2], email: match[2].trim() };
    return raw.includes("@") ? { name: raw, email: raw } : { name: raw, email: "" };
}

function fmtFileSize(bytes?: number) {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SenderCell({ raw, variant = "sender" }: { raw: string; variant?: "sender" | "receiver" }) {
    const { name, email } = parseSender(raw);
    const showBadge = !!email;
    const color = variant === "sender" ? "var(--blue)" : "var(--green)";
    const bg = variant === "sender" ? "var(--blue-bg)" : "var(--green-bg)";
    return (
        <div style={{ lineHeight: 1.4 }}>
            {showBadge ? (
                <div style={{
                    fontSize: 11, fontWeight: 700, color, background: bg,
                    border: `1px solid ${color}`,
                    padding: "2px 10px", borderRadius: 6, display: "inline-block", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
                }}>
                    {email}
                </div>
            ) : (
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{name}</div>
            )}
        </div>
    );
}

function CategoryBadge({ status, name }: { status: string; name: string | null }) {
    if (status === "category" && name) {
        return (
            <span style={{
                fontSize: 11, fontWeight: 700, color: "var(--purple)",
                background: "var(--purple-bg)",
                padding: "3px 10px", borderRadius: 6, display: "inline-block", whiteSpace: "nowrap",
            }}>
                {name}
            </span>
        );
    }
    return (
        <span style={{
            fontSize: 11, fontWeight: 600, color: "var(--amber)",
            background: "var(--amber-bg)",
            padding: "3px 10px", borderRadius: 6, display: "inline-block",
        }}>
            Uncategorized
        </span>
    );
}

// ── Task status badge — pending / in_progress / completed ────────────────────
function TaskStatusBadge({ status }: { status?: string | null }) {
    if (!status) return <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>;
    const map: Record<string, { color: string; bg: string; label: string }> = {
        pending: { color: "var(--amber)", bg: "var(--amber-bg)", label: "Pending" },
        in_progress: { color: "var(--blue)", bg: "var(--blue-bg)", label: "In Progress" },
        completed: { color: "var(--green)", bg: "var(--green-bg)", label: "Completed" },
        cancelled: { color: "var(--red)", bg: "var(--red-bg)", label: "Cancelled" },
    };
    const s = map[status] ?? { color: "var(--text-muted)", bg: "var(--bg-page)", label: status };
    return (
        <span style={{
            fontSize: 11, fontWeight: 700, color: s.color, background: s.bg,
            border: `1px solid ${s.color}`, padding: "2px 10px", borderRadius: 6,
            display: "inline-block", whiteSpace: "nowrap",
        }}>
            {s.label}
        </span>
    );
}

function AttachmentList({ attachments }: { attachments: LeadAttachment[] }) {
    if (!attachments?.length) return <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {attachments.map((a) => (
                <a key={a.id} href={a.download_url} target="_blank" rel="noopener noreferrer" download={a.filename}
                    title={`${a.filename}${a.size ? ` (${fmtFileSize(a.size)})` : ""}`}
                    style={{
                        fontSize: 12, color: "var(--accent)", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                        display: "inline-flex", alignItems: "center", gap: 4, maxWidth: 220,
                    }}>
                    <PaperClipOutlined style={{ fontSize: 11, flexShrink: 0 }} />
                    {truncate(a.filename, 20)}
                </a>
            ))}
        </div>
    );
}

function StatCard({ label, value, changeLabel, changeType }: {
    label: string; value: number; changeLabel: string; changeType: "up" | "down" | "neutral";
}) {
    return (
        <div className="db-stat-card" style={{ border: "2px solid transparent" }}>
            <div className="db-stat-label">{label}</div>
            <div className="db-stat-value">{value}</div>
            <div className={`db-stat-change ${changeType === "neutral" ? "" : changeType}`}
                style={changeType === "neutral" ? { color: "var(--text-muted)" } : undefined}>
                {changeLabel}
            </div>
        </div>
    );
}

function Toast({ message: msg, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
    const color = type === "success" ? "var(--green)" : "var(--red)";
    return (
        <div style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 1999,
            background: "var(--bg-card)", border: `1px solid ${color}`, borderRadius: 12,
            padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow)",
        }}>
            <span style={{ fontSize: 18 }}>{type === "success" ? "✅" : "❌"}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{msg}</span>
        </div>
    );
}

function LeadDetailModal({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
    if (!lead) return null;
    return (
        <Modal
            open={!!lead} onCancel={onClose} footer={null} width={680} centered destroyOnClose
            closeIcon={
                <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.28)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 14, cursor: "pointer",
                }}>
                    <CloseOutlined style={{ fontSize: 13 }} />
                </div>
            }
            style={{ padding: 10, borderRadius: 16, overflow: "hidden" }}
            className="lead-detail-modal"
        >
            <div style={{
                background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
                padding: "22px 28px 18px", display: "flex", alignItems: "flex-start", gap: 14,
            }}>
                <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: "rgba(79,70,229,0.25)", border: "1.5px solid rgba(79,70,229,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0,
                }}>
                    <MailOutlined style={{ color: "#93C5FD" }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                        fontSize: 16, fontWeight: 800, color: "#fff",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                        {lead.subject || "(No subject)"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: "#93C5FD", fontWeight: 600 }}>
                            {parseSender(lead.sender).name}
                        </span>
                        {lead.category_status === "category" && lead.category_name && (
                            <span style={{
                                fontSize: 10, fontWeight: 700, color: "#93C5FD",
                                background: "rgba(147,197,253,0.15)", padding: "2px 9px",
                                borderRadius: 12, textTransform: "uppercase", letterSpacing: "0.04em",
                            }}>
                                {lead.category_name}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ padding: "20px 28px", background: "var(--bg-page)", maxHeight: "56vh", overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>From</div>
                        <SenderCell raw={lead.sender} variant="sender" />
                    </div>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>To</div>
                        <SenderCell raw={lead.receiver} variant="receiver" />
                    </div>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Received At</div>
                        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{fmtDateTime(lead.received_at)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Thread ID</div>
                        <span style={{
                            fontSize: 11, fontWeight: 700, color: "var(--blue)",
                            background: "var(--blue-bg)", border: "1px solid var(--blue)",
                            padding: "2px 8px", borderRadius: 6, display: "inline-block",
                        }}>
                            {lead.thread_id}
                        </span>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Category</div>
                        <CategoryBadge status={lead.category_status} name={lead.category_name} />
                    </div>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Attachments</div>
                        <AttachmentList attachments={lead.attachments} />
                    </div>
                </div>

                <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        Message Body
                    </div>
                    <div style={{
                        fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6,
                        whiteSpace: "pre-wrap", background: "var(--bg-card)",
                        border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px",
                    }}>
                        {lead.body || "—"}
                    </div>
                </div>
            </div>

            <div style={{
                padding: "14px 28px", background: "var(--bg-card)", borderTop: "1px solid var(--border)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Added {fmtDateTime(lead.created_at)}</span>
                <div style={{ display: "flex", gap: 10 }}>
                    {lead.mail_link && (
                        <a href={lead.mail_link} target="_blank" rel="noopener noreferrer">
                            <Button icon={<LinkOutlined />} style={{
                                height: 36, borderRadius: 8, fontSize: 12, fontWeight: 700,
                                color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-light)",
                            }}>
                                Open Mail
                            </Button>
                        </a>
                    )}
                    <Button onClick={onClose} style={{ height: 36, borderRadius: 8, border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Leads_Account_Manager() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const showToast = (message: string, type: "success" | "error" = "success") => setToast({ message, type });

    const fetchMyLeads = useCallback(() => {
        const userId = localStorage.getItem("user_id");
        if (!userId) { setLeads([]); setLoading(false); return; }
        setLoading(true);
        fetch(`${BASE_URL}/tasks/get_my_leads/?user_id=${userId}&task_type=lead_handling`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => {
                if (!r.ok) throw new Error();
                return r.json();
            })
            .then((data) => setLeads(Array.isArray(data) ? data : []))
            .catch(() => {
                setLeads([]);
                showToast("Failed to load your assigned leads.", "error");
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchMyLeads(); }, [fetchMyLeads]);

    const totalCount = leads.length;
    const pendingCount = leads.filter((l) => l.task_status === "pending").length;
    const inProgressCount = leads.filter((l) => l.task_status === "in_progress").length;
    const completedCount = leads.filter((l) => l.task_status === "completed").length;

    const filtered = leads.filter((l) => {
        const q = search.toLowerCase();
        return (
            !q ||
            l.sender?.toLowerCase().includes(q) ||
            l.subject?.toLowerCase().includes(q) ||
            l.thread_id?.toLowerCase().includes(q) ||
            l.ticket_id?.toLowerCase().includes(q) ||
            l.body?.toLowerCase().includes(q)
        );
    });

    const handleCreateCampaign = (lead: Lead) => {
        const params = new URLSearchParams();
        if (lead.ticket_id) params.set("ticketId", lead.ticket_id);
        if (lead.client_id) params.set("clientId", String(lead.client_id));
        window.open(`/account_manager/campaign_create_leads?${params.toString()}`, "_blank");
    };

    const columns: ColumnsType<Lead> = [
        {
            title: "Ticket ID", dataIndex: "ticket_id", key: "ticket_id", width: 130,
            render: (v: string | null) =>
                v ? (
                    <span style={{
                        fontSize: 11, fontWeight: 700, color: "var(--blue)",
                        background: "var(--blue-bg)", border: "1px solid var(--blue)",
                        padding: "2px 10px", borderRadius: 6, display: "inline-block", whiteSpace: "nowrap",
                    }}>{v}</span>
                ) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}> — </span>,
        },
        {
            title: "Client ID", dataIndex: "client_id", key: "client_id", width: 120,
            render: (v: number | null) => v
                ? <span style={{
                    fontSize: 11, fontWeight: 700, color: "var(--green)",
                    background: "var(--green-bg)", border: "1px solid var(--green)",
                    padding: "2px 10px", borderRadius: 6, display: "inline-block",
                }}>{v}</span>
                : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>,
        },
        {
            title: "Category", key: "category", width: 180,
            render: (_: any, record: Lead) => <CategoryBadge status={record.category_status} name={record.category_name} />,
        },
        {
            title: "Task Status", key: "task_status", width: 130,
            render: (_: any, record: Lead) => <TaskStatusBadge status={record.task_status} />,
        },
        {
            title: "Subject", dataIndex: "subject", key: "subject", width: 240,
            render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{truncate(v, 60)}</span>,
        },
        {
            title: "Body Preview", dataIndex: "body", key: "body", width: 240,
            render: (v: string) => <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{truncate(v?.replace(/\s+/g, " "), 70)}</span>,
        },
        {
            title: "Sender", dataIndex: "sender", key: "sender", width: 220,
            render: (v: string) => <SenderCell raw={v} variant="sender" />,
        },
        {
            title: "Attachments", key: "attachments", width: 180,
            render: (_: any, record: Lead) => <AttachmentList attachments={record.attachments} />,
        },
        {
            title: "Received At", dataIndex: "received_at", key: "received_at", width: 160,
            render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{fmtDateTime(v)}</span>,
        },
        {
            title: "Actions", key: "actions", width: 240, fixed: "right",
            render: (_: any, record: Lead) => (
                <div style={{ display: "flex", gap: 6 }}>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedLead(record)}
                        style={{
                            fontSize: 11, fontWeight: 600, color: "var(--text-primary)",
                            background: "var(--accent-light)", border: "1px solid var(--border-strong)", borderRadius: 6,
                        }}>
                        View
                    </Button>
                    {record.has_campaign ? (
                        <Button size="small" disabled icon={<CheckCircleOutlined />}
                            style={{
                                fontSize: 11, fontWeight: 600, borderRadius: 6,
                                color: "var(--green)", background: "var(--green-bg)",
                                border: "1px solid var(--green)", opacity: 1,
                            }}>
                            Campaign Created
                        </Button>
                    ) : (
                        <Button size="small" type="primary" icon={<RocketOutlined />} onClick={() => handleCreateCampaign(record)}
                            style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, color: "var(--green)", background: "var(--green-bg)", border: "1px solid var(--green)", opacity: 1,}}>
                            Create Campaign
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div>
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 8,
            }}>
                <div>
                    <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>Leads</h1>
                    <p style={{
                        fontSize: 9, color: "var(--text-muted)", margin: "4px 0 0",
                        fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>
                        Leads assigned to you
                    </p>
                </div>
            </div>

            <div className="db-stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                <StatCard label="Total Assigned" value={totalCount} changeLabel="All your leads" changeType="neutral" />
                <StatCard label="Pending" value={pendingCount} changeLabel={pendingCount > 0 ? "Needs action" : "None pending"} changeType={pendingCount > 0 ? "down" : "neutral"} />
                <StatCard label="In Progress" value={inProgressCount} changeLabel="Being worked on" changeType="neutral" />
                <StatCard label="Completed" value={completedCount} changeLabel="Wrapped up" changeType={completedCount > 0 ? "up" : "neutral"} />
            </div>

            <div style={{
                background: "var(--bg-card)", borderRadius: 12, padding: "14px 18px",
                border: "1px solid var(--border)", marginBottom: 16, marginTop: 12,
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            }}>
                <Input
                    placeholder="Search by sender, subject, ticket ID…"
                    prefix={<SearchOutlined style={{ color: "var(--text-muted)" }} />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                    style={{ flex: 1, minWidth: 240, height: 36 }}
                />
                <Button onClick={fetchMyLeads} icon={<ReloadOutlined />} className="db-card-action"
                    style={{ height: 36, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, paddingInline: 14 }}>
                    Refresh
                </Button>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {filtered.length} of {leads.length} leads
                </span>
            </div>

            <div style={{
                background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)",
                overflow: "hidden", boxShadow: "var(--shadow-card)",
            }}>
                <Table
                    columns={columns}
                    dataSource={filtered}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1560 }}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50"],
                        showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} leads`,
                        style: { padding: "12px 16px" },
                    }}
                    rowClassName={() => "client-table-row"}
                    style={{ fontSize: 13 }}
                />
            </div>

            <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <style>{`
                .lead-detail-modal .ant-modal-content { padding: 0 !important; border-radius: 16px !important; overflow: hidden !important; border: none !important; }
                .lead-detail-modal .ant-modal-header { display: none !important; }
                .lead-detail-modal .ant-modal-close { display: none !important; }
                .lead-detail-modal .ant-modal-body { padding: 0 !important; }
            `}</style>
        </div>
    );
}