import { useEffect, useState, useCallback } from "react";
import { Table, Button, Input, Modal, Switch, Form, message } from "antd";
import {
    SearchOutlined, ReloadOutlined, EditOutlined,
    PlusOutlined, DeleteOutlined, CloseOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Role {
    id: number;
    title: string;
    is_active: boolean;
    department: number;
    department_title?: string;
}

interface Department {
    id: number;
    title: string;
    is_active: boolean;
    roles: Role[];
}

// role row inside the edit form — id is undefined for a brand-new, unsaved role
interface RoleRow {
    key: string;
    id?: number;
    title: string;
    is_active: boolean;
}

function makeRoleRow(): RoleRow {
    return { key: `role_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, title: "", is_active: true };
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, changeLabel, changeType }: {
    label: string; value: number; changeLabel: string; changeType: "up" | "down" | "neutral";
}) {
    return (
        <div className="db-stat-card">
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function Department() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Department | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const [title, setTitle] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
    const [rolesToDelete, setRolesToDelete] = useState<number[]>([]);

    const fetchData = useCallback(() => {
        setLoading(true);
        fetch(`${BASE_URL}/categories/get_all_departments/`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => r.json())
            .then((d) => setDepartments(Array.isArray(d) ? d : d.results || []))
            .catch(() => message.error("Failed to load departments"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const totalDepartments = departments.length;
    const activeDepartments = departments.filter((d) => d.is_active).length;
    const totalRoles = departments.reduce((sum, d) => sum + (d.roles?.length ?? 0), 0);

    const openAdd = () => {
        setEditing(null);
        setTitle("");
        setIsActive(true);
        setRoleRows([makeRoleRow()]);
        setRolesToDelete([]);
        form.resetFields();
        setModalOpen(true);
    };

    const openEdit = (record: Department) => {
        setEditing(record);
        setTitle(record.title);
        setIsActive(record.is_active);
        setRoleRows(
            record.roles?.length
                ? record.roles.map((r) => ({ key: `role_${r.id}`, id: r.id, title: r.title, is_active: r.is_active }))
                : [makeRoleRow()]
        );
        setRolesToDelete([]);
        form.setFieldsValue({ title: record.title });
        setModalOpen(true);
    };

    const updateRole = (key: string, patch: Partial<RoleRow>) =>
        setRoleRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

    const addRoleRow = () => setRoleRows((prev) => [...prev, makeRoleRow()]);

    const removeRoleRow = (key: string) => {
        const row = roleRows.find((r) => r.key === key);
        if (row?.id) setRolesToDelete((prev) => [...prev, row.id!]);
        setRoleRows((prev) => prev.filter((r) => r.key !== key));
    };

    const jsonHeaders = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" };

    const handleSave = async () => {
        try { await form.validateFields(); } catch { return; }
        if (!title.trim()) {
            message.error("Department title is required");
            return;
        }
        setSaving(true);
        const isEdit = !!editing;
        try {
            let deptId = editing?.id;

            if (isEdit) {
                const res = await fetch(`${BASE_URL}/categories/edit_department/${deptId}/`, {
                    method: "PATCH", headers: jsonHeaders,
                    body: JSON.stringify({ title, is_active: isActive }),
                });
                if (!res.ok) throw new Error("Failed to update department");
            } else {
                const res = await fetch(`${BASE_URL}/categories/create_department/`, {
                    method: "POST", headers: jsonHeaders,
                    body: JSON.stringify({ title, is_active: isActive }),
                });
                if (!res.ok) throw new Error("Failed to create department");
                const data = await res.json();
                deptId = data.id;
            }

            for (const roleId of rolesToDelete) {
                await fetch(`${BASE_URL}/categories/delete_role/${roleId}/`, {
                    method: "DELETE", headers: { "ngrok-skip-browser-warning": "1" },
                });
            }

            for (const row of roleRows) {
                if (!row.title.trim()) continue;
                if (row.id) {
                    await fetch(`${BASE_URL}/categories/edit_role/${row.id}/`, {
                        method: "PATCH", headers: jsonHeaders,
                        body: JSON.stringify({ title: row.title, is_active: row.is_active }),
                    });
                } else {
                    await fetch(`${BASE_URL}/categories/create_role/`, {
                        method: "POST", headers: jsonHeaders,
                        body: JSON.stringify({ department: deptId, title: row.title, is_active: row.is_active }),
                    });
                }
            }

            message.success(isEdit ? "Department updated" : "Department added");
            setModalOpen(false);
            fetchData();
        } catch (err) {
            message.error(err instanceof Error ? err.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (record: Department) => {
        Modal.confirm({
            title: "Delete department?",
            content: `Are you sure you want to delete "${record.title}"? This will also delete its ${record.roles?.length ?? 0} role(s). This cannot be undone.`,
            okText: "Yes, Delete",
            okButtonProps: { danger: true },
            cancelText: "Cancel",
            onOk: async () => {
                try {
                    const res = await fetch(`${BASE_URL}/categories/delete_department/${record.id}/`, {
                        method: "DELETE",
                        headers: { "ngrok-skip-browser-warning": "1" },
                    });
                    if (res.ok) { message.success("Deleted successfully"); fetchData(); }
                    else message.error("Failed to delete");
                } catch { message.error("Network error"); }
            },
        });
    };

    const filtered = departments.filter((d) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return d.title.toLowerCase().includes(q) || d.roles?.some((r) => r.title.toLowerCase().includes(q));
    });

    const columns: ColumnsType<Department> = [
        { title: "Department", dataIndex: "title", key: "title", width: 200 },
        {
            title: "Roles",
            key: "roles",
            render: (_: any, record: Department) =>
                record.roles?.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {record.roles.map((r) => (
                            <span
                                key={r.id}
                                style={{
                                    fontSize: 11, fontWeight: 600,
                                    color: r.is_active ? "var(--purple)" : "var(--text-muted)",
                                    background: r.is_active ? "var(--purple-bg)" : "var(--bg-input)",
                                    padding: "2px 9px", borderRadius: 6, whiteSpace: "nowrap",
                                }}
                            >
                                {r.title}
                            </span>
                        ))}
                    </div>
                ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No roles yet</span>
                ),
        },
        {
            title: "Role Count",
            key: "role_count",
            width: 110,
            render: (_: any, record: Department) => (
                <span style={{
                    fontSize: 11, fontWeight: 700, color: "var(--blue)", background: "var(--blue-bg)",
                    border: "1px solid var(--blue)", padding: "2px 10px", borderRadius: 6, whiteSpace: "nowrap",
                }}>
                    {record.roles?.length ?? 0}
                </span>
            ),
        },
        {
            title: "Status",
            dataIndex: "is_active",
            key: "is_active",
            width: 110,
            render: (v: boolean) => (
                <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 10,
                    color: v ? "var(--green)" : "var(--red)",
                    background: v ? "var(--green-bg)" : "var(--red-bg)",
                }}>{v ? "Active" : "Inactive"}</span>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            width: 160,
            render: (_: any, record: Department) => (
                <div style={{ display: "flex", gap: 6 }}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}
                        style={{  fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                color: "var(--blue)", borderColor: "var(--blue)", background: "var(--blue-bg)" }}>Edit</Button>
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
                    <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>Departments</h1>
                    <p style={{ fontSize: 9, color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        Manage departments and their roles
                    </p>
                </div>
                <Button onClick={openAdd} icon={<PlusOutlined />}
                    style={{
                        borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff",
                        fontSize: 12, fontWeight: 700, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6,
                    }}>
                    Add Department
                </Button>
            </div>

            {/* ── Stat Cards ── */}
            <div className="db-stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <StatCard label="Total Departments" value={totalDepartments} changeLabel={`${activeDepartments} active`} changeType="up" />
                <StatCard label="Active Departments" value={activeDepartments} changeLabel="Currently in use" changeType="neutral" />
                <StatCard label="Total Roles" value={totalRoles} changeLabel="Across all departments" changeType="neutral" />
            </div>

            {/* ── Search + Count ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <Input
                    placeholder="Search by department or role…"
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
                    {filtered.length} of {departments.length} departments
                </span>
            </div>

            {/* ── Ant Design Table ── */}
            <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
                <Table
                    columns={columns}
                    dataSource={filtered}
                    rowKey="id"
                    scroll={{ x: 900 }}
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50"],
                        showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} departments`,
                        style: { padding: "12px 16px", color: "var(--text-primary)" },
                    }}
                    rowClassName={() => "client-table-row"}
                    style={{ fontSize: 13 }}
                />
            </div>

            {/* ── Add/Edit Modal — plain AntD Modal, matches Invoice_Bank_Details.tsx ── */}
            <Modal
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                confirmLoading={saving}
                title={editing ? "Edit Department" : "Add Department"}
                okText={editing ? "Save Changes" : "Add"}
                width={800}
                centered
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <div className="db-form-row">
                        <Form.Item
                            label="Department Title"
                            name="title"
                            rules={[{ required: true, message: "Required" }]}
                        >
                            <Input
                                placeholder="e.g. Creative"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </Form.Item>
                        <Form.Item label="Is Active">
                            <div style={{ display: "flex", alignItems: "center", gap: 10, height: 36 }}>
                                <Switch checked={isActive} onChange={setIsActive} />
                                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                    {isActive ? "Active" : "Inactive"}
                                </span>
                            </div>
                        </Form.Item>
                    </div>
                </Form>

                {/* ── Roles section ── */}
                <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                        Roles
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 32px", gap: 10, marginBottom: 8, fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        <span>Title</span>
                        <span>Is Active</span>
                        <span></span>
                    </div>

                    {roleRows.map((row) => (
                        <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr 90px 32px", gap: 10, alignItems: "center", marginBottom: 10 }}>
                            <Input
                                placeholder="e.g. Account Director"
                                value={row.title}
                                onChange={(e) => updateRole(row.key, { title: e.target.value })}
                            />
                            <Switch checked={row.is_active} onChange={(v) => updateRole(row.key, { is_active: v })} />
                            <button
                                onClick={() => removeRoleRow(row.key)}
                                style={{
                                    width: 26, height: 26, borderRadius: "50%", border: "1px solid var(--red)",
                                    background: "var(--red-bg)", color: "var(--red)", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                                }}
                            >
                                <CloseOutlined style={{ fontSize: 10 }} />
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={addRoleRow}
                        style={{
                            display: "flex", alignItems: "center", gap: 6, marginTop: 4,
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--accent)", fontSize: 12, fontWeight: 600, padding: "6px 0",
                        }}
                    >
                        <PlusOutlined /> Add another Role
                    </button>
                </div>
            </Modal>
        </div>
    );
}