import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Input, Tooltip, message } from "antd";
import {
    ArrowLeftOutlined, SaveOutlined, PlusOutlined, DeleteOutlined,
    InboxOutlined, PlayCircleOutlined, UploadOutlined, PictureOutlined,
} from "@ant-design/icons";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CreativeData {
    creative_name: string;
    main_asset?: File | null;
    backup_image?: File | null;
    dimensions?: string;
    aspect_ratio?: string;
    file_size?: string;
    click_through_url?: string;
    appended_html_tag?: string;
    integration_code?: string;
    notes?: string;
    type?: "standard" | "third_party";
}

interface CreativeRow extends CreativeData {
    rowId: string;
    previewUrl?: string;
}

let rowSeq = 0;
const nextRowId = () => `row_${Date.now()}_${rowSeq++}`;

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
function aspectRatioOf(w: number, h: number): string {
    if (!w || !h) return "";
    const d = gcd(w, h);
    return `${w / d}:${h / d}`;
}

function readVideoMeta(file: File): Promise<{ dimensions: string; aspect_ratio: string; previewUrl: string }> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            resolve({
                dimensions: `${video.videoWidth}x${video.videoHeight}`,
                aspect_ratio: aspectRatioOf(video.videoWidth, video.videoHeight),
                previewUrl: url,
            });
        };
        video.onerror = () => resolve({ dimensions: "", aspect_ratio: "", previewUrl: url });
        video.src = url;
    });
}

function stripExt(name: string): string {
    const idx = name.lastIndexOf(".");
    return idx > 0 ? name.slice(0, idx) : name;
}

