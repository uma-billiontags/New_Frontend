import { useState, useEffect } from 'react';
import { Table, Input, Button, Typography, Tooltip, Modal, message } from 'antd';
import {
  SearchOutlined, ReloadOutlined, VideoCameraOutlined,
  PlayCircleOutlined, CopyOutlined, CheckOutlined,
  DownloadOutlined, CloseOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

const BASE_URL = import.meta.env.VITE_BASE_URL;

interface Creative {
  id?: number;
  creative_name: string;
  main_asset_url?: string;
  main_asset?: string;
  dimensions?: string;
  aspect_ratio?: string;
  file_size?: string;
  click_through_url?: string;
  appended_html_tag?: string;
  integration_code?: string;
  notes?: string;
  type?: string;
}

interface LineItem {
  line_item_id: string;
  line_item_name: string;
  ad_format: string | string[];
  creatives?: Creative[];
}

interface Campaign {
  campaign_id: string;
  ticket_id?: string | null;
  campaign_name: string;
  advertiser?: string;
  approval_status?: string;
  line_items?: LineItem[];
}

interface VideoCreativeRow {
  key: string;
  rowIndex?: number;
  creativeId?: number;
  ticketId: string;
  campaignName: string;
  advertiser: string;
  lineItemId: string;
  lineItemName: string;
  creativeName: string;
  mainAssetUrl?: string;
  mainAssetName?: string;
  dimensions?: string;
  aspectRatio?: string;
  fileSize?: string;
  clickThroughUrl?: string;
  appendedHtmlTag?: string;
  integrationCode?: string;
  notes?: string;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function getExt(url?: string): string {
  if (!url) return '';
  const name = url.split('/').pop()?.split('?')[0] ?? '';
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
}

function isImage(url?: string) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(getExt(url));
}

function isVideo(url?: string) {
  return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(getExt(url));
}

function resolveUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

function isVideoFormat(fmt: string | string[]): boolean {
  const raw = (Array.isArray(fmt) ? fmt[0] : fmt) ?? '';
  const lower = raw.toLowerCase();
  return lower.includes('video') || lower.includes('youtube');
}

function isValidClickUrl(url: string): boolean {
  return !!url && url.toLowerCase().includes('trackclk');
}
function isValidVideoTag(tag: string): boolean {
  return !!tag && /^https?:\/\/.*\?$/.test(tag.trim());
}

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  name: string;
  ext: string;
}

function PreviewModal({ open, onClose, url, name, ext }: PreviewModalProps) {
  const resolved = resolveUrl(url);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={780}
      styles={{
        body: { padding: 0, background: '#0f172a' },
      }}
      closeIcon={
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13,
        }}>
          <CloseOutlined />
        </div>
      }
    >
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, color: '#fff',
            background: 'rgba(255,255,255,0.15)',
            padding: '2px 7px', borderRadius: 4,
            letterSpacing: '0.05em',
          }}>{ext.toUpperCase()}</span>
          <span style={{
            fontSize: 13, fontWeight: 600, color: '#e2e8f0',
            maxWidth: 460, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name}
          </span>
        </div>
        <button
          onClick={async () => {
            try {
              const response = await fetch(resolved, {
                headers: { 'ngrok-skip-browser-warning': '1' },
              });
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(blobUrl);
            } catch {
              message.error('Download failed');
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, color: '#93c5fd',
            background: 'rgba(37,99,235,0.15)',
            padding: '4px 10px', borderRadius: 6,
            border: '1px solid rgba(37,99,235,0.3)',
            cursor: 'pointer',
          }}
        >
          <DownloadOutlined style={{ fontSize: 12 }} /> Download
        </button>
      </div>

      {/* Content */}
      <div style={{
        minHeight: 320, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 24,
        background: '#0f172a',
      }}>
        {isVideo(url) ? (
          <video
            src={resolved}
            controls
            autoPlay
            style={{ maxWidth: '100%', maxHeight: 480, borderRadius: 8 }}
          />
        ) : (
          <div>Preview not available</div>
        )}
      </div>
    </Modal>
  );
}

// ── TruncCell ────────────────────────────────────────────────────────────────
function TruncCell({ value, maxW = 160 }: { value?: string; maxW?: number; mono?: boolean }) {
  if (!value) return <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>—</span>;
  return (
    <Tooltip title={value} placement="topLeft">
      <span style={{
        fontSize: 12, color: 'var(--text-primary)',
        display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', maxWidth: maxW, cursor: 'default',
      }}>{value}</span>
    </Tooltip>
  );
}

