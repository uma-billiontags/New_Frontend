import { useEffect, useState, useCallback } from "react";
import { Table, Button, Input, Modal, Select, Switch, Form, message } from "antd";
import {
    SearchOutlined, ReloadOutlined, EditOutlined,
    PlusOutlined, DeleteOutlined, UserOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Role {
    id: number;
    title: string;
    is_active: boolean;
    department: number;
}

interface Department {
    id: number;
    title: string;
    is_active: boolean;
    roles: Role[];
}

interface UserCredential {
    id: number;
    username: string;
    email: string | null;
    department: number;
    department_title: string;
    role: number;
    role_title: string;
    is_active: boolean;
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
export default function Team_Access() {
    const [users, setUsers] = useState<UserCredential[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<UserCredential | null>(null);
    const [saving, setSaving] = useState(false);
    const [selectedDeptId, setSelectedDeptId] = useState<number | undefined>(undefined);
    const [form] = Form.useForm();

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchUsers = useCallback(() => {
        setLoading(true);
        fetch(`${BASE_URL}/categories/get_all_user_credentials/`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => r.json())
            .then((d) => setUsers(Array.isArray(d) ? d : d.results || []))
            .catch(() => message.error("Failed to load user credentials"))
            .finally(() => setLoading(false));
    }, []);

    const fetchDepartments = useCallback(() => {
        fetch(`${BASE_URL}/categories/get_all_departments/`, {
            headers: { "ngrok-skip-browser-warning": "1" },
        })
            .then((r) => r.json())
            .then((d) => setDepartments(Array.isArray(d) ? d : d.results || []))
            .catch(() => message.error("Failed to load departments"));
    }, []);

    useEffect(() => { fetchUsers(); fetchDepartments(); }, [fetchUsers, fetchDepartments]);

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.is_active).length;
    const totalDepartmentsInUse = new Set(users.map((u) => u.department)).size;

    // ── Modal open/close ─────────────────────────────────────────────────────
    const openAdd = () => {
        setEditing(null);
        setSelectedDeptId(undefined);
        form.resetFields();
        form.setFieldsValue({ is_active: true });
        setModalOpen(true);
    };

    const openEdit = (record: UserCredential) => {
        setEditing(record);
        setSelectedDeptId(record.department);
        form.setFieldsValue({
            username: record.username,
            email: record.email,
            department: record.department,
            role: record.role,
            is_active: record.is_active,
            password: "",
        });
        setModalOpen(true);
    };

    // roles available for whichever department is currently selected in the form
    const rolesForSelectedDept = departments.find((d) => d.id === selectedDeptId)?.roles ?? [];

    const handleDepartmentChange = (deptId: number) => {
        setSelectedDeptId(deptId);
        form.setFieldsValue({ role: undefined }); // clear role — it belonged to the old department
    };

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        let values;
        try {
            values = await form.validateFields();
        } catch {
            return;
        }

        setSaving(true);
        const isEdit = !!editing;
        const payload: Record<string, unknown> = {
            username: values.username,
            email: values.email || null,
            department: values.department,
            role: values.role,
            is_active: values.is_active,
        };
        // only send password if the user actually typed one — required on create, optional on edit
        if (values.password) payload.password = values.password;

        const url = isEdit
            ? `${BASE_URL}/categories/edit_user_credential/${editing.id}/`
            : `${BASE_URL}/categories/create_user_credential/`;

        try {
            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                message.success(isEdit ? "User credential updated" : "User credential added");
                setModalOpen(false);
                fetchUsers();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(JSON.stringify(err) || "Save failed");
            }
        } catch {
            message.error("Network error");
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDelete = (record: UserCredential) => {
        Modal.confirm({
            title: "Delete user credential?",
            content: `Are you sure you want to delete "${record.username}"? This cannot be undone.`,
            okText: "Yes, Delete",
            okButtonProps: { danger: true },
            cancelText: "Cancel",
            onOk: async () => {
                try {
                    const res = await fetch(`${BASE_URL}/categories/delete_user_credential/${record.id}/`, {
                        method: "DELETE",
                        headers: { "ngrok-skip-browser-warning": "1" },
                    });
                    if (res.ok) { message.success("Deleted successfully"); fetchUsers(); }
                    else message.error("Failed to delete");
                } catch { message.error("Network error"); }
            },
        });
    };

    // ── Toggle active/inactive inline ────────────────────────────────────────
    const toggleActive = async (record: UserCredential) => {
        try {
            const res = await fetch(`${BASE_URL}/categories/edit_user_credential/${record.id}/`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
                body: JSON.stringify({ is_active: !record.is_active }),
            });
            if (res.ok) {
                setUsers((prev) => prev.map((u) => (u.id === record.id ? { ...u, is_active: !u.is_active } : u)));
            } else {
                message.error("Failed to update status");
            }
        } catch {
            message.error("Network error");
        }
    };

    const filtered = users.filter((u) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return [u.username, u.email, u.department_title, u.role_title].some((f) => f?.toLowerCase().includes(q));
    });

    // ── Table columns ────────────────────────────────────────────────────────
    const columns: ColumnsType<UserCredential> = [
        {
            title: "Username",
            dataIndex: "username",
            key: "username",
            render: (v: string) => (
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{v}</span>
            ),
        },
        {
            title: "Email",
            dataIndex: "email",
            key: "email",
            render: (v: string | null) => (
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{v || "—"}</span>
            ),
        },
        {
            title: "Department",
            dataIndex: "department_title",
            key: "department_title",
            render: (v: string) => (
                <span style={{
                    fontSize: 11, fontWeight: 600, color: "var(--blue)", background: "var(--blue-bg)",
                    border: "1px solid var(--blue)", padding: "2px 10px", borderRadius: 6, whiteSpace: "nowrap",
                }}>
                    {v}
                </span>
            ),
        },
        {
            title: "Role",
            dataIndex: "role_title",
            key: "role_title",
            render: (v: string) => (
                <span style={{
                    fontSize: 11, fontWeight: 600, color: "var(--purple)", background: "var(--purple-bg)",
                    padding: "2px 10px", borderRadius: 6, whiteSpace: "nowrap",
                }}>
                    {v}
                </span>
            ),
        },
        {
            title: "Password",
            key: "password",
            width: 100,
            render: () => (
                <span style={{ fontSize: 13, color: "var(--text-muted)", letterSpacing: 2 }}>••••••••</span>
            ),
        },
        {
            title: "Status",
            key: "is_active",
            width: 110,
            render: (_: any, record: UserCredential) => (
                <span
                    onClick={() => toggleActive(record)}
                    style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 10, cursor: "pointer",
                        color: record.is_active ? "var(--green)" : "var(--red)",
                        background: record.is_active ? "var(--green-bg)" : "var(--red-bg)",
                    }}
                >
                    {record.is_active ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            width: 160,
            render: (_: any, record: UserCredential) => (
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
            {/* ── Page Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                <div>
                    <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>Team Access</h1>
                    <p style={{ fontSize: 9, color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        Manage user credentials by department and role
                    </p>
                </div>
                <Button onClick={openAdd} icon={<PlusOutlined />}
                    style={{
                        borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff",
                        fontSize: 12, fontWeight: 700, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6,
                    }}>
                    Add User
                </Button>
            </div>

            {/* ── Stat Cards ── */}
            <div className="db-stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <StatCard label="Total Users" value={totalUsers} changeLabel={`${activeUsers} active`} changeType="up" />
                <StatCard label="Active Users" value={activeUsers} changeLabel="Currently enabled" changeType="neutral" />
                <StatCard label="Departments In Use" value={totalDepartmentsInUse} changeLabel="Across all users" changeType="neutral" />
            </div>

            {/* ── Search + Refresh ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <Input
                    placeholder="Search by username, email, department, role…"
                    prefix={<SearchOutlined style={{ color: "var(--text-muted)" }} />}
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
                    onClick={fetchUsers}
                    icon={<ReloadOutlined />}
                    className="db-card-action"
                    style={{ height: 35, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, paddingInline: 14 }}
                >
                    Refresh
                </Button>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {filtered.length} of {users.length} users
                </span>
            </div>

            {/* ── Table ── */}
            <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
                <Table
                    columns={columns}
                    dataSource={filtered}
                    rowKey="id"
                    scroll={{ x: 1100 }}
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50"],
                        showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} users`,
                        style: { padding: "12px 16px", color: "var(--text-primary)" },
                    }}
                    rowClassName={() => "client-table-row"}
                    style={{ fontSize: 13 }}
                />
            </div>

            {/* ── Add/Edit Modal ── */}
            <Modal
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                confirmLoading={saving}
                title={
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <UserOutlined /> {editing ? "Edit User Credential" : "Add User Credential"}
                    </span>
                }
                okText={editing ? "Save Changes" : "Add"}
                width={700}
                centered
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <div className="db-form-row">
                        <Form.Item label="Username" name="username" rules={[{ required: true, message: "Required" }]}>
                            <Input placeholder="e.g. jane.doe" />
                        </Form.Item>
                        <Form.Item label="Email" name="email" rules={[{ type: "email", message: "Enter a valid email" }]}>
                            <Input placeholder="name@company.com" />
                        </Form.Item>
                    </div>

                    <div className="db-form-row">
                        <Form.Item
                            label="Department"
                            name="department"
                            rules={[{ required: true, message: "Required" }]}
                        >
                            <Select
                                placeholder="Select department"
                                onChange={handleDepartmentChange}
                                options={departments.map((d) => ({ value: d.id, label: d.title }))}
                            />
                        </Form.Item>
                        <Form.Item
                            label="Role"
                            name="role"
                            rules={[{ required: true, message: "Required" }]}
                        >
                            <Select
                                placeholder={selectedDeptId ? "Select role" : "Select department first"}
                                disabled={!selectedDeptId}
                                options={rolesForSelectedDept.map((r) => ({ value: r.id, label: r.title }))}
                            />
                        </Form.Item>
                    </div>

                    <div className="db-form-row">
                        <Form.Item
                            label="Password"
                            name="password"
                            rules={editing ? [] : [{ required: true, message: "Password is required" }]}
                        >
                            <Input.Password placeholder={editing ? "Leave blank to keep unchanged" : "Min 8 characters"} />
                        </Form.Item>
                        <Form.Item label="Is Active" name="is_active" valuePropName="checked">
                            <div style={{ display: "flex", alignItems: "center", gap: 10, height: 36 }}>
                                <Switch defaultChecked />
                            </div>
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}