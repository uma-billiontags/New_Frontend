import { useState, useRef, useEffect } from 'react';
import { Modal, Tooltip, message } from 'antd';
import {
  EditOutlined, CheckOutlined, PlayCircleOutlined,
  FileOutlined, EyeOutlined, CloseOutlined, DownloadOutlined,
} from '@ant-design/icons';

const BASE_URL = import.meta.env.VITE_BASE_URL;

const PURPLE = '#7c3aed';
const PURPLE_LIGHT = '#f5f3ff';
const PURPLE_MID = '#ddd6fe';
const BLUE = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const SLATE = '#0F172A';
const SLATE_500 = '#64748B';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreativeDetail {
  id?: number;
  type?: 'standard' | 'third_party';
  creative_name?: string;
  dimensions?: string;
  click_through_url?: string;
  appended_html_tag?: string;
  input_file?: string;
  input_file_url?: string;
  backup_image?: string;
  main_asset?: string;
  main_asset_url?: string;
  creative_id?: string;
}

export interface LineItem {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Preview Modal ────────────────────────────────────────────────────────────

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
        // mask: { backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.65)' },
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
              a.download = name;   // forces download with filename
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
        {isImage(url) ? (
          <img
            src={resolved}
            alt={name}
            style={{
              maxWidth: '100%', maxHeight: 500,
              objectFit: 'contain', borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          />
        ) : isVideo(url) ? (
          <video
            src={resolved}
            controls
            autoPlay
            style={{ maxWidth: '100%', maxHeight: 480, borderRadius: 8 }}
          />
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 16, padding: 40,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 16,
              background: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, color: '#94a3b8',
            }}>
              <FileOutlined />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Preview not available for .{ext} files
              </div>
            </div>
            <a
              href={resolved}
              download
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 20px', borderRadius: 8,
                background: '#2563eb', color: '#fff',
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}
            >
              <DownloadOutlined /> Download File
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Creative ID Editor ───────────────────────────────────────────────────────

interface CreativeIdEditorProps {
  value: string;
  onSave: (v: string) => Promise<void>;
}

function CreativeIdEditor({ value, onSave }: CreativeIdEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = async () => {
    const trimmed = draft.trim();
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
      {editing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') cancel();
            }}
            placeholder="Enter creative ID…"
            style={{
              height: 22, fontSize: 10, 
              padding: '4px 8px', borderRadius: 4,
              border: '1.5px solid #6366f1',
              outline: 'none', width: 140, color: '#1e293b',
            }}
          />
          <button
            onClick={save}
            disabled={saving}
            title="Save (Enter)"
            style={{
              width: 20, height: 20, borderRadius: 4,
              border: 'none', background: saving ? '#86efac' : '#16a34a',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CheckOutlined style={{ fontSize: 9, color: '#fff' }} />
          </button>
          <button
            onClick={cancel}
            title="Cancel (Esc)"
            style={{
              width: 20, height: 20, borderRadius: 4,
              border: 'none', background: '#e2e8f0',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CloseOutlined style={{ fontSize: 9, color: '#64748b' }} />
          </button>
        </>
      ) : (
        <>
          <span style={{
            fontSize: 9.5,  fontWeight: 600,
            color: value ? '#4f46e5' : '#94a3b8',
            background: value ? '#eef2ff' : '#f8fafc',
            padding: '4px 8px', borderRadius: 3,
            border: `1px solid ${value ? '#c7d2fe' : '#e2e8f0'}`,
            minWidth: 140, display: 'inline-block',
          }}>
            {value || 'Creative ID'}
          </span>
          <Tooltip title="Edit Creative ID">
            <button
              onClick={() => setEditing(true)}
              style={{
                width: 20, height: 20, borderRadius: 4,
                border: '1px solid #e2e8f0', background: BLUE_LIGHT,
                cursor: 'pointer',
                color: BLUE,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <EditOutlined style={{ fontSize: 9, color: '#64748b' }} />
            </button>
          </Tooltip>
        </>
      )}
    </div>
  );
}

// ─── Single Creative Row ──────────────────────────────────────────────────────

interface CreativeRowProps {
  label: string;
  labelColor: string;
  labelBg: string;
  labelBorder: string;
  name: string;
  url?: string;
  dbId?: number;                          // ← DB primary key
  creativeType: 'standard' | 'third_party'; // ← type for backend
  initialCreativeId?: string;             // ← pre-filled from backend
}

function CreativeRow({
  label, labelColor, labelBg, labelBorder,
  name, url,
  dbId, creativeType, initialCreativeId = '',
}: CreativeRowProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedId, setSavedId] = useState(initialCreativeId);

  const ext = getExt(url) || label.toLowerCase();
  const canPrev = !!url;

  // ── Save creative ID to backend ──────────────────────────────────────────
  const handleSave = async (v: string) => {
    if (!dbId) {
      message.warning('No DB id found for this creative');
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/update_creative_id/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({
          id: dbId,
          type: creativeType,
          creative_id: v,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSavedId(v);
        message.success(data.message || 'Creative ID Added Successfully');
      } else {
        message.error(data.error || 'Failed to save');
      }
    } catch {
      message.error('Network error — could not save');
    }
  };

  return (
    <>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        padding: '6px 8px', borderRadius: 7,
        border: '0.5px solid #e2e8f0', background: '#fafbff',
        marginBottom: 5, minWidth: 200,
      }}>
        {/* Row 1: badge + name + preview button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: labelColor,
            background: labelBg, padding: '1px 5px',
            borderRadius: 3, border: `1px solid ${labelBorder}`,
            flexShrink: 0,
          }}>{label}</span>

          <span style={{
            fontSize: 11.5, color: SLATE, flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 160,
          }} title={name}>
            {name}
          </span>

          {canPrev && (
            <Tooltip title={
              isImage(url) ? 'Preview image'
                : isVideo(url) ? 'Play video'
                  : 'View file'
            }>
              <button
                onClick={() => setPreviewOpen(true)}
                style={{
                  width: 22, height: 22, borderRadius: 5,
                  border: '1px solid #bfdbfe', background: BLUE_LIGHT,
                  cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {isVideo(url)
                  ? <PlayCircleOutlined style={{ fontSize: 11, color: PURPLE }} />
                  : <EyeOutlined style={{ fontSize: 11, color: BLUE }} />}
              </button>
            </Tooltip>
          )}
        </div>

        {/* Row 2: creative ID editor — always visible */}
        <CreativeIdEditor
          value={savedId}
          onSave={handleSave}
        />
      </div>

      {previewOpen && url && (
        <PreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          url={url}
          name={name}
          ext={ext}
        />
      )}
    </>
  );
}

// ─── Main CreativesCell ───────────────────────────────────────────────────────

export default function CreativesCell({ li }: { li: LineItem }) {
  const stdCreatives = (li.creatives ?? []).filter(c => !c.type || c.type === 'standard');
  const tpCreatives = (li.creatives ?? []).filter(c => c.type === 'third_party');
  const tpArray = li.third_party_creatives ?? [];
  const allTP = tpCreatives.length > 0 ? tpCreatives : tpArray;
  const imageNames = li.image_creatives ?? [];
  const videoNames = li.video_creatives ?? [];

  const hasAny =
    imageNames.length > 0 || videoNames.length > 0 ||
    stdCreatives.length > 0 || allTP.length > 0;

  if (!hasAny) return <span style={{ color: SLATE_500, fontSize: 11 }}>—</span>;

  const adFormats = Array.isArray(li.ad_format)
    ? li.ad_format.map(a => a.toLowerCase())
    : [li.ad_format?.toLowerCase() ?? ''];
  const liIsVideo = adFormats.some(a => a.includes('video'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Standard creatives (from li.creatives[]) ── */}
      {stdCreatives.map((c, i) => {
        const fileUrl = c.main_asset_url || c.main_asset;
        const ext = getExt(fileUrl);
        const isVid = isVideo(fileUrl) || liIsVideo;
        const label = isVid ? 'VID' : (isImage(fileUrl) ? 'IMG' : (ext.toUpperCase() || 'FILE'));

        return (
          <CreativeRow
            key={`std-${i}`}
            label={label}
            labelColor={isVid ? PURPLE : BLUE}
            labelBg={isVid ? PURPLE_LIGHT : BLUE_LIGHT}
            labelBorder={isVid ? PURPLE_MID : '#bfdbfe'}
            name={c.creative_name || `Creative ${i + 1}`}
            url={fileUrl}
            dbId={c.id}                        // ← DB id from backend
            creativeType="standard"            // ← type for PATCH endpoint
            initialCreativeId={c.creative_id ?? ''}  // ← pre-fill if already set
          />
        );
      })}

      {/* ── image_creatives[] — name strings only (no URL/id) ── */}
      {imageNames.map((name, i) => (
        <CreativeRow
          key={`img-${i}`}
          label="IMG"
          labelColor={BLUE} labelBg={BLUE_LIGHT} labelBorder="#bfdbfe"
          name={name}
          url={undefined}
          dbId={undefined}
          creativeType="standard"
        />
      ))}

      {/* ── video_creatives[] — name strings only ── */}
      {videoNames.map((name, i) => (
        <CreativeRow
          key={`vid-${i}`}
          label="VID"
          labelColor={PURPLE} labelBg={PURPLE_LIGHT} labelBorder={PURPLE_MID}
          name={name}
          url={undefined}
          dbId={undefined}
          creativeType="standard"
        />
      ))}

      {/* ── Third-party creatives ── */}
      {allTP.map((tp, i) => {
        const fileUrl = (tp as CreativeDetail).input_file_url
          || (tp as CreativeDetail).input_file;
        const fileName = (fileUrl ? fileUrl.split('/').pop() : undefined)
          || `Third Party ${i + 1}`;
        const ext = getExt(fileUrl) || 'file';
        const label = ext.toUpperCase();

        return (
          <CreativeRow
            key={`tp-${i}`}
            label={label}
            labelColor="#92400e" labelBg="#fff7ed" labelBorder="#fed7aa"
            name={fileName}
            url={fileUrl}
            dbId={(tp as CreativeDetail).id}          // ← DB id
            creativeType="third_party"                // ← type for PATCH endpoint
            initialCreativeId={(tp as CreativeDetail).creative_id ?? ''}
          />
        );
      })}
    </div>
  );
}