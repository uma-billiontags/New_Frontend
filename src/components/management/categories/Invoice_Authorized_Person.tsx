import { useEffect, useState, useCallback, useRef } from "react";
import { Table, Button, Input, Modal, Form, message, Image } from "antd";
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    SearchOutlined, UploadOutlined, EyeOutlined, FileImageOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const BASE_URL = import.meta.env.VITE_BASE_URL;

interface AuthorizedPerson {
    id: number;
    name: string;
    person_sign: string | null;       // absolute URL from DRF
    company_logo_sign: string | null; // absolute URL from DRF
}

// ── Helper: pull a readable filename out of a media URL ───────────────────────
function fileNameFromUrl(url: string | null): string {
    if (!url) return "—";
    try {
        const clean = url.split("?")[0];
        const parts = clean.split("/");
        return decodeURIComponent(parts[parts.length - 1] || "—");
    } catch {
        return "—";
    }
}

// ── File cell — filename + eye icon that opens a preview modal ───────────────
function FileCell({ url, onPreview }: { url: string | null; onPreview: (url: string) => void }) {
    if (!url) {
        return <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>;
    }
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
                fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160,
            }}>
                <FileImageOutlined style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                {fileNameFromUrl(url)}
            </span>
            <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => onPreview(url)}
                style={{
                    fontSize: 11, fontWeight: 600, height: 24, color: "var(--accent)",
                    borderColor: "var(--accent)", background: "var(--accent-light)", borderRadius: 6,
                }}
            />
        </div>
    );
}

