import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Button, Select, Tag, message } from "antd";
import { ReloadOutlined, DownloadOutlined, EyeOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const BASE_URL = import.meta.env.VITE_BASE_URL;

interface CampaignRef { ticket_id: string; campaign_name: string; }

interface InvoiceRow {
    invoice_id: string;
    invoice_month: string | null;
    invoice_from: string | null;
    invoice_to: string | null;
    due_date: string | null;
    invoice_type: "single" | "multiple";
    campaigns: CampaignRef[];
    billing_amount: number;
    additional_discount: number;
    total_pay_amount: number;
    total_paid: number;
    balance_amount: number;
    status: string;
    is_approved: boolean;
    pdf_generated: boolean;
    pdf_url: string | null;
    gst: number | null;
    vat_tax: number | null;
}

interface ClientOption { client_id: string; name: string; invoice_type: "single" | "multiple"; }

function fmtDate(v?: string | null) {
    if (!v) return "—";
    return new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const statusColor: Record<string, string> = {
    "Not Paid": "red",
    "Partial Paid": "orange",
    "Paid": "green",
};

export default function Invoice_Download() {
    const navigate = useNavigate();
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [clientInvoiceType, setClientInvoiceType] = useState<"single" | "multiple" | null>(null);
    const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch(`${BASE_URL}/invoice/get_all_clients/`, { headers: { "ngrok-skip-browser-warning": "1" } })
            .then(r => r.json())
            .then(data => setClients((data?.clients ?? []).map((c: any) => ({
                client_id: c.client_id,
                name: c.name,
                invoice_type: c.invoice_type ?? "single",
            }))))
            .catch(() => message.error("Failed to load clients."));
    }, []);

    const fetchInvoices = (clientId: string) => {
        setLoading(true);
        fetch(`${BASE_URL}/invoice/get_invoices_by_client/${clientId}/`, { headers: { "ngrok-skip-browser-warning": "1" } })
            .then(r => r.json())
            .then(data => {
                setClientInvoiceType(data.invoice_type ?? "single");
                setInvoices(data.invoices ?? []);
            })
            .catch(() => message.error("Failed to load invoices."))
            .finally(() => setLoading(false));
    };

    const handleClientChange = (clientId: string) => {
        setSelectedClientId(clientId);
        fetchInvoices(clientId);
    };

    const handleView = (invoiceId: string) => {
        window.open(`${BASE_URL}/invoice/view_invoice_pdf/${invoiceId}/`, "_blank", "noopener,noreferrer");
    };

    const handleDownload = (invoiceId: string) => {
        const a = document.createElement("a");
        a.href = `${BASE_URL}/invoice/download_invoice_pdf/${invoiceId}/`;
        a.download = `${invoiceId}.pdf`;
        a.click();
    };

    // Clicking the Invoice ID reopens the generator form, prefilled, so
    // changing discount/GST/VAT and regenerating overwrites this same invoice.
    const handleReopen = (invoiceId: string) => {
        navigate(`/superadmin/all_invoices?edit=${invoiceId}`);
    };

    const columns: ColumnsType<InvoiceRow> = [
        {
            title: "Invoice ID",
            dataIndex: "invoice_id",
            width: 140,
            render: (v: string) => (
                <Tag
                    color="blue"
                    style={{ fontWeight: 700, cursor: "pointer" }}
                    onClick={() => handleReopen(v)}
                >
                    {v}
                </Tag>
            ),
        },
        {
            title: "Type",
            dataIndex: "invoice_type",
            width: 90,
            render: (v: string) => <Tag color={v === "single" ? "purple" : "cyan"}>{v}</Tag>,
        },
        {
            title: "Campaigns",
            dataIndex: "campaigns",
            width: 220,
            render: (campaigns: CampaignRef[]) => (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {campaigns.map(c => (
                        <Tag key={c.ticket_id} style={{ fontSize: 11 }}>{c.ticket_id}</Tag>
                    ))}
                </div>
            ),
        },
        {
            title: "Period",
            key: "period",
            width: 180,
            render: (_: any, r: InvoiceRow) => (
                <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
                    {fmtDate(r.invoice_from)} → {fmtDate(r.invoice_to)}
                </span>
            ),
        },
        {
            title: "Billing Amount",
            dataIndex: "billing_amount",
            width: 130,
            render: (v: number) => <b style={{ color: "var(--text-primary)" }}>₹{v?.toLocaleString("en-IN") ?? 0}</b>,
        },
        {
            title: "Discount",
            dataIndex: "additional_discount",
            width: 100,
            render: (v: number) => <span style={{ color: "var(--text-primary)" }}>₹{v?.toLocaleString("en-IN") ?? 0}</span>,
        },
        {
            title: "Pay Amount",
            dataIndex: "total_pay_amount",
            width: 120,
            render: (v: number) => <span style={{ color: "var(--green)", fontWeight: 700 }}>₹{v?.toLocaleString("en-IN") ?? 0}</span>,
        },
        {
            title: "Balance",
            dataIndex: "balance_amount",
            width: 110,
            render: (v: number) => <span style={{ color: "var(--text-primary)" }}>₹{v?.toLocaleString("en-IN") ?? 0}</span>,
        },
        {
            title: "GST / VAT",
            key: "tax",
            width: 100,
            render: (_: any, r: InvoiceRow) => (
                <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
                    {r.gst != null ? `${r.gst}%` : "—"} / {r.vat_tax != null ? `${r.vat_tax}%` : "—"}
                </span>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            width: 110,
            render: (v: string) => <Tag color={statusColor[v] ?? "default"}>{v}</Tag>,
        },
        {
            title: "Actions",
            key: "actions",
            width: 180,
            fixed: "right",
            render: (_: any, r: InvoiceRow) => (
                <div style={{ display: "flex", gap: 6 }}>
                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleView(r.invoice_id)}
                        style={{
                            border: "1px solid var(--accent)",
                            background: "var(--accent-light)",
                            color: "var(--accent)",
                        }}
                    >
                        View
                    </Button>
                    <Button
                        size="small"
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownload(r.invoice_id)}
                        style={{ background: "var(--accent)", borderColor: "var(--accent)" }}
                    >
                        Download
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Generated Invoices</h1>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
                    SELECT CLIENT TO VIEW &amp; DOWNLOAD INVOICES · CLICK AN INVOICE ID TO EDIT &amp; REGENERATE
                </p>
            </div>

            <div style={{
                background: "var(--bg-card)", borderRadius: "var(--radius-card)", padding: 20,
                border: "1px solid var(--border)", marginBottom: 16,
                display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap",
                boxShadow: "var(--shadow-card)",
            }}>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>Client</div>
                    <Select
                        showSearch
                        placeholder="Select client..."
                        style={{ width: 260, height: 38 }}
                        value={selectedClientId}
                        onChange={handleClientChange}
                        filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                        options={clients.map(c => ({ value: c.client_id, label: `${c.name} (${c.client_id})` }))}
                    />
                </div>

                {clientInvoiceType && (
                    <Tag
                        color={clientInvoiceType === "single" ? "purple" : "cyan"}
                        style={{ height: 38, display: "flex", alignItems: "center", fontSize: 12 }}
                    >
                        Billing Mode: {clientInvoiceType === "single" ? "Single (1 invoice, all campaigns)" : "Multiple (1 invoice per campaign)"}
                    </Tag>
                )}

                {selectedClientId && (
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => fetchInvoices(selectedClientId)}
                        style={{
                            height: 38, borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border-strong)",
                            background: "var(--bg-input)", color: "var(--text-secondary)",
                        }}
                    >
                        Refresh
                    </Button>
                )}
            </div>

            {selectedClientId && (
                <div style={{
                    background: "var(--bg-card)", borderRadius: "var(--radius-card)",
                    border: "1px solid var(--border)", overflow: "hidden",
                    boxShadow: "var(--shadow-card)",
                }}>
                    <Table
                        columns={columns}
                        dataSource={invoices}
                        rowKey="invoice_id"
                        loading={loading}
                        scroll={{ x: 1300 }}
                        pagination={{ pageSize: 10 }}
                    />
                </div>
            )}
        </>
    );
}