// ── TrackerCell — with copy icon ─────────────────────────────────────────────
function TrackerCell({ value, type }: { value?: string; type: 'click' | 'html' }) {
  const [copied, setCopied] = useState(false);

  if (!value) return <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>—</span>;

  const isValid = type === 'click' ? isValidClickUrl(value) : isValidVideoTag(value);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      message.success({ content: 'Copied to clipboard!', duration: 1.5 });
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      message.error('Failed to copy');
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 60 }}>
      {/* Validation dot */}
      <div style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: isValid ? 'var(--green)' : 'var(--red)',
      }} />

      {/* Truncated value */}
      <Tooltip title={value} placement="topLeft">
        <span style={{
          fontSize: 12, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: 110, cursor: 'default',
        }}>{value}</span>
      </Tooltip>

      {/* Copy button */}
      <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? 'var(--green-bg)' : 'var(--bg-input)',
            border: `1px solid ${copied ? 'var(--green)' : 'var(--border)'}`,
            borderRadius: 4,
            cursor: 'pointer',
            padding: '2px 5px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            outline: 'none',
          }}
        >
          {copied
            ? <CheckOutlined style={{ fontSize: 10, color: 'var(--green)' }} />
            : <CopyOutlined style={{ fontSize: 10, color: 'var(--text-secondary)' }} />
          }
        </button>
      </Tooltip>
    </div>
  );
}

