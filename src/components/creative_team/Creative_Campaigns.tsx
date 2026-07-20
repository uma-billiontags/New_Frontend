// Creative_Campaigns.tsx
// Shows the campaigns (grouped by Ticket ID) assigned to the CURRENTLY LOGGED-IN creative ops
// user only. Each row shows the turnaround deadline, a live countdown, current status, and a
// "Mark Complete" action that calls /tasks/mark_task_complete/<task_id>/. Expanding a row shows
// its line items with the full creatives breakdown (CreativesCell).

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Input, Button, Typography, message, Popconfirm } from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import CreativesCell from './CreativesCell';

const { Text } = Typography;

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────
interface CreativeDetail {
  id?: number;
  type?: 'standard' | 'third_party';
  creative_name?: string;
  dimensions?: string;
  click_through_url?: string;
  appended_html_tag?: string;
  main_asset?: string;
  main_asset_url?: string;
  creative_id?: string;
}

interface LineItem {
  line_item_id: string;
  line_item_name: string;
  start_date: string;
  end_date: string;
  ad_format: string | string[];
  ad_sub_format?: string;
  ethnicity?: string | string[];
  impressions?: string;
  status?: string;
  creatives?: CreativeDetail[];
  image_creatives?: string[];
  video_creatives?: string[];
  third_party_creatives?: {
    id?: number;
    input_file?: string;
    input_file_url?: string;
    backup_image?: string;
    creative_id?: string;
  }[];
}

interface Campaign {
  campaign_id: string;
  ticket_id?: string | null;
  campaign_name: string;
  advertiser?: string;
  client_name?: string;
  start_date?: string;
  end_date?: string;
  line_items?: LineItem[];
  approval_status?: string;
}

// Shape returned by /tasks/get_assignments_for_tickets/ (TaskAssignmentSerializer)
interface TaskAssignmentRecord {
  id: number;
  ticket_id: string;
  task_type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: number | { id: number } | null;
  assigned_to_id?: number;
  deadline_hours?: number | null;
  due_at?: string | null;
  assigned_at?: string | null;
  completed_at?: string | null;
}

// Merged row used by the table
interface MyTask extends Campaign {
  task_id: number;
  status: TaskAssignmentRecord['status'];
  due_at: string | null;
  deadline_hours: number | null;
  assigned_at: string | null;
}

const TASK_TYPE = 'creative_ops';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getAssignedToId(rec: TaskAssignmentRecord): number | undefined {
  if (typeof rec.assigned_to === 'number') return rec.assigned_to;
  if (rec.assigned_to && typeof rec.assigned_to === 'object') return rec.assigned_to.id;
  return rec.assigned_to_id;
}

function formatCountdown(dueAt: string | null): { label: string; overdue: boolean } {
  if (!dueAt) return { label: '—', overdue: false };
  const diffMs = new Date(dueAt).getTime() - Date.now();
  if (diffMs <= 0) {
    const overdueMins = Math.round(Math.abs(diffMs) / 60000);
    if (overdueMins < 60) return { label: `Overdue by ${overdueMins}m`, overdue: true };
    const hrs = Math.floor(overdueMins / 60);
    return { label: `Overdue by ${hrs}h ${overdueMins % 60}m`, overdue: true };
  }
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return { label: `${mins}m left`, overdue: false };
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return { label: `${hrs}h ${remMins}m left`, overdue: false };
  const days = Math.floor(hrs / 24);
  return { label: `${days}d ${hrs % 24}h left`, overdue: false };
}

function statusTag(status: MyTask['status']) {
  const cfg: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
    pending: { color: 'var(--amber)', bg: 'var(--amber-bg)', label: 'Pending', icon: <ClockCircleOutlined /> },
    in_progress: { color: 'var(--blue)', bg: 'var(--blue-bg)', label: 'In Progress', icon: <ClockCircleOutlined /> },
    completed: { color: 'var(--green)', bg: 'var(--green-bg)', label: 'Completed', icon: <CheckCircleOutlined /> },
    cancelled: { color: 'var(--text-muted)', bg: 'var(--bg-input)', label: 'Cancelled', icon: <ExclamationCircleOutlined /> },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, color: c.color, background: c.bg,
      border: `1px solid ${c.color}`, padding: '3px 9px', borderRadius: 20,
    }}>
      {c.icon} {c.label}
    </span>
  );
}

