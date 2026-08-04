import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { RocketOutlined } from "@ant-design/icons";

const BASE_URL = import.meta.env.VITE_BASE_URL;

const customTooltipStyle = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--text-primary)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
};

// ── Interfaces ────────────────────────────────────────────────
interface LineItemWithCampaign {
  line_item_id: string;
  line_item_name?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  campaignName: string;
}

interface CampaignRaw {
  campaign_id: string | null;
  campaign_name: string;
  client_name: string;
  approval_status?: string;
  created_at: string;
  line_items?: any[];
}

function fmtDate(v?: string) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Status pill ───────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    live: { bg: "var(--green-bg)", color: "var(--green)", label: "Live" },
    upcoming: { bg: "var(--amber-bg)", color: "var(--amber)", label: "Upcoming" },
    paused: { bg: "var(--accent-light)", color: "var(--text-secondary)", label: "Paused" },
    completed: { bg: "var(--red-bg)", color: "var(--red)", label: "Completed" },
  };
  const cfg = map[status] || map.upcoming;
  return (
    <span className="db-badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="db-badge-dot" />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// FLAT METRIC CARD — matches "Total Revenue / Active Campaigns" style
// ─────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  changeLabel,
  changeType,
}: {
  label: string;
  value: number | string;
  changeLabel: string;
  changeType: "up" | "down" | "neutral";
}) {
  return (
    <div className="db-stat-card">
      <div className="db-stat-label">{label}</div>
      <div className="db-stat-value">{value}</div>
      <div className={`db-stat-change ${changeType === "neutral" ? "" : changeType}`}
        style={changeType === "neutral" ? { color: "var(--text-muted)" } : undefined}
      >
        {changeLabel}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROGRESS ROW — matches "Users by Role" style (gray bar, no color coding)
// ─────────────────────────────────────────────────────────────
function ProgressRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="db-progress-row">
      <div className="db-progress-top">
        <span className="db-progress-label">{label}</span>
        <span className="db-progress-value">{value}</span>
      </div>
      <div className="db-progress-bar">
        <div className="db-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CAMPAIGNS OVER TIME — cumulative series for the area chart
// ─────────────────────────────────────────────────────────────
function buildCampaignTimeSeries(campaigns: CampaignRaw[]) {
  const counts: Record<string, number> = {};
  campaigns.forEach((c) => {
    const d = new Date(c.created_at);
    const key = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    counts[key] = (counts[key] || 0) + 1;
  });
  const sorted = Object.entries(counts)
    .map(([label, count]) => ({ label, count, dateObj: new Date(label) }))
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  let cumulative = 0;
  return sorted.map(({ label, count }) => {
    cumulative += count;
    return { label, cumulative };
  });
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function Finance_Overview() {
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<CampaignRaw[]>([]);
  const [_loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const timeSeriesData = buildCampaignTimeSeries(campaigns);

  const fetchCampaigns = () => {
    setLoading(true);
    fetch(`${BASE_URL}/get_campaigns/`, { headers: { "ngrok-skip-browser-warning": "1" } })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.campaigns || [];
        setCampaigns(list);
        setLastUpdated(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCampaigns(); }, []);

  // Derive counts
  const allLineItems: LineItemWithCampaign[] = [];
  campaigns.forEach((c) => {
    (c.line_items || []).forEach((li) => {
      allLineItems.push({ ...li, campaignName: c.campaign_name });
    });
  });

  const live = allLineItems.filter((li) => li.status === "live");
  const upcoming = allLineItems.filter((li) => li.status === "upcoming");
  const paused = allLineItems.filter((li) => li.status === "paused");
  const completed = allLineItems.filter((li) => li.status === "completed");
  const totalLI = allLineItems.length;

  const approvedCampaigns = campaigns.filter((c) => c.approval_status === "approved").length;

  const recent = [...campaigns]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const ROW: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "11px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer",
  };

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 8,
      }}>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
          Platform Overview
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, margin: 0 }}>
            {lastUpdated ? `Last updated ${lastUpdated}` : "Loading..."}
          </p>
          <button onClick={fetchCampaigns} className="db-card-action" style={{ background: "var(--bg-input)" }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Flat metric cards ──────────── */}
      <div className="db-stat-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <MetricCard
          label="Total Campaigns"
          value={campaigns.length}
          changeLabel={`${approvedCampaigns} approved`}
          changeType="up"
        />
        <MetricCard
          label="Sub Campaigns"
          value={totalLI}
          changeLabel={`${live.length} live now`}
          changeType={live.length > 0 ? "up" : "neutral"}
        />
      </div>

      <div className="db-grid-2" style={{ marginBottom: 18 }}>

        {/* ── Campaigns Over Time — black line, gray fill ── */}
        <div className="db-chart-card">
          <div className="db-card-header">
            <span className="db-card-title">Campaigns Over Time</span>
            <span className="db-card-action">This year</span>
          </div>

          <div className="db-chart-wrap" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cgNeutral" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-fill-strong)" />
                    <stop offset="100%" stopColor="var(--chart-fill-soft)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="var(--chart-line)"
                  strokeWidth={2}
                  fill="url(#cgNeutral)"
                  dot={{ r: 4, fill: "var(--bg-card)", stroke: "var(--chart-line)", strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Sub-Campaign breakdown — gray progress bars ── */}
        <div className="db-chart-card">
          <div className="db-card-header">
            <span className="db-card-title">Sub-Campaign Status</span>
            <span className="db-card-action">Current</span>
          </div>

          <div style={{ padding: "10px 18px 4px" }}>
            <ProgressRow label="Live" value={live.length} max={totalLI} />
            <ProgressRow label="Upcoming" value={upcoming.length} max={totalLI} />
            <ProgressRow label="Paused" value={paused.length} max={totalLI} />
            <ProgressRow label="Completed" value={completed.length} max={totalLI} />
          </div>
        </div>
      </div>

      {/* ── Recent campaigns ──────────────────────────────────── */}
      <div className="db-chart-card" style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
        <div className="db-card-header" style={{ padding: "12px 16px" }}>
          <span className="db-card-title" style={{ textTransform: "none", flex: 1 }}>
            Recent campaigns
          </span>
          <button onClick={() => navigate("/admin/campaigns")} className="db-card-action">
            View all
          </button>
        </div>
        {recent.map((c, i) => (
          <div
            key={c.campaign_id || i}
            style={{
              ...ROW,
              borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <div style={{
              width: 25, height: 25, borderRadius: 8,
              background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <RocketOutlined style={{ fontSize: 12, color: "#FFFFFF" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {c.campaign_name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {c.client_name} · {fmtDate(c.created_at)}
              </div>
            </div>
            <StatusPill status={c.approval_status === "approved" ? "live" : "upcoming"} />
          </div>
        ))}
      </div>
    </div>
  );
}