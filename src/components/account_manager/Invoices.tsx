import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Select, DatePicker, Input, Button, message, Tag } from "antd";
import { FilePdfOutlined, SwapOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";

const BASE_URL = import.meta.env.VITE_BASE_URL;

interface ClientOption { client_id: string; name: string; invoice_type: "single" | "multiple"; }

interface ContactPerson { id: number; name: string; email: string; phone: string; }
interface AuthorizedPerson { id: number; name: string; }

interface ClientInvoiceInfo {
    client_id: string;
    client_name: string;
    invoice_type: "single" | "multiple";
    billing_currency: string;
    contact_person: ContactPerson | null;
    default_invoice_address_id: number | null;
    default_invoice_bank_id: number | null;
    default_authorized_person: AuthorizedPerson | null;
}

interface CampaignOption {
    id: number;
    ticket_id: string;
    campaign_name: string;
    start_date: string;
    end_date: string;
}

export default function Invoices() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editingInvoiceId = searchParams.get("edit"); // e.g. ?edit=BTU000001

    const [clients, setClients] = useState<ClientOption[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [clientInfo, setClientInfo] = useState<ClientInvoiceInfo | null>(null);
    const [loadingClientInfo, setLoadingClientInfo] = useState(false);

    const [invoiceMonth, setInvoiceMonth] = useState<string>(dayjs().format("YYYY-MM-01"));

    const [discountInput, setDiscountInput] = useState("");
    const [gstInput, setGstInput] = useState("");
    const [vatInput, setVatInput] = useState("");

    const [availableCampaigns, setAvailableCampaigns] = useState<CampaignOption[]>([]);
    const [chosenCampaigns, setChosenCampaigns] = useState<CampaignOption[]>([]);
    const [selectedAvailableIds, setSelectedAvailableIds] = useState<number[]>([]);
    const [selectedChosenIds, setSelectedChosenIds] = useState<number[]>([]);
    const [filterText, setFilterText] = useState("");
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);

    const [generating, setGenerating] = useState(false);

    // ── Load client list on mount ──
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

    // ── Fetch client billing/contact info whenever client changes ──
    const fetchClientInfo = useCallback((clientId: string) => {
        setLoadingClientInfo(true);
        fetch(`${BASE_URL}/invoice/get_client_invoice_info/${clientId}/`, { headers: { "ngrok-skip-browser-warning": "1" } })
            .then(r => r.json())
            .then(data => setClientInfo(data))
            .catch(() => message.error("Failed to load client info."))
            .finally(() => setLoadingClientInfo(false));
    }, []);

    // ── Fetch available campaigns whenever client + month change ──
    const fetchAvailableCampaigns = useCallback((clientId: string, month: string, keepChosenIds: number[] = []) => {
        setLoadingCampaigns(true);
        const params = new URLSearchParams({ invoice_month: month });
        if (editingInvoiceId) params.set("exclude_invoice_id", editingInvoiceId);

        fetch(`${BASE_URL}/invoice/get_available_campaigns/${clientId}/?${params.toString()}`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then(r => r.json())
            .then(data => {
                const all: CampaignOption[] = data.campaigns ?? [];
                // Keep already-chosen campaigns out of the "available" list
                setAvailableCampaigns(all.filter(c => !keepChosenIds.includes(c.id)));
            })
            .catch(() => message.error("Failed to load campaigns."))
            .finally(() => setLoadingCampaigns(false));
    }, [editingInvoiceId]);

    // ── If editing an existing invoice, prefill everything ──
    useEffect(() => {
        if (!editingInvoiceId) return;
        fetch(`${BASE_URL}/invoice/get_invoice_detail/${editingInvoiceId}/`, { headers: { "ngrok-skip-browser-warning": "1" } })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    message.error(data.error);
                    return;
                }
                setSelectedClientId(data.client_id);
                fetchClientInfo(data.client_id);
                const month = data.invoice_month ?? dayjs().format("YYYY-MM-01");
                setInvoiceMonth(month);
                setDiscountInput(data.additional_discount ? String(data.additional_discount) : "");
                setGstInput(data.gst != null ? String(data.gst) : "");
                setVatInput(data.vat_tax != null ? String(data.vat_tax) : "");

                const chosen: CampaignOption[] = (data.campaigns ?? []).map((c: any) => ({
                    id: c.id, ticket_id: c.ticket_id, campaign_name: c.campaign_name,
                    start_date: "", end_date: "",
                }));
                setChosenCampaigns(chosen);
                fetchAvailableCampaigns(data.client_id, month, chosen.map((c: CampaignOption) => c.id));
            })
            .catch(() => message.error("Failed to load invoice for editing."));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingInvoiceId]);

    // ── Normal (non-editing) client selection ──
    const handleClientChange = (clientId: string) => {
        setSelectedClientId(clientId);
        setChosenCampaigns([]);
        setSelectedAvailableIds([]);
        setSelectedChosenIds([]);
        fetchClientInfo(clientId);
        fetchAvailableCampaigns(clientId, invoiceMonth);
    };
    const handleMonthChange = (_: Dayjs | null, dateString: string | null) => {
        const month = dateString
            ? dayjs(dateString).format("YYYY-MM-01")
            : dayjs().format("YYYY-MM-01");

        setInvoiceMonth(month);
        setChosenCampaigns([]);
        setSelectedAvailableIds([]);
        setSelectedChosenIds([]);

        if (selectedClientId) {
            fetchAvailableCampaigns(selectedClientId, month);
        }
    };

    // ── Dual list-box logic ──
    const toggleAvailableSelect = (id: number) => {
        setSelectedAvailableIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    const toggleChosenSelect = (id: number) => {
        setSelectedChosenIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleChoose = () => {
        if (selectedAvailableIds.length === 0) return;
        const moving = availableCampaigns.filter(c => selectedAvailableIds.includes(c.id));
        setChosenCampaigns(prev => [...prev, ...moving]);
        setAvailableCampaigns(prev => prev.filter(c => !selectedAvailableIds.includes(c.id)));
        setSelectedAvailableIds([]);
    };

    const handleRemove = () => {
        if (selectedChosenIds.length === 0) return;
        const moving = chosenCampaigns.filter(c => selectedChosenIds.includes(c.id));
        setAvailableCampaigns(prev => [...prev, ...moving]);
        setChosenCampaigns(prev => prev.filter(c => !selectedChosenIds.includes(c.id)));
        setSelectedChosenIds([]);
    };

    const filteredAvailable = availableCampaigns.filter(c =>
        c.campaign_name.toLowerCase().includes(filterText.toLowerCase()) ||
        (c.ticket_id || "").toLowerCase().includes(filterText.toLowerCase())
    );

    // ── Generate ──
    const handleGenerate = async () => {
        if (!selectedClientId) { message.error("Select a client"); return; }
        if (chosenCampaigns.length === 0) { message.error("Choose at least one campaign"); return; }

        setGenerating(true);
        try {
            const res = await fetch(`${BASE_URL}/invoice/generate_monthly_invoice/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                body: JSON.stringify({
                    client_id: selectedClientId,
                    invoice_month: invoiceMonth,
                    campaign_ids: chosenCampaigns.map(c => c.id),
                    contact_person_id: clientInfo?.contact_person?.id ?? null,
                    gst: gstInput.trim() || null,
                    vat_tax: vatInput.trim() || null,
                    additional_discount: discountInput.trim() || null,
                    existing_invoice_id: editingInvoiceId || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to generate");
            message.success(data.message || "Invoice(s) generated");
            // navigate("/superadmin/invoice_download");
        } catch (e: any) {
            message.error(e.message || "Generation failed");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                    {editingInvoiceId ? `Edit Invoice — ${editingInvoiceId}` : "Invoice Generator"}
                </h1>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
                    SELECT CLIENT → SELECT MONTH → CHOOSE CAMPAIGNS → GENERATE
                </p>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-card)", padding: 24, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>

                {/* ── Row 1: Month + Client ── */}
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>Invoice Month *</div>
                        <DatePicker
                            picker="month"
                            format="MMMM YYYY"
                            style={{ height: 38, width: 200 }}
                            value={dayjs(invoiceMonth)}
                            onChange={handleMonthChange}
                            disabled={!!editingInvoiceId}
                        />
                    </div>

                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>Company *</div>
                        <Select
                            showSearch
                            placeholder="Select client..."
                            style={{ width: 300, height: 38 }}
                            value={selectedClientId}
                            onChange={handleClientChange}
                            disabled={!!editingInvoiceId}
                            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                            options={clients.map(c => ({ value: c.client_id, label: `${c.name} (${c.client_id})` }))}
                        />
                    </div>

                    {clientInfo && (
                        <div style={{ display: "flex", alignItems: "flex-end" }}>
                            <Tag
                                color={clientInfo.invoice_type === "single" ? "purple" : "cyan"}
                                style={{ height: 38, display: "flex", alignItems: "center", fontSize: 12 }}
                            >
                                Billing Mode: {clientInfo.invoice_type === "single" ? "Single (1 invoice, all campaigns)" : "Multiple (1 invoice per campaign)"}
                            </Tag>
                        </div>
                    )}
                </div>

                {/* ── Row 2: Contact person ── */}
                {selectedClientId && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>Contact Person *</div>
                        <Input
                            disabled
                            style={{ width: 320, height: 38, background: "var(--bg-input)", color: "var(--text-primary)" }}
                            value={loadingClientInfo ? "Loading…" : (clientInfo?.contact_person?.name || "— No contact on file —")}
                        />
                    </div>
                )}

                {/* ── Row 3: Discount + GST + VAT ── */}
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>Offers or Discount</div>
                        <Input
                            placeholder="e.g. 100 or 10%"
                            style={{ width: 180, height: 38 }}
                            value={discountInput}
                            onChange={e => setDiscountInput(e.target.value)}
                        />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>GST %</div>
                        <Input
                            type="number"
                            placeholder="e.g. 18"
                            style={{ width: 100, height: 38 }}
                            value={gstInput}
                            onChange={e => setGstInput(e.target.value)}
                        />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>VAT %</div>
                        <Input
                            type="number"
                            placeholder="e.g. 5"
                            style={{ width: 100, height: 38 }}
                            value={vatInput}
                            onChange={e => setVatInput(e.target.value)}
                        />
                    </div>
                </div>

                {/* ── Row 4: From address / bank / authorized person (read-only) ── */}
                {selectedClientId && (
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
                        <div style={{ flex: "1 1 280px" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>From Company Address</div>
                            <Input
                                disabled
                                style={{ height: 38, background: "var(--bg-input)", color: "var(--text-primary)" }}
                                value={loadingClientInfo ? "Loading…" : (clientInfo?.default_invoice_address_id ? "Configured" : "— Not set —")}
                            />
                        </div>
                        <div style={{ flex: "1 1 280px" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>From Company Bank</div>
                            <Input
                                disabled
                                style={{ height: 38, background: "var(--bg-input)", color: "var(--text-primary)" }}
                                value={loadingClientInfo ? "Loading…" : (clientInfo?.default_invoice_bank_id ? "Configured" : "— Not set —")}
                            />
                        </div>
                        <div style={{ flex: "0 0 220px" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>Authorized Person</div>
                            <Input
                                disabled
                                style={{ height: 38, background: "var(--bg-input)", color: "var(--text-primary)" }}
                                value={loadingClientInfo ? "Loading…" : (clientInfo?.default_authorized_person?.name || "— Not set —")}
                            />
                        </div>
                    </div>
                )}

                {/* ── Campaign dual list-box ── */}
                {selectedClientId && (
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: "var(--text-primary)" }}>Campaigns *</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "start" }}>

                            {/* Available */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
                                    Available Campaigns {loadingCampaigns ? "(loading…)" : `(${filteredAvailable.length})`}
                                </div>
                                <Input
                                    placeholder="Filter"
                                    size="small"
                                    style={{ marginBottom: 6 }}
                                    value={filterText}
                                    onChange={e => setFilterText(e.target.value)}
                                />
                                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", height: 220, overflowY: "auto" }}>
                                    {filteredAvailable.length === 0 ? (
                                        <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                                            No campaigns available
                                        </div>
                                    ) : filteredAvailable.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => toggleAvailableSelect(c.id)}
                                            style={{
                                                padding: "8px 12px", cursor: "pointer", fontSize: 12.5,
                                                background: selectedAvailableIds.includes(c.id) ? "var(--accent-light)" : "transparent",
                                                color: selectedAvailableIds.includes(c.id) ? "var(--accent)" : "var(--text-primary)",
                                                borderBottom: "1px solid var(--border)",
                                            }}
                                        >
                                            {c.campaign_name} <span style={{ color: "var(--text-muted)" }}>({c.ticket_id})</span>
                                            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Starts {c.start_date}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Choose / Remove buttons */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 40 }}>
                                <Button size="small" icon={<SwapOutlined rotate={90} />} onClick={handleChoose} disabled={selectedAvailableIds.length === 0}>
                                    Choose
                                </Button>
                                <Button size="small" icon={<SwapOutlined rotate={-90} />} onClick={handleRemove} disabled={selectedChosenIds.length === 0}>
                                    Remove
                                </Button>
                            </div>

                            {/* Chosen */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
                                    Chosen Campaigns ({chosenCampaigns.length})
                                </div>
                                <div style={{ height: 22, marginBottom: 6 }} />
                                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", height: 220, overflowY: "auto" }}>
                                    {chosenCampaigns.length === 0 ? (
                                        <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                                            Nothing chosen yet
                                        </div>
                                    ) : chosenCampaigns.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => toggleChosenSelect(c.id)}
                                            style={{
                                                padding: "8px 12px", cursor: "pointer", fontSize: 12.5,
                                                background: selectedChosenIds.includes(c.id) ? "var(--accent-light)" : "transparent",
                                                color: selectedChosenIds.includes(c.id) ? "var(--accent)" : "var(--text-primary)",
                                                borderBottom: "1px solid var(--border)",
                                            }}
                                        >
                                            {c.campaign_name} <span style={{ color: "var(--text-muted)" }}>({c.ticket_id})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <Button
                    type="primary"
                    icon={<FilePdfOutlined />}
                    loading={generating}
                    disabled={!selectedClientId || chosenCampaigns.length === 0}
                    onClick={handleGenerate}
                    style={{
                        height: 40, fontWeight: 700, paddingLeft: 24, paddingRight: 24,
                        background: "var(--accent)", borderColor: "var(--accent)",
                    }}
                >
                    {editingInvoiceId ? "Regenerate Invoice" : "Generate Invoice(s)"}
                </Button>
            </div>
        </>
    );
}