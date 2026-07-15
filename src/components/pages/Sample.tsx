import { useEffect, useState } from "react";
import { fmt } from "../types/types";
import { StatusBadge, ClientDetailModal } from "./SharedComponents";
import type { Client, ClientStatus } from "../types/types";
import { Button, Input, Modal, Table } from "antd";
import { CheckCircleOutlined, SearchOutlined, PlusOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import Chat from "../admin/Chat"; // ← Chat component
import { useNavigate } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_BASE_URL;

interface ClientTablePageProps {
  clients: Client[];
  filterStatus: ClientStatus | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  title: string;
  subtitle: string;
}

export default function ClientTablePage({
  clients,
  filterStatus,
  onApprove,
  onReject,
  title,
  subtitle,
}: ClientTablePageProps) {
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [chatClient, setChatClient] = useState<Client | null>(null); // ← chat state

  const [credClient, setCredClient] = useState<Client | null>(null);
  const [credPassword, setCredPassword] = useState("");
  const [credSending, setCredSending] = useState(false);
  const [credMsg, setCredMsg] = useState("");

  const [sentClients, setSentClients] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("sent_credentials_clients");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const navigate = useNavigate();

  // Close modals on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (credClient) {
          setCredClient(null);
          setCredPassword("");
          setCredMsg("");
          setSearch("");
        }
        if (selectedClient) setSelectedClient(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [credClient, selectedClient]);

  const handleSendCredentials = async () => {
    if (!credPassword.trim()) {
      setCredMsg("Password is required");
      return;
    }
    setCredSending(true);
    setCredMsg("");
    try {
      const res = await fetch(`${BASE_URL}/approve_client/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "1",
        },
        body: JSON.stringify({
          client_id: credClient!.id,
          password: credPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCredMsg("✅ Credentials sent to " + credClient!.email);
        setSentClients((prev) => {
          const updated = new Set(prev).add(credClient!.id);
          localStorage.setItem(
            "sent_credentials_clients",
            JSON.stringify([...updated])
          );
          return updated;
        });
        setTimeout(() => {
          setCredClient(null);
          setCredPassword("");
          setCredMsg("");
          setSearch("");
        }, 2500);
      } else {
        setCredMsg(`❌ ${data.error}`);
      }
    } catch {
      setCredMsg("❌ Network error. Try again.");
    } finally {
      setCredSending(false);
    }
  };

  const filtered = clients.filter((c) => {
    const matchStatus = !filterStatus || c.status === filterStatus;
    if (credClient) return matchStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.company_name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // ── Table Columns ─────────────────────────────────────────────────────────
  const columns: ColumnsType<Client> = [
    {
      title: "Client ID",
      dataIndex: "id",
      key: "id",
      width: 155,
      render: (id: string) => (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
             color: "var(--blue)",
        background: "var(--blue-bg)",
        border: "1px solid var(--blue)",
            padding: "2px 10px",
            borderRadius: 6,
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          {id}
        </span>
      ),
    },
    {
      title: "Company Name",
      key: "company_name",
      width: 200,
      render: (_: any, c: Client) => (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.company_name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.email}
          </div>
        </div>
      ),
    },
    {
      title: "Company Type",
      dataIndex: "company_type",
      key: "company_type",
      width: 150,
      render: (v: string) =>
        v ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--purple)",
              background: "var(--purple-bg)",
              padding: "3px 9px",
              borderRadius: 6,
              display: "inline-block",
              whiteSpace: "nowrap",
            }}
          >
            {v}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
        ),
    },
    {
      title: "Agency Type",
      dataIndex: "agency_type",
      key: "agency_type",
      width: 120,
      render: (v: string) =>
        v ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--amber)",
              background: "var(--amber-bg)",
              padding: "3px 9px",
              borderRadius: 6,
              display: "inline-block",
              whiteSpace: "nowrap",
            }}
          >
            {v}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
        ),
    },
    {
      title: "City",
      dataIndex: "city",
      key: "city",
      width: 100,
      render: (v: string) => (
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
          {v || "—"}
        </span>
      ),
    },
    {
      title: "Submitted",
      dataIndex: "submitted_at",
      key: "submitted_at",
      width: 120,
      render: (v: string) => (
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
          {fmt(v)}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (v: string) => <StatusBadge status={v as ClientStatus} />,
    },
    {
      title: "Actions",
      key: "actions",
      width: 230,
      fixed: "right",
      render: (_: any, c: Client) => (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {/* View */}
          <Button
            size="small"
            onClick={() => setSelectedClient(c)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-primary)",
              background: "var(--accent-light)",
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
            }}
          >
            View
          </Button>

          {/* Pending actions */}
          {c.status === "pending" && (
            <>
              <Button
                size="small"
                onClick={() => onApprove(c.id)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--green)",
                  background: "var(--green-bg)",
                  border: "1px solid var(--green)",
                  borderRadius: 6,
                }}
              >
                Approve
              </Button>

              <Button
                size="small"
                onClick={() => onReject(c.id)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--red)",
                  background: "var(--red-bg)",
                  border: "1px solid var(--red)",
                  borderRadius: 6,
                }}
              >
                Reject
              </Button>
            </>
          )}

          {/* Send Credentials */}
          {c.status === "approved" && (
            <Button
              size="small"
              icon={sentClients.has(c.id) ? <CheckCircleOutlined /> : null}
              onClick={() => {
                setCredClient(c);
                setCredPassword("");
                setCredMsg("");
              }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                background: sentClients.has(c.id) ? "var(--green-bg)" : "var(--blue-bg)",
                border: sentClients.has(c.id) ? "1px solid var(--green)" : "1px solid var(--blue)",
                color: sentClients.has(c.id) ? "var(--green)" : "var(--blue)",
              }}
            >
              {sentClients.has(c.id) ? "Sent Credential" : "Send Credential"}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* ── Page Header ── */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 8,
      }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
            {title}
          </h1>
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
            {subtitle}
          </p>
        </div>

        <Button
          onClick={() => navigate('/onboarding')}
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
          }}
        >
          <PlusOutlined /> Add New Client
        </Button>
      </div>

      {/* ── Search + Count ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Input
          placeholder="Search by company, ID, email or city…"
          prefix={<SearchOutlined style={{ color: "var(--text-muted)" }} />}
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
          {filtered.length} client{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Ant Design Table ── */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 14,
          border: "1px solid var(--border)",
          overflow: "hidden",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} clients`,
            style: { padding: "12px 16px", color: "var(--text-primary)" },
          }}
          rowClassName={() => "client-table-row"}
          style={{ fontSize: 13 }}
        />
      </div>

      {/* ── Client Detail Modal (existing component) ── */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onApprove={(id) => {
            onApprove(id);
            setSelectedClient(null);
          }}
          onReject={(id) => {
            onReject(id);
            setSelectedClient(null);
          }}
          onClose={() => setSelectedClient(null)}
        />
      )}

      {/* ── Send Credentials — Ant Design Modal ── */}
      <Modal
        open={!!credClient}
        onCancel={() => {
          setCredClient(null);
          setCredPassword("");
          setCredMsg("");
          setSearch("");
        }}
        footer={null}
        width={450}
        centered
        destroyOnClose
        title={
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
              Send Credentials
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400, marginTop: 2 }}>
              Credentials will be emailed to the client
            </div>
          </div>
        }
        style={{ borderRadius: 16 }}
      >
        {credClient && (
          <div>
            {/* Client Email (read-only) */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Client Email
              </label>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "var(--bg-input)",
                  border: `1px solid var(--border)`,
                  fontSize: 13,
                  color: "var(--text-muted)",
                  fontWeight: 500,
                }}
              >
                {credClient.email}
              </div>
            </div>

            {/* Password Input */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Set Password
              </label>
              <Input.Password
                placeholder="Enter password to send"
                value={credPassword}
                onChange={(e) => setCredPassword(e.target.value)}
                style={{ height: 40, fontSize: 13 }}
              />
            </div>

            {/* Status Message */}
            {credMsg && (
              <div
                style={{
                  marginBottom: 14,
                  fontSize: 12,
                  color: credMsg.startsWith("✅") ? "var(--green)" : "var(--red)",
                  fontWeight: 500,
                }}
              >
                {credMsg}
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button
                onClick={() => {
                  setCredClient(null);
                  setCredPassword("");
                  setCredMsg("");
                  setSearch("");
                }}
                style={{
                  borderRadius: 8,
                  border: `1px solid var(--border)`,
                  color: "var(--text-primary)",
                  fontSize: 13,
                }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleSendCredentials}
                loading={credSending}
                style={{
                  borderRadius: 8,
                  background: "var(--accent)",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  boxShadow: "0 2px 8px rgba(124,58,237,0.25)",
                }}
              >
                {credSending ? "Sending…" : "Send Credentials"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Chat Popup ── */}
      {chatClient && (
        <Chat client={chatClient} onClose={() => setChatClient(null)} />
      )}
    </div>
  );
}