import { useEffect, useState, useCallback } from "react";
import { Table, Button, Input, Modal, Form, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const BASE_URL = import.meta.env.VITE_BASE_URL;

interface BankDetail {
    id: number;
    nick_name: string | null;
    bank_name: string;
    account_name: string;
    ifsc_code: string;
    swift_code: string | null;
    iban_number: string | null;
    account_number: string;
    bank_address: string | null;
    is_active: boolean;
}

export default function Invoice_Bank_Details() {
    const [data, setData] = useState<BankDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<BankDetail | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const fetchData = useCallback(() => {
        setLoading(true);
        fetch(`${BASE_URL}/categories/get_all_bank_details/`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => r.json())
            .then((d) => setData(Array.isArray(d) ? d : d.results || []))
            .catch(() => message.error("Failed to load bank details"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ is_active: true }); setModalOpen(true); };
    const openEdit = (record: BankDetail) => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); };

    const handleSave = async () => {
        try { await form.validateFields(); } catch { return; }
        const values = form.getFieldsValue();
        setSaving(true);
        const isEdit = !!editing;
        const url = isEdit
            ? `${BASE_URL}/categories/edit_bank_detail/${editing.id}/`
            : `${BASE_URL}/categories/create_bank_detail/`;
        try {
            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                body: JSON.stringify(values),
            });
            if (res.ok) {
                message.success(isEdit ? "Bank detail updated" : "Bank detail added");
                setModalOpen(false);
                fetchData();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(JSON.stringify(err) || "Save failed");
            }
        } catch { message.error("Network error"); }
        finally { setSaving(false); }
    };

    const handleDelete = (record: BankDetail) => {
        Modal.confirm({
            title: "Delete bank detail?",
            content: `Are you sure you want to delete "${record.bank_name}"? This cannot be undone.`,
            okText: "Yes, Delete",
            okButtonProps: { danger: true },
            cancelText: "Cancel",
            onOk: async () => {
                try {
                    const res = await fetch(`${BASE_URL}/categories/delete_bank_detail/${record.id}/`, {
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
        return [d.bank_name, d.nick_name, d.ifsc_code, d.account_number].some((f) => f?.toLowerCase().includes(q));
    });

    const columns: ColumnsType<BankDetail> = [
        { title: "Bank Name", dataIndex: "bank_name", key: "bank_name"},
        { title: "Nick Name", dataIndex: "nick_name", key: "nick_name", render: (v) => v || "—" },
        { title: "Account Name", dataIndex: "account_name", key: "account_name" },
        { title: "IFSC Code", dataIndex: "ifsc_code", key: "ifsc_code" },
        { title: "SWIFT Code", dataIndex: "swift_code", key: "swift_code", render: (v) => v || "—" },
        { title: "Account Number", dataIndex: "account_number", key: "account_number" },
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
            title: "Actions", key: "actions", width: 160,
            render: (_: any, record: BankDetail) => (
                <div style={{ display: "flex", gap: 6 }}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}
                        style={{  fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,color: "var(--blue)", borderColor: "var(--blue)", background: "var(--blue-bg)" }}>Edit</Button>
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
                    <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>Invoice Bank Details</h1>
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
                        Add the Invoice Bank Details to generate the Invoice
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
                <Input placeholder="Search bank name, IFSC, account number…"
                    prefix={<SearchOutlined />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                    style={{
                        flex: 1,
                        maxWidth: 360,
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
                    scroll={{ x: 1200 }}
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
                title={editing ? "Edit Bank Detail" : "Add Bank Detail"}
                okText={editing ? "Save Changes" : "Add"}
                width={800}
                centered
                destroyOnClose>
                <Form form={form} layout="vertical" style={{}}>
                    <div className="db-form-row">
                        <Form.Item label="Bank Name" name="bank_name" rules={[{ required: true, message: "Required" }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Nick Name" name="nick_name"><Input /></Form.Item>
                    </div>
                    <div className="db-form-row">
                        <Form.Item label="Account Name" name="account_name" rules={[{ required: true, message: "Required" }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="IFSC Code" name="ifsc_code" rules={[{ required: true, message: "Required" }]}>
                            <Input />
                        </Form.Item>
                    </div>

                    <div className="db-form-row">
                        <Form.Item label="SWIFT Code" name="swift_code"><Input /></Form.Item>
                        <Form.Item label="IBAN Number" name="iban_number"><Input /></Form.Item>
                    </div>
                    <div className="db-form-row">
                        <Form.Item label="Account Number" name="account_number" rules={[{ required: true, message: "Required" }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Bank Address" name="bank_address"><Input.TextArea rows={2} /></Form.Item>
                    </div>
                </Form>
            </Modal>

        </div>
    );
}