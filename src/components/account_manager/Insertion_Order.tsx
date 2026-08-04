import { useEffect, useState, useCallback } from "react";
import { Table, Button, Input, Tag, Tooltip, Modal } from "antd";
import {
    SearchOutlined,
    ReloadOutlined,
    FileTextOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    DownloadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────
interface IORow {
    ticket_id: string | null;
    campaign_name: string;
    client_name: string;
    start_date: string;
    end_date: string;
    campaign_type: string;
    line_items_count: number;
    io_id: string | null;
    pdf_generated: boolean;
    created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(v?: string) {
    if (!v) return "—";
    return new Date(v).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({
    message,
    type,
    onClose,
}: {
    message: string;
    type: "success" | "error";
    onClose: () => void;
}) {
    useEffect(() => {
        const t = setTimeout(onClose, 3500);
        return () => clearTimeout(t);
    }, [onClose]);

    const color = type === "success" ? "var(--green)" : "var(--red)";
    return (
        <div
            style={{
                position: "fixed",
                bottom: 24,
                right: 24,
                zIndex: 999,
                background: "var(--bg-card)",
                border: `1px solid ${color}`,
                borderRadius: 12,
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxShadow: "var(--shadow)",
                minWidth: 280,
            }}
        >
            <span style={{ fontSize: 18 }}>{type === "success" ? "✅" : "❌"}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {message}
            </span>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Insertion_Order() {
    const [rows, setRows] = useState<IORow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);

    const showToast = (message: string, type: "success" | "error" = "success") =>
        setToast({ message, type });

    // ── new state ──
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailPreview, setEmailPreview] = useState<any>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);
    const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);

    // ── open modal + load preview ──
    const openSendEmailModal = (ticketId: string) => {
        setCurrentTicketId(ticketId);
        setEmailModalOpen(true);
        setEmailPreview(null);

        fetch(`${BASE_URL}/campaigns/io/${ticketId}/send-email-preview/`, {
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
                setEmailBody(`Please find attached the Insertion Order ${data.io_id}.`);
            })
            .catch(() => {
                showToast("Failed to load email details.", "error");
                setEmailModalOpen(false);
            });
    };

    // ── confirm send ──
    const confirmSendEmail = () => {
        if (!currentTicketId) return;
        setSendingEmail(true);

        const formData = new FormData();
        formData.append("subject", emailSubject);
        formData.append("email_body", emailBody);

        fetch(`${BASE_URL}/campaigns/io/${currentTicketId}/send-email/`, {
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

    // ── Fetch list ──────────────────────────────────────────────────────────
    const fetchList = useCallback(() => {
        setLoading(true);
        fetch(`${BASE_URL}/campaigns/get_io_list/`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => {
                if (!r.ok) throw new Error();
                return r.json();
            })
            .then((data) => setRows(Array.isArray(data) ? data : []))
            .catch(() => showToast("Failed to load insertion orders.", "error"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    // ── Download IO PDF ─────────────────────────────────────────────────────
    const handleDownload = (ticketId: string, ioId: string) => {
        const a = document.createElement("a");
        a.href = `${BASE_URL}/campaigns/download_io_pdf/${ticketId}/`;
        a.download = `${ioId}.pdf`;
        a.click();
    };

    // add near handleDownload
    const [generatingTicket, setGeneratingTicket] = useState<string | null>(null);

    const handleGenerate = (ticketId: string) => {
        setGeneratingTicket(ticketId);
        fetch(`${BASE_URL}/campaigns/generate_io_pdf/${ticketId}/`, {
            method: "POST",
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => {
                if (!r.ok) throw new Error();
                return r.json();
            })
            .then(() => {
                showToast("IO PDF generated successfully.");
                fetchList(); // refresh the table so pdf_generated flips to true
            })
            .catch(() => showToast("Failed to generate IO PDF.", "error"))
            .finally(() => setGeneratingTicket(null));
    };

    // ── Filter ──────────────────────────────────────────────────────────────
    const filtered = rows.filter((r) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return [r.ticket_id, r.campaign_name, r.client_name].some(
            (f) => f?.toLowerCase().includes(q)
        );
    });

    // ── Stats ───────────────────────────────────────────────────────────────
    const totalCount = rows.length;
    const generatedCount = rows.filter((r) => r.pdf_generated).length;
    const pendingCount = totalCount - generatedCount;

    // ── Columns ─────────────────────────────────────────────────────────────
    const columns: ColumnsType<IORow> = [
        {
            title: "Ticket ID",
            dataIndex: "ticket_id",
            key: "ticket_id",
            width: 150,
            render: (v: string | null) => (
                <span
                    style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--blue)",
                        background: "var(--blue-bg)",
                        padding: "3px 8px",
                        borderRadius: 6,
                    }}
                >
                    {v || "—"}
                </span>
            ),
        },
        {
            title: "IO #",
            dataIndex: "io_id",
            key: "io_id",
            width: 110,
            render: (v: string | null) =>
                v ? (
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--amber)",
                            background: "var(--amber-bg)",
                            padding: "3px 7px",
                            borderRadius: 5,
                            border: "1px solid var(--amber)",
                        }}
                    >
                        {v}
                    </span>
                ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                ),
        },
        {
            title: "Campaign Name",
            dataIndex: "campaign_name",
            key: "campaign_name",
            width: 230,
            render: (v: string, record: IORow) => (
                <div>
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            marginBottom: 4,
                        }}
                    >
                        {v || "—"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                        {record.campaign_type && (
                            <Tag
                                color="blue"
                                style={{ fontSize: 10, margin: 0, lineHeight: "18px" }}
                            >
                                {record.campaign_type}
                            </Tag>
                        )}
                        <Tag
                            color="purple"
                            style={{ fontSize: 10, margin: 0, lineHeight: "18px" }}
                        >
                            {record.line_items_count} line item
                            {record.line_items_count !== 1 ? "s" : ""}
                        </Tag>
                    </div>
                </div>
            ),
        },
        {
            title: "Client",
            dataIndex: "client_name",
            key: "client_name",
            width: 160,
            render: (v: string) => (
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                    {v || "—"}
                </span>
            ),
        },
        {
            title: "Start Date",
            dataIndex: "start_date",
            key: "start_date",
            width: 120,
            render: (v: string) => (
                <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{fmtDate(v)}</span>
            ),
        },
        {
            title: "End Date",
            dataIndex: "end_date",
            key: "end_date",
            width: 120,
            render: (v: string) => (
                <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{fmtDate(v)}</span>
            ),
        },
        {
            title: "PDF Status",
            dataIndex: "pdf_generated",
            key: "pdf_generated",
            width: 140,
            render: (generated: boolean, record: IORow) =>
                generated ? (
                    <Tooltip title={`IO ID: ${record.io_id ?? "—"}`}>
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "3px 10px",
                                borderRadius: 20,
                                background: "var(--green-bg)",
                                border: "1px solid var(--green)",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--green)",
                            }}
                        >
                            <CheckCircleOutlined style={{ fontSize: 11 }} /> Generated
                        </span>
                    </Tooltip>
                ) : (
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "3px 10px",
                            borderRadius: 20,
                            background: "var(--amber-bg)",
                            border: "1px solid var(--amber)",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--amber)",
                        }}
                    >
                        <ClockCircleOutlined style={{ fontSize: 11 }} /> Pending
                    </span>
                ),
        },
        {
            title: "Actions",
            key: "actions",
            width: 200,
            fixed: "right",
            render: (_: any, record: IORow) => (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {record.pdf_generated && record.ticket_id ? (
                        <Button
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() =>
                                handleDownload(record.ticket_id!, record.io_id ?? record.ticket_id!)
                            }
                            style={{
                                fontSize: 11, fontWeight: 600, height: 30,
                                background: "var(--blue-bg)", color: "var(--blue)",
                                border: "1px solid var(--blue)", borderRadius: 6,
                            }}
                        >
                            Download IO
                        </Button>
                    ) : record.ticket_id ? (
                        <Button
                            size="small"
                            loading={generatingTicket === record.ticket_id}
                            onClick={() => handleGenerate(record.ticket_id!)}
                            style={{
                                fontSize: 11, fontWeight: 600, height: 30,
                                background: "var(--amber-bg)", color: "var(--amber)",
                                border: "1px solid var(--amber)", borderRadius: 6,
                            }}
                        >
                            {generatingTicket === record.ticket_id ? "Generating…" : "Generate"}
                        </Button>
                    ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No ticket</span>
                    )}
                    {record.pdf_generated && record.ticket_id && (
                        <Button
                            size="small"
                            onClick={() => openSendEmailModal(record.ticket_id!)}
                            style={{ fontSize: 11, fontWeight: 600, height: 30 }}
                        >
                            Send Email
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div>
            {/* Page Header */}
            <div style={{ marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                <h1 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                    Insertion Orders
                </h1>
                <p
                    style={{
                        fontSize: 9,
                        color: "var(--text-muted)",
                        margin: "4px 0 0",
                        letterSpacing: "0.04em",
                        fontWeight: 500,
                        textTransform: "uppercase",
                    }}
                >
                    Generate &amp; download IO documents for your campaigns
                </p>
            </div>

            {/* Stat Cards */}
            <div className="db-stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="db-stat-card">
                    <div className="db-stat-label">Total IOs</div>
                    <div className="db-stat-value">{totalCount}</div>
                    <div className="db-stat-change" style={{ color: "var(--text-muted)" }}>
                        📄 All campaigns
                    </div>
                </div>
                <div className="db-stat-card">
                    <div className="db-stat-label">PDF Generated</div>
                    <div className="db-stat-value" style={{ color: "var(--green)" }}>{generatedCount}</div>
                    <div className="db-stat-change up">✅ Ready to download</div>
                </div>
                <div className="db-stat-card">
                    <div className="db-stat-label">Pending</div>
                    <div className="db-stat-value" style={{ color: "var(--amber)" }}>{pendingCount}</div>
                    <div className="db-stat-change" style={{ color: "var(--amber)" }}>⏳ Awaiting generation</div>
                </div>
            </div>

            {/* Search + Refresh */}
            <div
                style={{
                    background: "var(--bg-card)",
                    borderRadius: 12,
                    padding: "14px 18px",
                    border: "1px solid var(--border)",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                }}
            >
                <Input
                    placeholder="Search by ticket ID, campaign name, client…"
                    prefix={<SearchOutlined style={{ color: "var(--text-muted)" }} />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                    style={{ flex: 1, minWidth: 240, height: 36, background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <Button
                    onClick={fetchList}
                    icon={<ReloadOutlined />}
                    style={{
                        height: 36,
                        borderRadius: 8,
                        border: "1px solid var(--border-strong)",
                        background: "var(--bg-input)",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                >
                    Refresh
                </Button>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {filtered.length} of {rows.length} IOs
                </span>
            </div>

            {/* Info Banner */}
            <div
                style={{
                    background: "var(--blue-bg)",
                    border: "1px solid var(--blue)",
                    borderRadius: 10,
                    padding: "10px 16px",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12.5,
                    color: "var(--blue)",
                    fontWeight: 500,
                }}
            >
                <FileTextOutlined style={{ fontSize: 16 }} />
                Each IO PDF is generated automatically when its campaign is created — click{" "}
                <strong style={{ margin: "0 3px" }}>Download IO</strong> to save it.
            </div>

            {/* Table */}
            <div
                style={{
                    background: "var(--bg-card)",
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                    boxShadow: "var(--shadow-card)",
                }}
            >
                <Table
                    columns={columns}
                    dataSource={filtered}
                    rowKey="ticket_id"
                    loading={loading}
                    scroll={{ x: 1300 }}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50"],
                        showTotal: (total, range) =>
                            `${range[0]}–${range[1]} of ${total} IOs`,
                        style: { padding: "12px 16px" },
                    }}
                    style={{ fontSize: 13 }}
                />
            </div>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            <Modal
                title="Send Insertion Order Email"
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
                        <p><b>IO ID:</b> {emailPreview.io_id}</p>
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
        </div>
    );
}