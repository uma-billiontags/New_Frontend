import { Link } from "react-router-dom";
import {
  Building2, BarChart3, Wallet, ShieldCheck, Megaphone, Activity,
  ArrowRight, CheckCircle2,
} from "lucide-react";

const features = [
  { icon: Building2, title: "Client Management", desc: "Centralised client records, contacts, addresses & onboarding workflows." },
  { icon: BarChart3, title: "Reporting Automation", desc: "Scheduled reports, version diffs, and audit-ready exports across every entity." },
  { icon: Wallet, title: "Wallet Management", desc: "Real-time balances, top-ups and currency-aware ledger reconciliation." },
  { icon: ShieldCheck, title: "Secure Onboarding", desc: "GST/CIN validation, signature capture and role-bound approval flows." },
  { icon: Megaphone, title: "Campaign Management", desc: "Campaigns, sub-campaigns and insertion orders with version control." },
  { icon: Activity, title: "Live Monitoring", desc: "Operational dashboards, health scores and budget pacing in real time." },
];

const stats = [
  { k: "99.99%", v: "Platform uptime" },
  { k: "SOC 2", v: "Type II certified" },
  { k: "12 ms", v: "Median API latency" },
];

const navLinks = ["Features", "About", "Services", "Contact"];

export default function Home() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-page)",
      color: "var(--text-primary)",
      fontFamily: "'Poppins', sans-serif",
    }}>

      {/* ── Top Nav ─────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          height: 64, padding: "0 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>

          {/* Logo */}
          <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Billion
            </span>
            <span style={{ fontWeight: 700, fontSize: 10, color: "var(--text-primary)", position: "relative", bottom: -2 }}>
              Tags
            </span>
          </Link>

          {/* Nav links */}
          <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {navLinks.map((n) => (
              <a key={n} href={n === "Features" ? "#features" : "#"} style={{
                textDecoration: "none", fontSize: 14, fontWeight: 500,
                color: "var(--text-primary)",
              }}>
                {n}
              </a>
            ))}
          </nav>

          {/* Right: Login + Register (no theme toggle) */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link to="/login" style={{ textDecoration: "none" }}>
              <button style={{
                height: 38, padding: "0 18px",
                background: "var(--accent)", border: "none",
                borderRadius: 20, fontSize: 13, fontWeight: 600,
                color: "#fff", cursor: "pointer",
                fontFamily: "'Poppins', sans-serif",
                transition: "opacity 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                Sign In
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section style={{
        background: "var(--bg-page)",
        borderBottom: "1px solid var(--border)",
        position: "relative",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          padding: "88px 24px 96px",
          textAlign: "center", position: "relative",
        }}>

          {/* Headline — plain black, no gradient */}
          <h1 style={{
            fontSize: "clamp(36px, 5.5vw, 58px)", fontWeight: 800,
            lineHeight: 1.06, letterSpacing: "-0.03em",
            color: "var(--text-primary)", maxWidth: 820, margin: "0 auto 8px",
          }}>
            The CRM Automation
          </h1>
          <h1 style={{
            fontSize: "clamp(36px, 5.5vw, 58px)", fontWeight: 800,
            lineHeight: 1.06, letterSpacing: "-0.03em",
            color: "var(--text-primary)", maxWidth: 820, margin: "0 auto 20px",
          }}>
            Platform built for enterprise operations.
          </h1>

          {/* Underline accent */}
          <div style={{
            width: 260, height: 3, borderRadius: 2,
            background: "var(--accent)",
            margin: "0 auto 28px",
          }} />

          {/* Subheading */}
          <p style={{
            fontSize: 15, color: "var(--text-secondary)", maxWidth: 560,
            margin: "0 auto 36px", lineHeight: 1.7,
          }}>
            Manage clients, campaigns, billing and approvals on a single governed surface — with audit trails, RBAC and live monitoring out of the box.
          </p>

          {/* CTAs — black solid + outline, matching reference */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link to="/portal" style={{ textDecoration: "none" }}>
              <button style={{
                height: 46, padding: "0 26px",
                background: "var(--accent)", border: "none",
                borderRadius: 24, fontSize: 14, fontWeight: 700,
                color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                fontFamily: "'Poppins', sans-serif",
                transition: "opacity 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Open User Portal <ArrowRight size={15} />
              </button>
            </Link>
            <Link to="/admin" style={{ textDecoration: "none" }}>
              <button style={{
                height: 46, padding: "0 26px",
                background: "#fff", border: "1px solid var(--border-strong)",
                borderRadius: 24, fontSize: 14, fontWeight: 600,
                color: "var(--text-primary)", cursor: "pointer",
                fontFamily: "'Poppins', sans-serif",
                transition: "border-color 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
              >
                Open Admin Console
              </button>
            </Link>
          </div>

          {/* Stats */}
          <div style={{
            display: "flex", gap: 14, marginTop: 52,
            justifyContent: "center", flexWrap: "wrap",
          }}>
            {stats.map((s) => (
              <div key={s.k} className="db-stat-card" style={{ minWidth: 160, textAlign: "left" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{s.k}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: 1200, margin: "0 auto", padding: "72px 24px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "var(--text-secondary)",
            letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8,
          }}>
            Platform
          </div>
          <h2 style={{
            fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 800,
            letterSpacing: "-0.02em", color: "var(--text-primary)", maxWidth: 500,
          }}>
            Six modules. One governed system of record.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {features.map((f) => (
            <div
              key={f.title}
              className="db-card"
              style={{ padding: "22px 22px 20px", transition: "all 0.2s", cursor: "default" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-card)";
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: "var(--radius-sm)",
                background: "var(--accent-light)", border: "1px solid var(--border-strong)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 14, color: "var(--text-primary)",
              }}>
                <f.icon size={17} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                {f.title}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
                {f.desc}
              </p>
              <div style={{
                marginTop: 16, display: "flex", alignItems: "center", gap: 5,
                fontSize: 10, fontWeight: 600, color: "var(--green)",
              }}>
                <CheckCircle2 size={12} /> Audit-logged & approval-gated
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 72px" }}>
        <div style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          padding: "40px 36px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 20,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.02em" }}>
              Ready to streamline your operations?
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              Get onboarded in minutes. No setup fee. Full access from day one.
            </p>
          </div>
          <Link to="/onboarding" style={{ textDecoration: "none" }}>
            <button style={{
              height: 42, padding: "0 22px",
              background: "var(--accent)", border: "none",
              borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 700,
              color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              fontFamily: "'Poppins', sans-serif",
              transition: "opacity 0.15s", whiteSpace: "nowrap",
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Get Started Free <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg-sidebar)" }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: "24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            © 2025 Billion Tags CRM. All rights reserved.
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {["Privacy", "Security", "Status"].map((l) => (
              <a key={l} href="#"
                style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              >{l}</a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}