// ── StatCard — flat style matching Platform Overview / All Campaigns cards ──
function StatCard({ label, value, changeLabel, changeType }: {
  label: string; value: number; changeLabel: string;
  changeType: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="db-stat-card">
      <div className="db-stat-label">{label}</div>
      <div className="db-stat-value">{value}</div>
      <div
        className={`db-stat-change ${changeType === 'neutral' ? '' : changeType}`}
        style={changeType === 'neutral' ? { color: 'var(--text-muted)' } : undefined}
      >
        {changeLabel}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Creative_Campaigns() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [filtered, setFiltered] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [, forceTick] = useState(0); // re-render every 30s so countdowns stay live

  const userId = localStorage.getItem('user_id');

  // ── Fetch: campaigns + assignments, merged & scoped to this user ──
  const fetchMyTasks = useCallback(async () => {
    if (!userId) {
      message.error('No logged-in user found. Please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. All campaigns that carry a ticket_id
      const campRes = await fetch(`${BASE_URL}/campaigns/get_campaigns/`, {
        headers: { 'ngrok-skip-browser-warning': '1' },
      });
      if (!campRes.ok) throw new Error('campaigns');
      const campData = await campRes.json();
      const campaigns: Campaign[] = Array.isArray(campData) ? campData : campData?.campaigns ?? [];
      const withTicket = campaigns.filter(c => c.ticket_id);

      const ticketIds = withTicket.map(c => c.ticket_id).filter(Boolean) as string[];
      if (ticketIds.length === 0) {
        setTasks([]);
        setFiltered([]);
        return;
      }

      // 2. Task assignments for those tickets, this department's task_type only
      const assignRes = await fetch(
        `${BASE_URL}/tasks/get_assignments_for_tickets/?ticket_ids=${encodeURIComponent(ticketIds.join(','))}&task_type=${TASK_TYPE}`,
        { headers: { 'ngrok-skip-browser-warning': '1' } }
      );
      if (!assignRes.ok) throw new Error('assignments');
      const assignments: TaskAssignmentRecord[] = await assignRes.json();

      // 3. Keep only assignments belonging to the logged-in user
      const myAssignments = assignments.filter(a => String(getAssignedToId(a)) === String(userId));

      // 4. Merge full campaign details (incl. line items + creatives) onto each of my assignments
      const merged: MyTask[] = myAssignments
        .map(a => {
          const campaign = withTicket.find(c => c.ticket_id === a.ticket_id);
          if (!campaign) return null;
          return {
            ...campaign,
            task_id: a.id,
            status: a.status,
            due_at: a.due_at ?? null,
            deadline_hours: a.deadline_hours ?? null,
            assigned_at: a.assigned_at ?? null,
          } as MyTask;
        })
        .filter((t): t is MyTask => t !== null)
        // show pending/in_progress first, completed at the bottom
        .sort((a, b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0));

      setTasks(merged);
      setFiltered(merged);
    } catch {
      setTasks([]);
      setFiltered([]);
      message.error('Failed to load your assigned tasks.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchMyTasks(); }, [fetchMyTasks]);

  // live-refresh countdown labels every 30s (no refetch, just re-render)
  useEffect(() => {
    const t = setInterval(() => forceTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(tasks); return; }
    const q = search.toLowerCase();
    setFiltered(tasks.filter(t =>
      t.campaign_name?.toLowerCase().includes(q) ||
      t.ticket_id?.toLowerCase().includes(q) ||
      t.advertiser?.toLowerCase().includes(q)
    ));
  }, [search, tasks]);

  const pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const overdueCount = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'cancelled' || !t.due_at) return false;
    return new Date(t.due_at).getTime() < Date.now();
  }).length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  // ── Mark a task complete ──
  const handleMarkComplete = async (task: MyTask) => {
    setCompletingId(task.task_id);
    try {
      const res = await fetch(`${BASE_URL}/tasks/mark_task_complete/${task.task_id}/`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': '1' },
      });
      if (res.ok) {
        message.success(`"${task.campaign_name}" marked as completed.`);
        setTasks(prev => prev.map(t => t.task_id === task.task_id ? { ...t, status: 'completed' } : t));
      } else {
        message.error('Failed to mark task complete. Please try again.');
      }
    } catch {
      message.error('Network error while updating status.');
    } finally {
      setCompletingId(null);
    }
  };

  // ── Expanded row: line items + creatives (same pattern as Creative_Dashboard) ──
  const lineItemColumns: ColumnsType<LineItem> = [
    {
      title: 'Line Item ID', dataIndex: 'line_item_id', width: 140,
      render: (v: string) => (
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: 'var(--purple)', background: 'var(--purple-bg)', padding: '2px 6px', borderRadius: 4,
        }}>{v}</span>
      ),
    },
    {
      title: 'Line Item Name', dataIndex: 'line_item_name', width: 180,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Start Date', dataIndex: 'start_date', width: 110,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'End Date', dataIndex: 'end_date', width: 110,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Ad Format', dataIndex: 'ad_format', width: 140,
      render: (v: string | string[], r: LineItem) => {
        const fmt = Array.isArray(v) ? v[0] : v;
        const sub = r.ad_sub_format;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {fmt && <Tag color="blue" style={{ fontSize: 10, width: 'fit-content' }}>{fmt}</Tag>}
            {sub && <Tag color="purple" style={{ fontSize: 10, width: 'fit-content' }}>{sub}</Tag>}
            {!fmt && <Text style={{ color: 'var(--text-muted)' }}>—</Text>}
          </div>
        );
      },
    },
    {
      title: 'Ethnicity', dataIndex: 'ethnicity', width: 140,
      render: (v: string | string[]) => {
        const arr = Array.isArray(v) ? v : (v ? [v] : []);
        return arr.length > 0
          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {arr.map((e: string) => <Tag key={e} style={{ fontSize: 10 }}>{e}</Tag>)}
          </div>
          : <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</Text>;
      },
    },
    {
      title: 'Creatives', key: 'creatives', width: 220,
      render: (_: any, r: LineItem) => <CreativesCell li={r} />,
    },
  ];

  const columns: ColumnsType<MyTask> = [
    {
      title: 'Ticket ID', dataIndex: 'ticket_id', key: 'ticket_id', width: 130, fixed: 'left',
      render: (v: string) => (
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--blue)',
          background: 'var(--blue-bg)', border: '1px solid var(--blue)',
          padding: '2px 10px', borderRadius: 6, whiteSpace: 'nowrap', display: 'inline-block',
        }}>{v}</span>
      ),
    },
    {
      title: 'Campaign Name', dataIndex: 'campaign_name', key: 'campaign_name', width: 200,
      render: (v: string) => <Text strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v || '—'}</Text>,
    },
    {
      title: 'Advertiser', dataIndex: 'advertiser', key: 'advertiser', width: 150,
      render: (v: string) => <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v || '—'}</Text>,
    },
    {
      title: 'Line Items', key: 'line_items_count', width: 100,
      render: (_: any, r: MyTask) => (
        <Tag color="blue" style={{ fontSize: 11 }}>
          {r.line_items?.length ?? 0} item{(r.line_items?.length ?? 0) !== 1 ? 's' : ''}
        </Tag>
      ),
    },
    {
      title: 'Turnaround', dataIndex: 'deadline_hours', key: 'deadline_hours', width: 110,
      render: (v: number | null) => {
        if (!v) return <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</Text>;
        if (v < 1) return <Text style={{ fontSize: 12 }}>{Math.round(v * 60)}m</Text>;
        if (v < 24) return <Text style={{ fontSize: 12 }}>{v}h</Text>;
        return <Text style={{ fontSize: 12 }}>{Math.round(v / 24)}d</Text>;
      },
    },
    {
      title: 'Due In', key: 'due_in', width: 150,
      render: (_: any, r: MyTask) => {
        if (r.status === 'completed') return <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Done</Text>;
        const { label, overdue } = formatCountdown(r.due_at);
        return (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: overdue ? 'var(--red)' : 'var(--text-primary)',
            background: overdue ? 'var(--red-bg)' : 'transparent',
            padding: overdue ? '3px 8px' : 0,
            borderRadius: 6,
          }}>
            {overdue && <ExclamationCircleOutlined style={{ marginRight: 4 }} />}
            {label}
          </span>
        );
      },
    },
    {
      title: 'Status', key: 'status', width: 140,
      render: (_: any, r: MyTask) => statusTag(r.status),
    },
    {
      title: 'Actions', key: 'actions', width: 220, fixed: 'right',
      render: (_: any, r: MyTask) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/creative/${r.campaign_id}`)}
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue)', background: 'var(--blue-bg)', border: '1px solid var(--blue)', borderRadius: 6 }}
          >
            View
          </Button>
          {r.status !== 'completed' && (
            <Popconfirm
              title="Mark this task as completed?"
              description="This will notify the account manager that your part is done."
              okText="Yes, complete it"
              cancelText="Cancel"
              onConfirm={() => handleMarkComplete(r)}
            >
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                loading={completingId === r.task_id}
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 6 }}
              >
                Mark Complete
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* ── Page Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 8,
      }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            My Tasks — Creative Ops
          </h1>
          <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            CAMPAIGNS ASSIGNED TO YOU
          </p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="db-stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <StatCard label="Pending / In Progress" value={pendingCount} changeLabel="Awaiting action" changeType="neutral" />
        <StatCard label="Overdue" value={overdueCount} changeLabel={overdueCount > 0 ? 'Needs attention' : 'None overdue'} changeType={overdueCount > 0 ? 'down' : 'neutral'} />
        <StatCard label="Completed" value={completedCount} changeLabel="Done" changeType="up" />
      </div>

      {/* ── Search Bar ── */}
      <div style={{ marginBottom: 16, marginTop: 4, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Input
          placeholder="Search by campaign name, ticket, advertiser…"
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 240, height: 36, background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchMyTasks}
          style={{
            height: 36, borderRadius: 8, border: '1px solid var(--text-muted)',
            background: 'var(--bg-input)', color: 'var(--text-secondary)',
            fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, paddingInline: 14,
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-light)';
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-input)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          Refresh
        </Button>
        <Text style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {filtered.length} of {tasks.length} tasks
        </Text>
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="task_id"
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }}
          locale={{ emptyText: 'No tasks assigned to you right now.' }}
          rowClassName={() => 'all-campaigns-row'}
          expandable={{
            expandedRowRender: (record: MyTask) => {
              if (!record.line_items || record.line_items.length === 0) {
                return <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>No line items.</Text>;
              }
              return (
                <div style={{ padding: '8px 0' }}>
                  <Text strong style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>
                    Line Items ({record.line_items.length})
                  </Text>
                  <Table
                    size="small"
                    dataSource={record.line_items}
                    rowKey="line_item_id"
                    pagination={false}
                    columns={lineItemColumns}
                    scroll={{ x: 1100 }}
                    style={{ background: 'var(--bg-page)', borderRadius: 8 }}
                  />
                </div>
              );
            },
            rowExpandable: () => true,
          }}
          style={{ fontSize: 13 }}
        />
      </div>

      <style>{`
        .all-campaigns-row:hover td { background: var(--bg-card-hover) !important; }
      `}</style>
    </div>
  );
}