import { Link, useLocation } from "react-router-dom";
import {
  LogOut, Settings, LayoutDashboard, 
  Receipt, Users,
  Bell, Building2, MapPinned,
  type LucideIcon, Megaphone, BarChart3, Wallet, CalendarClock, Globe2 
} from 'lucide-react';
import type { RefObject } from "react";

// ── Nav Config ────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  icon: LucideIcon;
  to: string;
  dot?: "red" | "green";
  badge?: number | string;
  accent?: string;
  children?: { label: string; icon: LucideIcon; to: string; matchPaths?: string[] }[];
}

interface NavGroup {
  section?: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    section: "ADMINISTRATION",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/management/overview" },
    ],
  },
  {
    section: "EMAIL",
    items: [
      { label: "Leads", icon: Receipt, to: "/management/leads" },
    ],
  },
   {
    section: "CATEGORIES",
    items: [
      { label: "Departments", icon: Building2, to: "/management/categories/departments" },
      { label: "Team & Access", icon: Users, to: "/management/categories/teamaccess" },
      { label: "Invoice Bank Details", icon: Receipt, to: "/management/categories/invoice_bank_details" },
      { label: "Invoice Company Address", icon: MapPinned, to: "/management/categories/invoice_company_address" },
      { label: "Authorized Person", icon: Users, to: "/management/categories/invoice_authorized_person" },
       { label: "Ad Formats", icon: Megaphone, to: "/management/categories/ads_formats" },
      { label: "Metrics", icon: BarChart3, to: "/management/categories/metrics" },
      { label: "Mode of Payment", icon: Wallet, to: "/management/categories/mode_of_payment" },
      { label: "Payment Terms", icon: CalendarClock, to: "/management/categories/payment_terms" },
      { label: "Ethnicity", icon: Globe2, to: "/management/categories/ethnicity" },
    ],
  },
];

// ── Notification type (mirrors the one in Layout) ─────────────────────────────
interface Notification {
  id: number;
  message: string;
  time: string;
  read: boolean;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ManagementSidebarProps {
  notifications: Notification[];
  unreadCount: number;
  showDropdown: boolean;
  onToggleDropdown: () => void;
  onClearAll: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;  // ← add "| null"
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Management_Sidebar({
  notifications,
  unreadCount,
  showDropdown,
  onToggleDropdown,
  onClearAll,
  dropdownRef,
}: ManagementSidebarProps) {
  const location = useLocation();

  return (
    <aside className="db-sidebar">
      {/* Logo + Bell */}
      <div className="db-logo" style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="db-logo-brand">
            <div className="db-logo-icon">M</div>
            <span className="db-logo-name">Billion Tags</span>
          </div>

          {/* ── Bell Icon ── */}
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <div
              className="db-icon-btn"
              title="Notifications"
              onClick={onToggleDropdown}
              style={{ width: 30, height: 30, }}
            >
              🔔
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute", top: -3, right: -3,
                    width: 14, height: 14,
                    background: "var(--red)", borderRadius: "50%",
                    fontSize: 8, fontWeight: 700,
                    color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid var(--bg-sidebar)",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>

            {/* ── Dropdown Panel ── */}
            {showDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  left: -180,
                  width: 300,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                  zIndex: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    Notifications
                  </span>
                  {notifications.length > 0 && (
                    <span
                      onClick={onClearAll}
                      style={{ fontSize: 11, color: "var(--blue)", cursor: "pointer", fontWeight: 600 }}
                    >
                      Clear all
                    </span>
                  )}
                </div>

                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      <Bell size={20} style={{ marginBottom: 8, opacity: 0.4 }} />
                      <div>No notifications yet</div>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          padding: "12px 16px", borderBottom: "1px solid var(--border)",
                          background: n.read ? "var(--bg-card)" : "var(--blue-bg)",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            margin: 0, fontSize: 12, color: "var(--text-primary)",
                            fontWeight: n.read ? 400 : 600, lineHeight: 1.4,
                          }}>
                            {n.message}
                          </p>
                          <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                            {n.time}
                          </p>
                        </div>
                        {!n.read && (
                          <div style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: "var(--blue)", flexShrink: 0, marginTop: 4,
                          }} />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="db-logo-sub">Management Portal</div>
      </div>

      {/* Nav */}
      <nav className="db-nav">
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.section && (
              <div className="db-nav-section">{group.section}</div>
            )}

            {group.items.map((item) => {
              const active =
                location.pathname === item.to ||
                (item.to !== "/management/overview" &&
                  location.pathname.startsWith(item.to));
              const hasChildren = item.children && item.children.length > 0;
              const Icon = item.icon;

              return (
                <div key={item.to}>
                  <Link
                    to={item.to}
                    className={`db-nav-item${active ? " active" : ""}`}
                    style={{ textDecoration: "none" }}
                  >
                    <span className="db-nav-icon">
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="db-nav-label">{item.label}</span>
                    {item.dot && (
                      <span className={`db-nav-dot ${item.dot}`} />
                    )}
                    {item.badge !== undefined && (
                      <span className="db-nav-badge">{item.badge}</span>
                    )}
                    
                  </Link>

                  {hasChildren && (
                    <div style={{ paddingLeft: 18, marginBottom: 4 }}>
                      {item.children!.map((child) => {
                        const childActive = child.matchPaths
                          ? child.matchPaths.includes(location.pathname)
                          : location.pathname === child.to;
                        const ChildIcon = child.icon;

                        return (
                          <Link key={child.to} to={child.to} style={{ textDecoration: "none" }}>
                            <div
                              style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "7px 10px", borderRadius: 6,
                                marginBottom: 2,
                                color: childActive ? "var(--text-primary)" : "var(--text-muted)",
                                fontSize: 12, fontWeight: childActive ? 600 : 400,
                                background: childActive ? "var(--accent-light)" : "transparent",
                                borderLeft: childActive ? "2px solid var(--text-primary)" : "2px solid transparent",
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => {
                                if (!childActive) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-card-hover)";
                              }}
                              onMouseLeave={(e) => {
                                if (!childActive) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                              }}
                            >
                              <ChildIcon size={13} strokeWidth={1.8} />
                              {child.label}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="db-sidebar-footer">
        <div className="db-sidebar-user">
          <div className="db-sidebar-avatar">M</div>
          <div>
            <div className="db-sidebar-uname">Management</div>
            <div className="db-sidebar-urole">ADMINISTRATOR</div>
          </div>
        </div>

        <Link to="/portal_settings" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', borderRadius: 8,
            color: 'var(--text-muted)', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', marginBottom: 3,
            justifyContent: 'flex-start',
          }}>
            <Settings size={14} /> Settings
          </div>
        </Link>

        <Link to="/login" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', borderRadius: 8,
            color: 'var(--red)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            justifyContent: 'flex-start',
          }}>
            <LogOut size={14} /> Sign Out
          </div>
        </Link>
      </div>
    </aside>
  );
}