export default function Invoice_Authorized_Person() {
    const [data, setData] = useState<AuthorizedPerson[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AuthorizedPerson | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const [personSignFile, setPersonSignFile] = useState<File | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const personSignRef = useRef<HTMLInputElement>(null);
    const logoRef = useRef<HTMLInputElement>(null);

    // ── Preview modal state ──
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const fetchData = useCallback(() => {
        setLoading(true);
        fetch(`${BASE_URL}/categories/get_all_authorized_persons/`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => r.json())
            .then((d) => setData(Array.isArray(d) ? d : d.results || []))
            .catch(() => message.error("Failed to load authorized persons"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openAdd = () => {
        setEditing(null);
        form.resetFields();
        setPersonSignFile(null);
        setLogoFile(null);
        setModalOpen(true);
    };

    const openEdit = (record: AuthorizedPerson) => {
        setEditing(record);
        form.setFieldsValue({ name: record.name });
        setPersonSignFile(null);
        setLogoFile(null);
        setModalOpen(true);
    };

    const handleSave = async () => {
        try { await form.validateFields(); } catch { return; }
        const values = form.getFieldsValue();

        if (!editing && (!personSignFile || !logoFile)) {
            message.error("Both signature and company seal images are required");
            return;
        }

        setSaving(true);
        const fd = new FormData();
        fd.append("name", values.name);
        if (personSignFile) fd.append("person_sign", personSignFile);
        if (logoFile) fd.append("company_logo_sign", logoFile);

        const isEdit = !!editing;
        const url = isEdit
            ? `${BASE_URL}/categories/edit_authorized_person/${editing.id}/`
            : `${BASE_URL}/categories/create_authorized_person/`;
        try {
            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: { "ngrok-skip-browser-warning": "1" },
                body: fd,
            });
            if (res.ok) {
                message.success(isEdit ? "Updated successfully" : "Added successfully");
                setModalOpen(false);
                fetchData();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(JSON.stringify(err) || "Save failed");
            }
        } catch { message.error("Network error"); }
        finally { setSaving(false); }
    };

    const handleDelete = (record: AuthorizedPerson) => {
        Modal.confirm({
            title: "Delete authorized person?",
            content: `Are you sure you want to delete "${record.name}"? This cannot be undone.`,
            okText: "Yes, Delete",
            okButtonProps: { danger: true },
            cancelText: "Cancel",
            onOk: async () => {
                try {
                    const res = await fetch(`${BASE_URL}/categories/delete_authorized_person/${record.id}/`, {
                        method: "DELETE",
                        headers: { "ngrok-skip-browser-warning": "1" },
                    });
                    if (res.ok) { message.success("Deleted successfully"); fetchData(); }
                    else message.error("Failed to delete");
                } catch { message.error("Network error"); }
            },
        });
    };

    const filtered = data.filter((d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()));

    const columns: ColumnsType<AuthorizedPerson> = [
        { title: "ID", dataIndex: "id", key: "id", width: 70 },
        { title: "Name", dataIndex: "name", key: "name" },
        {
            title: "Signature", dataIndex: "person_sign", key: "person_sign", width: 200,
            render: (v: string | null) => <FileCell url={v} onPreview={setPreviewUrl} />,
        },
        {
            title: "Company Seal", dataIndex: "company_logo_sign", key: "company_logo_sign", width: 200,
            render: (v: string | null) => <FileCell url={v} onPreview={setPreviewUrl} />,
        },
        {
            title: "Actions", key: "actions", width: 160,
            render: (_: any, record: AuthorizedPerson) => (
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
            {/* ── Page Header — matches Invoice_Bank_Details.tsx ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                <div>
                    <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>Invoice Authorized Person</h1>
                    <p style={{
                        fontSize: 9, color: "var(--text-muted)", margin: "4px 0 0",
                        fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>
                        Add authorized persons to sign and seal invoices
                    </p>
                </div>
                <Button onClick={openAdd} icon={<PlusOutlined />}
                    style={{
                        borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff",
                        fontSize: 12, fontWeight: 700, padding: "8px 16px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                    }}>
                    Add New
                </Button>
            </div>

            {/* ── Search + Count — matches Invoice_Bank_Details.tsx ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <Input placeholder="Search by name…"
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
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {filtered.length} of {data.length} person{data.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* ── Ant Design Table — matches Invoice_Bank_Details.tsx ── */}
            <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
                <Table
                    columns={columns}
                    dataSource={filtered}
                    rowKey="id"
                    scroll={{ x: 900 }}
                    loading={loading}
                    pagination={{
                        pageSize: 5,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50"],
                        showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} persons`,
                        style: { padding: "12px 16px", color: "var(--text-primary)" },
                    }}
                    rowClassName={() => "client-table-row"}
                    style={{ fontSize: 13 }}
                />
            </div>

            {/* ── Add/Edit Modal — matches Invoice_Bank_Details.tsx form layout ── */}
            <Modal
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                confirmLoading={saving}
                title={editing ? "Edit Authorized Person" : "Add Authorized Person"}
                okText={editing ? "Save Changes" : "Add"}
                width={700}
                centered
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="Name" name="name" rules={[{ required: true, message: "Required" }]}>
                        <Input placeholder="e.g. John Doe" />
                    </Form.Item>

                    <div className="db-form-row">
                        <Form.Item label={
                            <span>
                                Signature Image
                                {editing && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> (leave blank to keep existing)</span>}
                            </span>
                        }>
                            <input ref={personSignRef} type="file" accept="image/*" style={{ display: "none" }}
                                onChange={(e) => setPersonSignFile(e.target.files?.[0] || null)} />
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Button icon={<UploadOutlined />} onClick={() => personSignRef.current?.click()} style={{ flex: 1 }}>
                                    {personSignFile ? personSignFile.name : "Choose Signature File"}
                                </Button>
                                {editing?.person_sign && !personSignFile && (
                                    <Button
                                        icon={<EyeOutlined />}
                                        onClick={() => setPreviewUrl(editing.person_sign)}
                                        style={{ color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-light)" }}
                                    />
                                )}
                            </div>
                        </Form.Item>

                        <Form.Item label={
                            <span>
                                Company Seal Image
                                {editing && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> (leave blank to keep existing)</span>}
                            </span>
                        }>
                            <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }}
                                onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Button icon={<UploadOutlined />} onClick={() => logoRef.current?.click()} style={{ flex: 1 }}>
                                    {logoFile ? logoFile.name : "Choose Company Seal File"}
                                </Button>
                                {editing?.company_logo_sign && !logoFile && (
                                    <Button
                                        icon={<EyeOutlined />}
                                        onClick={() => setPreviewUrl(editing.company_logo_sign)}
                                        style={{ color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-light)" }}
                                    />
                                )}
                            </div>
                        </Form.Item>
                    </div>
                </Form>
            </Modal>

            {/* ── Preview Modal ── */}
            <Modal
                open={!!previewUrl}
                onCancel={() => setPreviewUrl(null)}
                footer={null}
                centered
                width={480}
                title="Preview"
            >
                {previewUrl && (
                    <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
                        <Image src={previewUrl} style={{ maxWidth: "100%", maxHeight: 360, objectFit: "contain" }} preview={false} />
                    </div>
                )}
            </Modal>
        </div>
    );
}