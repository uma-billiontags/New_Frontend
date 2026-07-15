import { useEffect, useState, useCallback } from "react";
import { Table, Button, Input, Modal, Form, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const BASE_URL = import.meta.env.VITE_BASE_URL;

interface CompanyAddress {
    id: number;
    company_name: string;
    address_line_1: string;
    address_line_2: string | null;
    city: string;
    state_name: string;
    country: string;
    pincode: string | null;
    pan_number: string | null;
    gst_number: string | null;
    cin_number: string | null;
    tan_number: string | null;
    trn_number: string | null;
    license_number: string | null;
    sac_number: string | null;
    ct_number: string | null;
    is_active: boolean;
}

export default function Invoice_Company_Address() {
    const [data, setData] = useState<CompanyAddress[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<CompanyAddress | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const fetchData = useCallback(() => {
        setLoading(true);
        fetch(`${BASE_URL}/categories/get_all_company_addresses/`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => r.json())
            .then((d) => setData(Array.isArray(d) ? d : d.results || []))
            .catch(() => message.error("Failed to load company addresses"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ is_active: true }); setModalOpen(true); };
    const openEdit = (record: CompanyAddress) => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); };

    const handleSave = async () => {
        try { await form.validateFields(); } catch { return; }
        const values = form.getFieldsValue();
        setSaving(true);
        const isEdit = !!editing;
        const url = isEdit
            ? `${BASE_URL}/categories/edit_company_address/${editing.id}/`
            : `${BASE_URL}/categories/create_company_address/`;
        try {
            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                body: JSON.stringify(values),
            });
            if (res.ok) {
                message.success(isEdit ? "Company address updated" : "Company address added");
                setModalOpen(false);
                fetchData();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(JSON.stringify(err) || "Save failed");
            }
        } catch { message.error("Network error"); }
        finally { setSaving(false); }
    };

    const handleDelete = (record: CompanyAddress) => {
        Modal.confirm({
            title: "Delete company address?",
            content: `Are you sure you want to delete "${record.company_name}"? This cannot be undone.`,
            okText: "Yes, Delete",
            okButtonProps: { danger: true },
            cancelText: "Cancel",
            onOk: async () => {
                try {
                    const res = await fetch(`${BASE_URL}/categories/delete_company_address/${record.id}/`, {
                        method: "DELETE",
                        headers: { "ngrok-skip-browser-warning": "1" },
                    });
                    if (res.ok) { message.success("Deleted successfully"); fetchData(); }
                    else message.error("Failed to delete");
                } catch { message.error("Network error"); }
            },
        });
    };

    const filtered = data.filter((d) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return [d.company_name, d.city, d.state_name, d.country, d.gst_number, d.pan_number].some((f) => f?.toLowerCase().includes(q));
    });

    const columns: ColumnsType<CompanyAddress> = [
        { title: "Company Name", dataIndex: "company_name", key: "company_name" },
        { title: "Address Line 1", dataIndex: "address_line_1", key: "address_line_1" },
        { title: "Address Line 2", dataIndex: "address_line_2", key: "address_line_2", render: (v) => v || "—" },
        { title: "City", dataIndex: "city", key: "city" },
        { title: "State", dataIndex: "state_name", key: "state_name" },
        { title: "Country", dataIndex: "country", key: "country" },
        { title: "Pincode", dataIndex: "pincode", key: "pincode", render: (v) => v || "—" },
        { title: "PAN", dataIndex: "pan_number", key: "pan_number", render: (v) => v || "—" },
        { title: "GST", dataIndex: "gst_number", key: "gst_number", render: (v) => v || "—" },
        { title: "CIN", dataIndex: "cin_number", key: "cin_number", render: (v) => v || "—" },
        { title: "TAN", dataIndex: "tan_number", key: "tan_number", render: (v) => v || "—" },
        { title: "TRN", dataIndex: "trn_number", key: "trn_number", render: (v) => v || "—" },
        { title: "License No.", dataIndex: "license_number", key: "license_number", render: (v) => v || "—" },
        { title: "SAC", dataIndex: "sac_number", key: "sac_number", render: (v) => v || "—" },
        { title: "CT No.", dataIndex: "ct_number", key: "ct_number", render: (v) => v || "—" },
        {
            title: "Status", dataIndex: "is_active", key: "is_active",
            render: (v: boolean) => (
                <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 10,
                    color: v ? "var(--green)" : "var(--red)",
                    background: v ? "var(--green-bg)" : "var(--red-bg)",
                }}>{v ? "Active" : "Inactive"}</span>
            ),
        },
        {
            title: "Actions", key: "actions", width: 160, fixed: "right",
            render: (_: any, record: CompanyAddress) => (
                <div style={{ display: "flex", gap: 6 }}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}
                        style={{ fontSize: 11,
                fontWeight: 600,
                borderRadius: 6, color: "var(--blue)", borderColor: "var(--blue)", background: "var(--blue-bg)" }}>Edit</Button>
                    <Button size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)}
                        style={{  fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,color: "var(--red)", borderColor: "var(--red)", background: "var(--red-bg)" }}>Delete</Button>
                </div>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                <div>
                    <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>Invoice Company Address</h1>
                    <p
                        style={{
                            fontSize: 9,
                            color: "var(--text-muted)",
                            margin: "4px 0 0",
                            fontWeight: 500,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                        }}
                    >
                        Add the Billing Company Addresses to generate the Invoice
                    </p>
                </div>
                <Button onClick={openAdd} icon={<PlusOutlined />}
                    style={{
                        borderRadius: 9,
                        border: "none",
                        background: "var(--accent)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "8px 16px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                    }}>                    Add New
                </Button>
            </div>

            {/* ── Search + Count ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <Input placeholder="Search company, city, state, country, GST, PAN…"
                    prefix={<SearchOutlined />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                    style={{
                        flex: 1,
                        maxWidth: 380,
                        height: 35,
                        padding: "0 14px",
                        background: "var(--bg-input)",
                        border: "1px solid var(--accent-light)",
                        borderRadius: 9,
                        color: "var(--text-primary)",
                        fontSize: 13,
                        outline: "none",
                    }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {filtered.length} list{filtered.length !== 1 ? "s" : ""}
                </span>
            </div>
            {/* ── Ant Design Table ── */}
            <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
                <Table
                    columns={columns}
                    dataSource={filtered}
                    rowKey="id"
                    scroll={{ x: 2100 }}
                    loading={loading}
                    pagination={{
                        pageSize: 5,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50"],
                        showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} clients`,
                        style: { padding: "12px 16px", color: "var(--text-primary)" },
                    }}
                    rowClassName={() => "client-table-row"}
                    style={{ fontSize: 13 }} />
            </div>
            <Modal
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                confirmLoading={saving}
                title={editing ? "Edit Company Address" : "Add Company Address"}
                okText={editing ? "Save Changes" : "Add"}
                width={800}
                centered
                destroyOnClose>
                <Form form={form} layout="vertical" style={{}}>
                    <div className="db-form-row">
                        <Form.Item label="Company Name" name="company_name" rules={[{ required: true, message: "Required" }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Country" name="country" rules={[{ required: true, message: "Required" }]}>
                            <Input />
                        </Form.Item>
                    </div>
                    <div className="db-form-row">
                        <Form.Item label="Address Line 1" name="address_line_1" rules={[{ required: true, message: "Required" }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Address Line 2" name="address_line_2">
                            <Input />
                        </Form.Item>
                    </div>
                    <div className="db-form-row">
                        <Form.Item label="City" name="city" rules={[{ required: true, message: "Required" }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="State" name="state_name" rules={[{ required: true, message: "Required" }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Pincode" name="pincode">
                            <Input />
                        </Form.Item>
                    </div>

                    <div className="db-form-row">
                        <Form.Item label="PAN Number" name="pan_number"><Input /></Form.Item>
                        <Form.Item label="GST Number" name="gst_number"><Input /></Form.Item>
                        <Form.Item label="CIN Number" name="cin_number"><Input /></Form.Item>
                    </div>
                    <div className="db-form-row">
                        <Form.Item label="TAN Number" name="tan_number"><Input /></Form.Item>
                        <Form.Item label="TRN Number" name="trn_number"><Input /></Form.Item>
                        <Form.Item label="License Number" name="license_number"><Input /></Form.Item>
                    </div>
                    <div className="db-form-row">
                        <Form.Item label="SAC Number" name="sac_number"><Input /></Form.Item>
                        <Form.Item label="CT Number" name="ct_number"><Input /></Form.Item>
                    </div>
                </Form>
            </Modal>

        </div>
    );
}