import { useEffect, useState, useCallback } from "react";
import { Table, Button, Input, Modal, Switch, Form, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const BASE_URL = import.meta.env.VITE_BASE_URL;

interface Metric {
    id: number;
    title: string;
    is_active: boolean;
    created_on: string;
    updated_on: string;
}

function fmtDate(v?: string) {
    if (!v) return "—";
    return new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Metrics() {
    const [data, setData] = useState<Metric[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Metric | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const fetchData = useCallback(() => {
        setLoading(true);
        fetch(`${BASE_URL}/categories/get_all_metrics/`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => r.json())
            .then((d) => setData(Array.isArray(d) ? d : d.results || []))
            .catch(() => message.error("Failed to load metrics"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ is_active: true }); setModalOpen(true); };
    const openEdit = (record: Metric) => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); };

    const handleSave = async () => {
        try { await form.validateFields(); } catch { return; }
        const values = form.getFieldsValue();
        setSaving(true);
        const isEdit = !!editing;
        const url = isEdit
            ? `${BASE_URL}/categories/edit_metric/${editing.id}/`
            : `${BASE_URL}/categories/create_metric/`;
        try {
            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                body: JSON.stringify(values),
            });
            if (res.ok) {
                message.success(isEdit ? "Metric updated" : "Metric added");
                setModalOpen(false);
                fetchData();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(JSON.stringify(err) || "Save failed");
            }
        } catch { message.error("Network error"); }
        finally { setSaving(false); }
    };

    const handleDelete = (record: Metric) => {
        Modal.confirm({
            title: "Delete metric?",
            content: `Are you sure you want to delete "${record.title}"? This cannot be undone.`,
            okText: "Yes, Delete",
            okButtonProps: { danger: true },
            cancelText: "Cancel",
            onOk: async () => {
                try {
                    const res = await fetch(`${BASE_URL}/categories/delete_metric/${record.id}/`, {
                        method: "DELETE",
                        headers: { "ngrok-skip-browser-warning": "1" },
                    });
                    if (res.ok) { message.success("Deleted successfully"); fetchData(); }
                    else message.error("Failed to delete");
                } catch { message.error("Network error"); }
            },
        });
    };

    const filtered = data.filter((d) => !search.trim() || d.title.toLowerCase().includes(search.toLowerCase()));

    const columns: ColumnsType<Metric> = [
        { title: "Title", dataIndex: "title", key: "title" },
        { title: "Created On", dataIndex: "created_on", key: "created_on", render: (v) => fmtDate(v) },
        { title: "Updated On", dataIndex: "updated_on", key: "updated_on", render: (v) => fmtDate(v) },
        {
            title: "Status", dataIndex: "is_active", key: "is_active", width: 110,
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
            render: (_: any, record: Metric) => (
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
                    <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>Metrics</h1>
                    <p style={{ fontSize: 9, color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        Manage KPI metrics used in campaigns
                    </p>
                </div>
                <Button onClick={openAdd} icon={<PlusOutlined />}
                    style={{
                        borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff",
                        fontSize: 12, fontWeight: 700, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6,
                    }}>
                    Add New
                </Button>
            </div>

            {/* ── Search + Refresh + Count ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <Input placeholder="Search by title…"
                    prefix={<SearchOutlined />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                    style={{
                        flex: 1, maxWidth: 360, height: 35, padding: "0 14px",
                        background: "var(--bg-input)", border: "1px solid var(--accent-light)",
                        borderRadius: 9, color: "var(--text-primary)", fontSize: 13, outline: "none",
                    }}
                />
                <Button
                    onClick={fetchData}
                    icon={<ReloadOutlined />}
                    className="db-card-action"
                    style={{ height: 35, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, paddingInline: 14 }}
                >
                    Refresh
                </Button>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {filtered.length} of {data.length} metrics
                </span>
            </div>

            {/* ── Ant Design Table ── */}
            <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
                <Table
                    columns={columns}
                    dataSource={filtered}
                    rowKey="id"
                    scroll={{ x: 700 }}
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50"],
                        showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} metrics`,
                        style: { padding: "12px 16px", color: "var(--text-primary)" },
                    }}
                    rowClassName={() => "client-table-row"}
                    style={{ fontSize: 13 }}
                />
            </div>

            <Modal
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                confirmLoading={saving}
                title={editing ? "Edit Metric" : "Add Metric"}
                okText={editing ? "Save Changes" : "Add"}
                width={520}
                centered
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="Title" name="title" rules={[{ required: true, message: "Required" }]}>
                        <Input placeholder="e.g. CPM, CPC, CPL" />
                    </Form.Item>
                    <Form.Item label="Is Active" name="is_active" valuePropName="checked">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 36 }}>
                            <Switch defaultChecked />
                        </div>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}