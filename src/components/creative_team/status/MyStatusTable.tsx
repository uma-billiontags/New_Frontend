// StatusReportTable.tsx
// Shared table for "Completed Users" and "Overdue Users" status pages.
// Filters: ticket search, department select, role select (enabled after department).

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Input, Select, Button, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const BASE_URL = import.meta.env.VITE_BASE_URL;

const TASK_DEPARTMENTS = [
    'Creative Ops', 'Campaign Ops', 'Ad Ops', 'Finance', 'Design',
];

export interface StatusRow {
    id: number;
    ticket_id: string;
    task_type: string;
    department_title: string | null;
    role_title: string | null;
    role_id: number | null;
    assigned_to_name: string;
    status: string;
    assigned_at: string | null;
    due_at: string | null;
    updated_at: string | null;
    completed_at: string | null;
    reason: string | null;
}

interface DepartmentRoleUsers {
    role_id: number;
    role_title: string;
    users: { id: number; username: string; email: string }[];
}

function fmtDT(v?: string | null) {
    if (!v) return '—';
    return new Date(v).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function StatCard({ label, value, changeLabel, changeType }: {
    label: string; value: number; changeLabel: string; changeType: 'up' | 'down' | 'neutral';
}) {
    return (
        <div className="db-stat-card">
            <div className="db-stat-label">{label}</div>
            <div className="db-stat-value">{value}</div>
            <div className={`db-stat-change ${changeType === 'neutral' ? '' : changeType}`}
                style={changeType === 'neutral' ? { color: 'var(--text-muted)' } : undefined}>
                {changeLabel}
            </div>
        </div>
    );
}

export default function MyStatusTable({ reportType, title, subtitle }: {
    reportType: 'completed' | 'overdue';
    title: string;
    subtitle: string;
}) {
    const [rows, setRows] = useState<StatusRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [ticketSearch, setTicketSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState<string | undefined>(undefined);
    const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
    const [roles, setRoles] = useState<DepartmentRoleUsers[]>([]);
    const [rolesLoading, setRolesLoading] = useState(false);

    const isOverdue = reportType === 'overdue';

   const fetchRows = useCallback(() => {
    const userId = localStorage.getItem('user_id');   // ← ADD
    if (!userId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    fetch(`${BASE_URL}/tasks/get_status_report/?status=${reportType}&user_id=${userId}&task_type=creative_ops`, {   // ← CHANGED
        headers: { 'ngrok-skip-browser-warning': '1' },
    })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then((data: StatusRow[]) => setRows(Array.isArray(data) ? data : []))
        .catch(() => { setRows([]); message.error('Failed to load status report.'); })
        .finally(() => setLoading(false));
}, [reportType]);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    // ── Department picked → load its roles, reset role filter ──
    const handleDeptChange = async (dept: string | undefined) => {
        setDeptFilter(dept);
        setRoleFilter(undefined);
        setRoles([]);
        if (!dept) return;
        setRolesLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/tasks/get_department_users/${encodeURIComponent(dept)}/`, {
                headers: { 'ngrok-skip-browser-warning': '1' },
            });
            if (!res.ok) throw new Error();
            const data: DepartmentRoleUsers[] = await res.json();
            setRoles(Array.isArray(data) ? data : []);
        } catch {
            setRoles([]);
            message.error(`Couldn't load roles for ${dept}.`);
        } finally {
            setRolesLoading(false);
        }
    };

    const filtered = useMemo(() => rows.filter(r => {
        if (deptFilter && r.department_title?.toLowerCase() !== deptFilter.toLowerCase()) return false;
        if (roleFilter && r.role_title?.toLowerCase() !== roleFilter.toLowerCase()) return false;
        if (ticketSearch.trim()) {
            const q = ticketSearch.toLowerCase();
            const match =
                r.ticket_id?.toLowerCase().includes(q) ||
                r.assigned_to_name?.toLowerCase().includes(q) ||
                r.department_title?.toLowerCase().includes(q);
            if (!match) return false;
        }
        return true;
    }), [rows, deptFilter, roleFilter, ticketSearch]);

    // per-user counts for stat context
    const uniqueUsers = new Set(rows.map(r => r.assigned_to_name)).size;
    const uniqueTickets = new Set(rows.map(r => r.ticket_id)).size;

    const columns: ColumnsType<StatusRow> = [
        {
            title: 'Ticket ID', dataIndex: 'ticket_id', key: 'ticket_id', width: 130, fixed: 'left',
            render: (v: string) => (
                <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-bg)',
                    border: '1px solid var(--blue)', padding: '2px 10px', borderRadius: 6,
                    display: 'inline-block', whiteSpace: 'nowrap',
                }}>{v}</span>
            ),
        },
        {
            title: 'Department', dataIndex: 'department_title', key: 'department_title', width: 140,
            render: (v: string | null) => v ? (
                <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--purple)', background: 'var(--purple-bg)',
                    padding: '3px 9px', borderRadius: 6, display: 'inline-block', whiteSpace: 'nowrap',
                }}>{v}</span>
            ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>,
        },
        {
            title: 'Role', dataIndex: 'role_title', key: 'role_title', width: 150,
            render: (v: string | null) => <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{v || '—'}</span>,
        },
        {
            title: 'User', dataIndex: 'assigned_to_name', key: 'assigned_to_name', width: 150,
            render: (v: string) => (
                <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'var(--green-bg)',
                    border: '1px solid var(--green)', padding: '2px 10px', borderRadius: 6,
                    display: 'inline-block', whiteSpace: 'nowrap',
                }}>{v || '—'}</span>
            ),
        },
        {
            title: 'Status', dataIndex: 'status', key: 'status', width: 130,
            render: (v: string) => {
                const cfg: Record<string, { color: string; bg: string; label: string }> = {
                    completed: { color: 'var(--green)', bg: 'var(--green-bg)', label: 'Completed' },
                    reassigned: { color: 'var(--red)', bg: 'var(--red-bg)', label: 'Skipped' },
                    pending: { color: 'var(--amber)', bg: 'var(--amber-bg)', label: 'Pending' },
                    in_progress: { color: 'var(--blue)', bg: 'var(--blue-bg)', label: 'In Progress' },
                };
                const s = cfg[v] ?? { color: 'var(--text-muted)', bg: 'var(--bg-page)', label: v };
                return (
                    <span style={{
                        fontSize: 11, fontWeight: 700, color: s.color, background: s.bg,
                        border: `1px solid ${s.color}`, padding: '2px 10px', borderRadius: 6,
                        display: 'inline-block', whiteSpace: 'nowrap',
                    }}>{s.label}</span>
                );
            },
        },
        {
            title: 'Started (Assigned At)', dataIndex: 'assigned_at', key: 'assigned_at', width: 160,
            render: (v: string | null) => <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{fmtDT(v)}</span>,
        },
        {
            title: 'Due At', dataIndex: 'due_at', key: 'due_at', width: 160,
            render: (v: string | null, r: StatusRow) => {
                const missed = isOverdue && v;
                return (
                    <span style={{
                        fontSize: 12, fontWeight: missed ? 700 : 500,
                        color: missed ? 'var(--red)' : 'var(--text-primary)',
                    }}>{fmtDT(v)}</span>
                );
            },
        },
        {
            title: isOverdue ? 'Updated At' : 'Completed At',
            key: 'final_time', width: 160,
            render: (_: any, r: StatusRow) => (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {fmtDT(isOverdue ? r.updated_at : (r.completed_at || r.updated_at))}
                </span>
            ),
        },
    ];

    if (isOverdue) {
        columns.push({
            title: 'Reason', dataIndex: 'reason', key: 'reason', width: 260,
            render: (v: string | null) => v ? (
                <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--red)', background: 'var(--red-bg)',
                    border: '1px solid var(--red)', padding: '3px 10px', borderRadius: 6,
                    display: 'inline-block',
                }}>{v}</span>
            ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>,
        });
    }

    return (
        <div>
            {/* ── Page Header ── */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 8,
            }}>
                <div>
                    <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{title}</h1>
                    <p style={{
                        fontSize: 9, color: 'var(--text-muted)', margin: '4px 0 0',
                        fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>{subtitle}</p>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="db-stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <StatCard
                    label={isOverdue ? 'Total Overdue Records' : 'Total Completed Tasks'}
                    value={rows.length}
                    changeLabel={isOverdue ? 'Missed deadlines' : 'All departments'}
                    changeType={isOverdue ? (rows.length > 0 ? 'down' : 'neutral') : 'up'}
                />
                <StatCard label="Users Involved" value={uniqueUsers} changeLabel="Distinct people" changeType="neutral" />
                <StatCard label="Tickets Involved" value={uniqueTickets} changeLabel="Distinct tickets" changeType="neutral" />
            </div>

            {/* ── Filters: ticket search → department → role (dept-gated) ── */}
            <div style={{
                background: 'var(--bg-card)', borderRadius: 12, padding: '14px 18px',
                border: '1px solid var(--border)', marginBottom: 16, marginTop: 12,
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
                <Input
                    placeholder="Search by ticket ID, user, department…"
                    prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                    value={ticketSearch}
                    onChange={e => setTicketSearch(e.target.value)}
                    allowClear
                    style={{ flex: 1, minWidth: 220, height: 36 }}
                />
                <Select
                    value={deptFilter}
                    onChange={handleDeptChange}
                    placeholder="All Departments"
                    allowClear
                    style={{ width: 180, height: 36 }}
                    options={TASK_DEPARTMENTS.map(d => ({ value: d, label: d }))}
                />
                <Select
                    value={roleFilter}
                    onChange={setRoleFilter}
                    placeholder={!deptFilter ? 'Select department first' : rolesLoading ? 'Loading roles…' : 'All Roles'}
                    allowClear
                    disabled={!deptFilter || rolesLoading}
                    loading={rolesLoading}
                    style={{ width: 180, height: 36 }}
                    options={roles.map(r => ({ value: r.role_title, label: r.role_title }))}
                />
                <Button onClick={fetchRows} icon={<ReloadOutlined />}
                    style={{
                        height: 36, borderRadius: 8, border: '1px solid var(--text-muted)',
                        background: 'var(--bg-input)', color: 'var(--text-secondary)',
                        fontSize: 12, fontWeight: 600, paddingInline: 14,
                    }}>
                    Refresh
                </Button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {filtered.length} of {rows.length} records
                </span>
            </div>

            {/* ── Table ── */}
            <div style={{
                background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)',
                overflow: 'hidden', boxShadow: 'var(--shadow-card)',
            }}>
                <Table
                    columns={columns}
                    dataSource={filtered}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: isOverdue ? 1500 : 1250 }}
                    pagination={{
                        pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'],
                        showTotal: (t, r) => `${r[0]}–${r[1]} of ${t} records`,
                        style: { padding: '12px 16px' },
                    }}
                    locale={{ emptyText: isOverdue ? 'No overdue records. 🎉' : 'No completed tasks yet.' }}
                    rowClassName={() => 'all-campaigns-row'}
                    style={{ fontSize: 13 }}
                />
            </div>

            <style>{`
                .all-campaigns-row:hover td { background: var(--bg-card-hover) !important; }
            `}</style>
        </div>
    );
}