// ── Row cell wrapper ───────────────────────────────────────────────────────────
function Cell({ children, width }: { children: React.ReactNode; width: number }) {
    return <td style={{ padding: "8px 10px", verticalAlign: "top", width, minWidth: width }}>{children}</td>;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Video_Creatives_Campaign() {
    const navigate = useNavigate();
    const location = useLocation();
    const locationState = location.state as any;

    const lineItemId: string = locationState?.lineItemId || "";
    const returnTo: string = locationState?.returnTo || "/account_manager/campaign_create_leads";
    const allLineItemCreatives = locationState?.allLineItemCreatives || {};
    const existingCreatives: CreativeData[] = locationState?.existingCreatives || [];

    const [rows, setRows] = useState<CreativeRow[]>(
        existingCreatives.map((c) => ({ ...c, rowId: nextRowId() }))
    );
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Row management ──
    const addBlankRow = (type: "standard" | "third_party" = "standard") => {
        setRows((prev) => [...prev, { rowId: nextRowId(), creative_name: "", type }]);
    };

    const removeRow = (rowId: string) => {
        setRows((prev) => prev.filter((r) => r.rowId !== rowId));
    };

    const updateRow = (rowId: string, field: keyof CreativeRow, value: any) => {
        setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, [field]: value } : r)));
    };

    const attachFileToRow = async (rowId: string, file: File, field: "main_asset" | "backup_image" = "main_asset") => {
        if (field === "main_asset") {
            const meta = await readVideoMeta(file);
            setRows((prev) => prev.map((r) => (r.rowId === rowId ? {
                ...r,
                main_asset: file,
                dimensions: meta.dimensions,
                aspect_ratio: meta.aspect_ratio,
                file_size: fmtFileSize(file.size),
                previewUrl: meta.previewUrl,
                creative_name: r.creative_name || stripExt(file.name),
            } : r)));
        } else {
            // backup image for a third-party video creative
            setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, backup_image: file } : r)));
        }
    };

    // ── Bulk add: each dropped/browsed video becomes its own row ──
    const addFilesAsRows = async (files: FileList | File[]) => {
        const videoFiles = Array.from(files).filter((f) => f.type.startsWith("video/"));
        const skipped = files.length - videoFiles.length;
        if (skipped > 0) message.warning(`Skipped ${skipped} non-video file(s).`);
        if (videoFiles.length === 0) return;

        const newRows: CreativeRow[] = [];
        for (const file of videoFiles) {
            const meta = await readVideoMeta(file);
            newRows.push({
                rowId: nextRowId(),
                creative_name: stripExt(file.name),
                main_asset: file,
                dimensions: meta.dimensions,
                aspect_ratio: meta.aspect_ratio,
                file_size: fmtFileSize(file.size),
                previewUrl: meta.previewUrl,
                type: "standard",
            });
        }
        setRows((prev) => [...prev, ...newRows]);
    };

    // ── Dropzone handlers ──
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.length) addFilesAsRows(e.dataTransfer.files);
    };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); };
    const openBrowse = () => fileInputRef.current?.click();

    const handleSave = () => {
        const invalid = rows.filter((r) => !r.creative_name.trim());
        if (invalid.length > 0) {
            message.error("Every creative needs a name before saving.");
            return;
        }
        const cleaned: CreativeData[] = rows.map(({ rowId, previewUrl, ...rest }) => rest);
        navigate(returnTo, {
            state: {
                uploadedCreatives: cleaned,
                lineItemId,
                allLineItemCreatives,
                fromCreativeUpload: true,
            },
        });
    };

    const handleCancel = () => navigate(returnTo, { state: { fromCreativeUpload: true, allLineItemCreatives } });

    const standardCount = rows.filter((r) => r.type !== "third_party").length;
    const thirdPartyCount = rows.filter((r) => r.type === "third_party").length;

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
            {/* Header bar */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 24px", background: "var(--bg-card)", borderBottom: "1px solid var(--border)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={handleCancel}>Back</Button>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span style={{
                            background: "var(--accent)", color: "#fff", fontWeight: 800, fontSize: 11,
                            padding: "3px 8px", borderRadius: 6,
                        }}>CRM</span>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Billion Tags</span>
                        <span style={{ color: "var(--text-muted)" }}>Creatives</span>
                        <span style={{ color: "var(--text-muted)" }}>›</span>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Video Bulk Upload</span>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <Button onClick={handleCancel}>Cancel</Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save Creatives</Button>
                </div>
            </div>

            <div style={{ padding: "24px 32px", maxWidth: 1300, margin: "0 auto" }}>
                {/* Title */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 10, background: "var(--blue-bg)",
                        border: "1px solid var(--blue)", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <PlayCircleOutlined style={{ fontSize: 20, color: "var(--blue)" }} />
                    </div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <h1 style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                                Bulk Upload Video Creatives
                            </h1>
                            {lineItemId && (
                                <span style={{
                                    fontSize: 11, fontWeight: 700, color: "var(--blue)", background: "var(--blue-bg)",
                                    border: "1px solid var(--blue)", padding: "2px 10px", borderRadius: 6,
                                }}>{lineItemId}</span>
                            )}
                        </div>
                        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0" }}>
                            Upload video creatives for your line item
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => addBlankRow("standard")}>
                        Add Video Creative
                    </Button>
                    <Button icon={<PictureOutlined />} onClick={() => addBlankRow("third_party")}>
                        Third Party
                    </Button>
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>
                        {standardCount} standard{thirdPartyCount > 0 ? ` · ${thirdPartyCount} third-party` : ""}
                    </span>
                </div>

                {/* Table */}
                <div style={{
                    background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
                    overflow: "auto", marginBottom: 20,
                }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
                        <thead>
                            <tr style={{ background: "var(--bg-page)" }}>
                                {["#", "Creative Name", "Main Asset", "Dimensions", "Aspect Ratio", "File Size",
                                    "Click-through URL", "Appended HTML Tag", "Integration Code", "Notes", "Actions"].map((h) => (
                                        <th key={h} style={{
                                            padding: "10px", textAlign: "left", fontSize: 11, fontWeight: 700,
                                            color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em",
                                            borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                                        }}>{h}</th>
                                    ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={11} style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)" }}>
                                        No creatives added yet — use “Add Video Creative,” “Third Party,” or drop files below.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row, idx) => {
                                const isTP = row.type === "third_party";
                                return (
                                    <tr key={row.rowId} style={{ borderBottom: "1px solid var(--border)" }}>
                                        <Cell width={36}>{idx + 1}</Cell>
                                        <Cell width={170}>
                                            <Input size="small" value={row.creative_name}
                                                placeholder="Creative name"
                                                onChange={(e) => updateRow(row.rowId, "creative_name", e.target.value)} />
                                            {isTP && (
                                                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>Third-party</div>
                                            )}
                                        </Cell>
                                        <Cell width={190}>
                                            {isTP ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                    <label style={{
                                                        display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                                                        fontSize: 11.5, color: "var(--accent)",
                                                    }}>
                                                        <UploadOutlined /> {row.main_asset ? row.main_asset.name : "Input file"}
                                                        <input type="file" style={{ display: "none" }}
                                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) attachFileToRow(row.rowId, f, "main_asset"); }} />
                                                    </label>
                                                    <label style={{
                                                        display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                                                        fontSize: 11.5, color: "var(--accent)",
                                                    }}>
                                                        <UploadOutlined /> {row.backup_image ? row.backup_image.name : "Backup image"}
                                                        <input type="file" accept="image/*" style={{ display: "none" }}
                                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) attachFileToRow(row.rowId, f, "backup_image"); }} />
                                                    </label>
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    {row.previewUrl ? (
                                                        <video src={row.previewUrl} muted style={{ width: 40, height: 30, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border)" }} />
                                                    ) : (
                                                        <div style={{
                                                            width: 40, height: 30, borderRadius: 4, background: "var(--bg-page)",
                                                            border: "1px dashed var(--border-strong)", display: "flex",
                                                            alignItems: "center", justifyContent: "center", flexShrink: 0,
                                                        }}><PlayCircleOutlined style={{ fontSize: 12, color: "var(--text-muted)" }} /></div>
                                                    )}
                                                    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11.5, color: "var(--accent)" }}>
                                                        {row.main_asset ? "Change" : "Choose file"}
                                                        <input type="file" accept="video/*" style={{ display: "none" }}
                                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) attachFileToRow(row.rowId, f); }} />
                                                    </label>
                                                </div>
                                            )}
                                        </Cell>
                                        <Cell width={90}>{isTP ? <span style={{ color: "var(--text-muted)" }}>—</span> : (row.dimensions || <span style={{ color: "var(--text-muted)" }}>—</span>)}</Cell>
                                        <Cell width={90}>{isTP ? <span style={{ color: "var(--text-muted)" }}>—</span> : (row.aspect_ratio || <span style={{ color: "var(--text-muted)" }}>—</span>)}</Cell>
                                        <Cell width={80}>{isTP ? <span style={{ color: "var(--text-muted)" }}>—</span> : (row.file_size || <span style={{ color: "var(--text-muted)" }}>—</span>)}</Cell>
                                        <Cell width={170}>
                                            {isTP ? <span style={{ color: "var(--text-muted)" }}>—</span> : (
                                                <Input size="small" placeholder="…trackclk…" value={row.click_through_url || ""}
                                                    onChange={(e) => updateRow(row.rowId, "click_through_url", e.target.value)} />
                                            )}
                                        </Cell>
                                        <Cell width={170}>
                                            {isTP ? <span style={{ color: "var(--text-muted)" }}>—</span> : (
                                                <Input size="small" placeholder="https://…?" value={row.appended_html_tag || ""}
                                                    onChange={(e) => updateRow(row.rowId, "appended_html_tag", e.target.value)} />
                                            )}
                                        </Cell>
                                        <Cell width={150}>
                                            {isTP ? <span style={{ color: "var(--text-muted)" }}>—</span> : (
                                                <Input size="small" placeholder="Optional" value={row.integration_code || ""}
                                                    onChange={(e) => updateRow(row.rowId, "integration_code", e.target.value)} />
                                            )}
                                        </Cell>
                                        <Cell width={150}>
                                            <Input size="small" placeholder="Optional" value={row.notes || ""}
                                                onChange={(e) => updateRow(row.rowId, "notes", e.target.value)} />
                                        </Cell>
                                        <Cell width={60}>
                                            <Tooltip title="Remove">
                                                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeRow(row.rowId)} />
                                            </Tooltip>
                                        </Cell>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Dropzone — drop multiple videos to add rows in one go */}
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={openBrowse}
                    style={{
                        border: `2px dashed ${dragActive ? "var(--accent)" : "var(--border-strong)"}`,
                        borderRadius: 12, padding: "48px 24px", textAlign: "center", cursor: "pointer",
                        background: dragActive ? "var(--accent-light)" : "var(--bg-card)", transition: "all 0.15s",
                    }}
                >
                    <div style={{
                        width: 52, height: 52, borderRadius: 12, background: "var(--accent-light)",
                        border: "1px solid var(--border-strong)", display: "flex", alignItems: "center",
                        justifyContent: "center", margin: "0 auto 16px",
                    }}>
                        <InboxOutlined style={{ fontSize: 22, color: "var(--accent)" }} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                        Drag &amp; drop your videos here
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
                        or click to browse files
                    </div>
                    <Button type="primary" icon={<UploadOutlined />} onClick={(e) => { e.stopPropagation(); openBrowse(); }}>
                        Browse
                    </Button>
                    <input ref={fileInputRef} type="file" multiple accept="video/*" style={{ display: "none" }}
                        onChange={(e) => { if (e.target.files) addFilesAsRows(e.target.files); e.target.value = ""; }} />
                </div>
            </div>
        </div>
    );
}