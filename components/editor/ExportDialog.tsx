'use client';

import { useState, useCallback } from 'react';
import { Download, X, ImageIcon, FileText, Loader2, Zap, Monitor } from 'lucide-react';
import { saveAs } from 'file-saver';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';
import type { PosterCanvasHandle } from './PosterCanvas';

// ── 类型 ──────────────────────────────────────────────────────────
type ExportFormat = 'png' | 'jpg' | 'pdf';
type ExportScale  = 1 | 2 | 3;

interface ExportOption<T> {
  value: T;
  label: string;
  sub?:  string;
}

const FORMAT_OPTIONS: ExportOption<ExportFormat>[] = [
  { value: 'png', label: 'PNG', sub: '透明背景，无损画质' },
  { value: 'jpg', label: 'JPG', sub: '文件更小，适合分享' },
  { value: 'pdf', label: 'PDF', sub: '印刷首选' },
];

const SCALE_OPTIONS: ExportOption<ExportScale>[] = [
  { value: 1, label: '1×', sub: `${CANVAS_WIDTH} × ${CANVAS_HEIGHT}` },
  { value: 2, label: '2×', sub: `${CANVAS_WIDTH * 2} × ${CANVAS_HEIGHT * 2}` },
  { value: 3, label: '3×', sub: `${CANVAS_WIDTH * 3} × ${CANVAS_HEIGHT * 3}  (印刷)` },
];

// ── 辅助 ──────────────────────────────────────────────────────────
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

function buildFileName(dishNameEn: string, format: ExportFormat): string {
  const safe = (dishNameEn || 'poster')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 40);
  return `PosterChef_${safe}_${Date.now()}.${format === 'jpg' ? 'jpg' : format}`;
}

// ── 组件 ──────────────────────────────────────────────────────────
export interface ExportDialogProps {
  canvasRef:   React.RefObject<PosterCanvasHandle | null>;
  dishNameEn?: string;   // 用于文件名，来自 dishInfo.nameEn
  onClose:     () => void;
}