function colHead(): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  };
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function Video_Creatives() {
  const [rows, setRows] = useState<VideoCreativeRow[]>([]);
  const [filtered, setFiltered] = useState<VideoCreativeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ── Preview state ──────────────────────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<VideoCreativeRow | null>(null);


  // ── Open preview ───────────────────────────────────────────────────────────
  const openPreview = (record: VideoCreativeRow) => {
    if (!record.mainAssetUrl) {
      message.warning('No asset URL available for preview');
      return;
    }
    setPreviewRow(record);
    setPreviewOpen(true);
  };

  const fetchData = () => {
    setLoading(true);
    fetch(`${BASE_URL}/get_campaigns/`, { headers: { 'ngrok-skip-browser-warning': '1' } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        let rowIndex = 1;
        const campaigns: Campaign[] = Array.isArray(data) ? data : data?.campaigns ?? [];
        // ✅ Only approved campaigns
        const approved = campaigns.filter(c => (c as any).approval_status === 'approved');
        const flat: VideoCreativeRow[] = [];

        approved.forEach(campaign => {
          (campaign.line_items ?? []).forEach(li => {
            const formats = Array.isArray(li.ad_format)
              ? li.ad_format
              : [String(li.ad_format ?? '')];

            // ✅ Only show if it's a video format
            const hasVideoFormat = formats.some(f => isVideoFormat(f));
            if (!hasVideoFormat) return;

            (li.creatives ?? []).forEach((cr, idx) => {
              const assetUrl = cr.main_asset_url || cr.main_asset || '';
              if (isImage(assetUrl)) return;
              flat.push({
                key: `${campaign.campaign_id}_${li.line_item_id}_${idx}`,
                rowIndex,
                creativeId: (cr as any).id,
                ticketId: campaign.ticket_id || '—',
                campaignName: campaign.campaign_name,
                advertiser: campaign.advertiser ?? '',
                lineItemId: li.line_item_id,
                lineItemName: li.line_item_name,
                creativeName: cr.creative_name ?? `Video ${idx + 1}`,
                mainAssetUrl: cr.main_asset_url || cr.main_asset || '',
                mainAssetName: cr.creative_name ?? '',
                dimensions: cr.dimensions ?? '',
                aspectRatio: cr.aspect_ratio ?? '',
                fileSize: cr.file_size ?? '',
                clickThroughUrl: cr.click_through_url ?? '',
                appendedHtmlTag: cr.appended_html_tag ?? '',
                integrationCode: cr.integration_code ?? '',
                notes: cr.notes ?? '',
              });
              rowIndex++;
            });
          });
        });

        setRows(flat);
        setFiltered(flat);
      })
      .catch(() => { setRows([]); setFiltered([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(rows); return; }
    const q = search.toLowerCase();
    setFiltered(rows.filter(r =>
      r.creativeName?.toLowerCase().includes(q) ||
      r.campaignName?.toLowerCase().includes(q) ||
      r.ticketId?.toLowerCase().includes(q) ||
      r.lineItemId?.toLowerCase().includes(q)
    ));
  }, [search, rows]);

  // ── Download handler ─────────────────────────────────────────────────────
  const handleDownload = async (e: React.MouseEvent, record: VideoCreativeRow) => {
    e.stopPropagation();

    const url = record.mainAssetUrl;
    if (!url) {
      message.warning('No asset available to download');
      return;
    }

    const resolved = resolveUrl(url);
    const name = record.mainAssetName || record.creativeName || 'creative';

    try {
      const response = await fetch(resolved, {
        headers: { 'ngrok-skip-browser-warning': '1' },
      });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      message.error('Download failed');
    }
  };

  const withAsset = rows.filter(r => r.mainAssetUrl).length;
  const withClickUrl = rows.filter(r => r.clickThroughUrl && isValidClickUrl(r.clickThroughUrl)).length;
  const withTag = rows.filter(r => r.appendedHtmlTag && isValidVideoTag(r.appendedHtmlTag)).length;

  const columns: ColumnsType<VideoCreativeRow> = [
    {
      title: 'ID',
      dataIndex: 'rowIndex',
      key: 'rowIndex',
      width: 52,
      render: (v: number) => (
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: 'var(--blue-bg)', border: '1px solid var(--blue)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'var(--blue)',
        }}>{v}</div>
      ),
    },
    {
      title: <span style={colHead()}>Ticket ID</span>,
      dataIndex: 'ticketId', key: 'ticketId', width: 160, fixed: 'left',
      render: (v: string, record: VideoCreativeRow) => (
        <div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--blue)',
            background: 'var(--blue-bg)', padding: '2px 6px',
            borderRadius: 4,
            display: 'block', marginBottom: 2,
          }}>{v}</span>
          <Tooltip title={record.campaignName}>
            <span style={{
              fontSize: 10, color: 'var(--text-secondary)',
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', display: 'block', maxWidth: 140,
            }}>{record.campaignName}</span>
          </Tooltip>
        </div>
      ),
    },
    {
      title: <span style={colHead()}>Creative Name</span>,
      dataIndex: 'creativeName', key: 'creativeName', width: 240, fixed: 'left',
      render: (v: string, record: VideoCreativeRow) => {
        const url = record.mainAssetUrl;
        const canPreview = !!url;

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6, background: 'var(--blue-bg)',
              border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <PlayCircleOutlined style={{ fontSize: 14, color: 'var(--blue)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Tooltip title={canPreview ? 'Click to preview' : 'No asset available'} placement="topLeft">
                <span
                  onClick={() => canPreview && openPreview(record)}
                  style={{
                    fontSize: 12, fontWeight: 600,
                    color: canPreview ? 'var(--blue)' : 'var(--text-primary)',
                    display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', maxWidth: 170,
                    textDecoration: canPreview ? 'underline' : 'none',
                    textDecorationStyle: 'dotted',
                    textUnderlineOffset: 3,
                    cursor: canPreview ? 'pointer' : 'default',
                  }}
                >{v}</span>
              </Tooltip>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{record.lineItemId}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: <span style={colHead()}>Dimensions</span>,
      dataIndex: 'dimensions', key: 'dimensions', width: 120,
      render: (v: string) => v
        ? <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFeatureSettings: '"tnum"' }}>{v}</span>
        : <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>—</span>,
    },
    {
      title: <span style={colHead()}>Aspect Ratio</span>,
      dataIndex: 'aspectRatio', key: 'aspectRatio', width: 110,
      render: (v: string) => v
        ? <span style={{
          fontSize: 11, color: 'var(--blue)', background: 'var(--blue-bg)',
          padding: '2px 8px', borderRadius: 4, fontWeight: 600,
          border: '1px solid var(--blue)',
        }}>{v}</span>
        : <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>—</span>,
    },
    {
      title: <span style={colHead()}>File Size</span>,
      dataIndex: 'fileSize', key: 'fileSize', width: 100,
      render: (v: string) => v
        ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>
        : <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>—</span>,
    },
    {
      title: <span style={colHead()}>Click-through URL</span>,
      dataIndex: 'clickThroughUrl', key: 'clickThroughUrl', width: 220,
      render: (v: string) => <TrackerCell value={v} type="click" />,
    },
    {
      title: (
        <span style={colHead()}>
          Appended HTML Tag{' '}
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none' }}>optional</span>
        </span>
      ),
      dataIndex: 'appendedHtmlTag', key: 'appendedHtmlTag', width: 220,
      render: (v: string) => <TrackerCell value={v} type="html" />,
    },
    {
      title: (
        <span style={colHead()}>
          Integration Code{' '}
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none' }}>optional</span>
        </span>
      ),
      dataIndex: 'integrationCode', key: 'integrationCode', width: 180,
      render: (v: string) => <TruncCell value={v} mono />,
    },
    {
      title: (
        <span style={colHead()}>
          Notes{' '}
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none' }}>optional</span>
        </span>
      ),
      dataIndex: 'notes', key: 'notes', width: 160,
      render: (v: string) => <TruncCell value={v} />,
    },
    // ── Actions column ──────────────────────────────────────────────────────
    {
      title: <span style={colHead()}>Actions</span>,
      key: 'actions',
      width: 130,
      fixed: 'right',
      render: (_: any, record: VideoCreativeRow) => {
        const hasAsset = !!record.creativeId;

        return (
          <Tooltip title={hasAsset ? 'Download video asset' : 'No asset available'}>
            <Button
              size="small"
              icon={<DownloadOutlined style={{ fontSize: 12 }} />}
              onClick={(e) => handleDownload(e, record)}
              disabled={!hasAsset}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: hasAsset ? 'var(--blue)' : 'var(--border-strong)',
                background: hasAsset ? 'var(--blue-bg)' : 'var(--bg-input)',
                border: `1px solid ${hasAsset ? 'var(--blue)' : 'var(--border-strong)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: hasAsset ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              Download
            </Button>
          </Tooltip>
        );
      },
    },
  ];


  // ── Derive preview modal props safely ─────────────────────────────────────
  const previewUrl = previewRow?.mainAssetUrl ?? '';
  const previewName = previewRow?.mainAssetName || previewRow?.creativeName || 'creative';
  const previewExt = getExt(previewUrl) || 'file';

  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Video Creatives</h1>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, letterSpacing: '0.04em', fontWeight: 500 }}>ALL VIDEO CREATIVES ACROSS CAMPAIGNS</p>
        </div>

      </div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Video Creatives', value: rows.length, color: 'var(--blue)', bg: 'var(--blue-bg)', border: 'var(--blue)' },
          { label: 'With Asset', value: withAsset, color: 'var(--blue)', bg: 'var(--blue-bg)', border: 'var(--blue)' },
          { label: 'Valid Click URLs', value: withClickUrl, color: 'var(--green)', bg: 'var(--green-bg)', border: 'var(--green)' },
          { label: 'Valid HTML Tags', value: withTag, color: 'var(--amber)', bg: 'var(--amber-bg)', border: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: s.bg, border: `1px solid ${s.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: s.color,
            }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, padding: '14px 20px',
        border: '1px solid var(--border)', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Input
          placeholder="Search by creative name, ticket, line item…"
          prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 240, height: 36 }}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={fetchData}
          style={{ height: 36, color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
          Refresh
        </Button>
        <Text style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
          {filtered.length} of {rows.length} creatives
        </Text>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, fontSize: 11.5, color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
          Valid tracker detected
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)' }} />
          Invalid / missing tracker
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <CopyOutlined style={{ fontSize: 11, color: 'var(--text-secondary)' }} />
          <span>Click copy icon to copy URL / tag</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
          <PlayCircleOutlined style={{ fontSize: 11, color: 'var(--blue)' }} />
          <span>Click creative name to preview</span>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12,
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)', overflow: 'hidden',
      }}>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="key"
          loading={loading}
          scroll={{ x: 1900 }}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }}
          locale={{
            emptyText: (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <VideoCameraOutlined style={{ fontSize: 36, marginBottom: 12, color: 'var(--border-strong)' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No video creatives found</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Upload video creatives from the Campaign → Line Item → Creatives section.
                </div>
              </div>
            ),
          }}
          style={{ fontSize: 13 }}
        />
      </div>


      {/* Preview Modal — rendered outside table, uses derived safe props */}
      {previewOpen && previewUrl && (
        <PreviewModal
          open={previewOpen}
          onClose={() => { setPreviewOpen(false); setPreviewRow(null); }}
          url={previewUrl}
          name={previewName}
          ext={previewExt}
        />
      )}

      <style>{`
        .ant-table-thead > tr > th {
          background: var(--bg-input) !important; font-size: 11px !important;
          font-weight: 700 !important; color: var(--text-secondary) !important;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .ant-table-tbody > tr:hover > td { background: var(--bg-card-hover) !important; }
      `}</style>

    </>
  );
}