export default function ExportDialog({
  canvasRef,
  dishNameEn = 'poster',
  onClose,
}: ExportDialogProps) {
  const [format,      setFormat]      = useState<ExportFormat>('png');
  const [scale,       setScale]       = useState<ExportScale>(2);
  const [useServer,   setUseServer]   = useState(true);   // 服务端高清 vs 纯前端
  const [isExporting, setIsExporting] = useState(false);
  const [doneMsg,     setDoneMsg]     = useState('');

  // ── 服务端高清导出 ──────────────────────────────────────────────
  const exportViaServer = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 从 canvas 截图（1× 即可，服务端再 resize）
    const dataUrl    = canvas.exportPng(1);
    const base64Data = dataUrl.split(',')[1];

    const res = await fetch('/api/export', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64Data,
        format,
        multiplier:  scale,
        quality:     92,
        dishNameEn,
      }),
    });

    if (format === 'pdf') {
      if (!res.ok) throw new Error('PDF 导出失败');
      const blob     = await res.blob();
      const fileName = buildFileName(dishNameEn, 'pdf');
      saveAs(blob, fileName);
      return;
    }

    const json = await res.json();
    if (!json.success) throw new Error(json.error || '服务端导出失败');

    const { imageBase64, mimeType, fileName: serverFileName } = json.data as {
      imageBase64: string;
      mimeType:    string;
      fileName:    string;
    };
    const blob = await dataUrlToBlob(`data:${mimeType};base64,${imageBase64}`);
    saveAs(blob, serverFileName || buildFileName(dishNameEn, format));
  }, [canvasRef, format, scale, dishNameEn]);

  // ── 纯前端导出（无需服务端） ────────────────────────────────────
  const exportLocal = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fileName = buildFileName(dishNameEn, format);

    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const dataUrl   = canvas.exportPng(scale);
      const pw = CANVAS_WIDTH  * scale;
      const ph = CANVAS_HEIGHT * scale;
      const mmW = pw * 0.264583;
      const mmH = ph * 0.264583;
      const doc = new jsPDF({
        orientation: mmH >= mmW ? 'portrait' : 'landscape',
        unit:        'mm',
        format:      [mmW, mmH],
      });
      doc.addImage(dataUrl, 'PNG', 0, 0, mmW, mmH);
      doc.save(fileName);
      return;
    }

    const dataUrl = format === 'jpg'
      ? canvas.exportJpg(scale, 0.92)
      : canvas.exportPng(scale);
    const blob = await dataUrlToBlob(dataUrl);
    saveAs(blob, fileName);
  }, [canvasRef, format, scale, dishNameEn]);

  // ── 主导出入口 ──────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setDoneMsg('');
    try {
      if (useServer) {
        await exportViaServer();
      } else {
        await exportLocal();
      }
      setDoneMsg('导出成功！文件已开始下载');
    } catch (err) {
      console.error('Export error:', err);
      setDoneMsg('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  }, [useServer, exportViaServer, exportLocal]);

  const outputW = CANVAS_WIDTH  * scale;
  const outputH = CANVAS_HEIGHT * scale;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-[420px] bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-6 flex flex-col gap-5">

        {/* 标题栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-white">导出海报</span>
            {dishNameEn && dishNameEn !== 'poster' && (
              <span className="text-xs text-neutral-500">— {dishNameEn}</span>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 格式选择 */}
        <section>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-2">文件格式</p>
          <div className="flex gap-2">
            {FORMAT_OPTIONS.map(({ value, label, sub }) => (
              <button
                key={value}
                onClick={() => setFormat(value)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-colors ${
                  format === value
                    ? 'bg-orange-500/10 border-orange-500 text-orange-300'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
                }`}
              >
                {value === 'pdf' ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                <span>{label}</span>
                {sub && <span className="text-[9px] text-neutral-500 text-center leading-tight">{sub}</span>}
              </button>
            ))}
          </div>
        </section>

        {/* 分辨率选择 */}
        <section>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-2">导出分辨率</p>
          <div className="flex gap-2">
            {SCALE_OPTIONS.map(({ value, label, sub }) => (
              <button
                key={value}
                onClick={() => setScale(value)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                  scale === value
                    ? 'bg-orange-500/10 border-orange-500 text-orange-300'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
                }`}
              >
                <span className="text-sm font-bold">{label}</span>
                <span className="text-[9px] text-neutral-500 text-center leading-tight">{sub}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 渲染模式 */}
        <section>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-2">渲染方式</p>
          <div className="flex gap-2">
            <button
              onClick={() => setUseServer(true)}
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                useServer
                  ? 'bg-orange-500/10 border-orange-500 text-orange-300'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <div className="text-left">
                <div>服务端高清</div>
                <div className="text-[9px] text-neutral-500">Sharp 处理，质量最佳</div>
              </div>
            </button>
            <button
              onClick={() => setUseServer(false)}
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                !useServer
                  ? 'bg-orange-500/10 border-orange-500 text-orange-300'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 shrink-0" />
              <div className="text-left">
                <div>本地快速</div>
                <div className="text-[9px] text-neutral-500">无需上传，即时下载</div>
              </div>
            </button>
          </div>
        </section>

        {/* 预览信息 */}
        <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-neutral-500 mb-0.5">输出尺寸</p>
            <p className="text-sm font-bold text-white tabular-nums">
              {outputW} × {outputH} <span className="text-xs font-normal text-neutral-500">px</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-neutral-500 mb-0.5">文件名预览</p>
            <p className="text-[10px] text-neutral-400 font-mono truncate max-w-[160px]">
              PosterChef_{(dishNameEn || 'poster').replace(/\s+/g, '_').slice(0, 16)}_…
            </p>
          </div>
        </div>

        {/* 导出按钮 */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {isExporting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {useServer ? '服务端处理中…' : '导出中…'}</>
            : <><Download className="w-4 h-4" /> 立即导出</>
          }
        </button>

        {/* 成功/失败提示 */}
        {doneMsg && (
          <p className={`text-center text-xs ${doneMsg.includes('成功') ? 'text-green-400' : 'text-red-400'}`}>
            {doneMsg}
          </p>
        )}

        <p className="text-[10px] text-neutral-600 text-center leading-relaxed">
          3× 适合印刷（约 300 dpi）· PDF 可直接发给印刷厂
        </p>
      </div>
    </div>
  );
}
