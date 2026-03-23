'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Download, ChevronLeft, RefreshCw, Plus,
  ImageIcon, FileText, Loader2, CheckCircle2, ZoomIn,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { usePosterStore } from '@/lib/store/posterStore';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';
import { Button } from '@/components/ui/button';

// ── 类型 ──────────────────────────────────────────────────────────
type ExportFormat = 'png' | 'jpg' | 'pdf';

interface DpiOption {
  label:    string;
  labelEn:  string;
  dpi:      number;
  scale:    1 | 2 | 3;
  note:     string;
  recommended?: boolean;
}

const DPI_OPTIONS: DpiOption[] = [
  { label: '社交媒体',  labelEn: 'Social Media', dpi: 72,  scale: 1, note: `${CANVAS_WIDTH} × ${CANVAS_HEIGHT} px，适合线上分享` },
  { label: '高清',      labelEn: 'HD',            dpi: 150, scale: 2, note: `${CANVAS_WIDTH * 2} × ${CANVAS_HEIGHT * 2} px，平衡质量与体积` },
  { label: '印刷级',    labelEn: 'Print Quality', dpi: 300, scale: 3, note: `${CANVAS_WIDTH * 3} × ${CANVAS_HEIGHT * 3} px，适合打印`, recommended: true },
];

const FORMAT_OPTIONS: { value: ExportFormat; icon: React.ReactNode; label: string; sublabel: string }[] = [
  { value: 'png', icon: <ImageIcon className="w-5 h-5" />, label: 'PNG', sublabel: '推荐，无损透明' },
  { value: 'jpg', icon: <ImageIcon className="w-5 h-5" />, label: 'JPG', sublabel: '通用，体积小' },
  { value: 'pdf', icon: <FileText  className="w-5 h-5" />, label: 'PDF', sublabel: '印刷级' },
];

// 预估文件大小（粗略）
function estimateSize(scale: 1 | 2 | 3, format: ExportFormat): string {
  const px = CANVAS_WIDTH * CANVAS_HEIGHT * scale * scale;
  const bytes = format === 'jpg' ? px * 0.15 : px * 0.5;
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `~${Math.round(mb * 1000)} KB`;
  return `~${mb.toFixed(1)} MB`;
}

function buildFileName(dishNameEn: string, format: ExportFormat): string {
  const safe = (dishNameEn || 'poster')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 40);
  return `PosterChef_${safe}_${Date.now()}.${format}`;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

// ── 主组件 ────────────────────────────────────────────────────────
export default function StepExport() {
  const {
    dishInfo,
    selectedBackground,
    processedImage,
    removedBgImage,
    enhancedImage,
    selectedCopy,
    prevStep,
    reset,
    posterPreviewUrl,
  } = usePosterStore();

  const [format,       setFormat]       = useState<ExportFormat>('png');
  const [dpiOption,    setDpiOption]    = useState<DpiOption>(DPI_OPTIONS[2]);   // 默认 300dpi
  const [isExporting,  setIsExporting]  = useState(false);
  const [progress,     setProgress]     = useState(0);   // 0-100
  const [doneMsg,      setDoneMsg]      = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // 预览图：优先用 store 中的截图，降级用背景图
  const previewUrl = posterPreviewUrl
    || selectedBackground?.url
    || processedImage
    || removedBgImage
    || enhancedImage
    || null;

  const dishNameEn = dishInfo?.nameEn || 'poster';

  // 模拟进度条（服务端请求时）
  useEffect(() => {
    if (!isExporting) { setProgress(0); return; }
    setProgress(5);
    const id = setInterval(() => {
      setProgress((p) => (p < 85 ? p + Math.random() * 8 : p));
    }, 300);
    return () => clearInterval(id);
  }, [isExporting]);

  // ── 服务端高清导出 ──────────────────────────────────────────────
  const exportViaServer = useCallback(async () => {
    // 获取当前预览 base64（去掉 data URL 前缀）
    if (!previewUrl) throw new Error('没有可导出的图片');
    const base64Data = previewUrl.includes(',')
      ? previewUrl.split(',')[1]
      : previewUrl;

    const res = await fetch('/api/export', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64Data,
        format,
        multiplier:  dpiOption.scale,
        quality:     95,
        dishNameEn,
      }),
    });

    if (format === 'pdf') {
      if (!res.ok) throw new Error('PDF 导出失败');
      const blob = await res.blob();
      saveAs(blob, buildFileName(dishNameEn, 'pdf'));
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
  }, [previewUrl, format, dpiOption.scale, dishNameEn]);

  // ── 纯前端本地导出（降级方案） ──────────────────────────────────
  const exportLocal = useCallback(async () => {
    if (!previewUrl) throw new Error('没有可导出的图片');

    const fileName = buildFileName(dishNameEn, format);

    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const mmW = CANVAS_WIDTH  * dpiOption.scale * 0.264583;
      const mmH = CANVAS_HEIGHT * dpiOption.scale * 0.264583;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [mmW, mmH] });
      doc.addImage(previewUrl, 'PNG', 0, 0, mmW, mmH);
      doc.save(fileName);
      return;
    }

    const blob = await dataUrlToBlob(previewUrl);
    saveAs(blob, fileName);
  }, [previewUrl, format, dpiOption.scale, dishNameEn]);

  // ── 主入口 ─────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setDoneMsg('');
    try {
      // 优先服务端（previewUrl 可能已经是高质量），否则本地
      await exportViaServer();
      setProgress(100);
      setDoneMsg('导出成功！');
    } catch (serverErr) {
      console.warn('Server export failed, falling back to local:', serverErr);
      try {
        await exportLocal();
        setProgress(100);
        setDoneMsg('导出成功！');
      } catch (localErr) {
        console.error('Local export also failed:', localErr);
        setDoneMsg('导出失败，请重试');
      }
    } finally {
      setIsExporting(false);
    }
  }, [exportViaServer, exportLocal]);

  const estimatedSize = estimateSize(dpiOption.scale, format);
  const outputW = CANVAS_WIDTH  * dpiOption.scale;
  const outputH = CANVAS_HEIGHT * dpiOption.scale;

  return (
    <div className="flex h-full w-full" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── 左侧：海报预览（60%） ──────────────────────────────────── */}
      <div className="flex-[0_0_60%] relative bg-neutral-950 flex items-center justify-center overflow-hidden">

        {previewUrl ? (
          <>
            {/* 海报图 */}
            <div
              className="relative shadow-2xl cursor-zoom-in group"
              onClick={() => setLightboxOpen(true)}
              style={{ maxHeight: 'calc(100vh - 120px)' }}
            >
              <img
                src={previewUrl}
                alt="海报预览"
                className="object-contain max-h-full w-auto rounded-sm"
                style={{ maxHeight: 'calc(100vh - 120px)' }}
              />
              {/* 放大提示 */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-sm flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-3">
                  <ZoomIn className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>

            {/* 海报信息标签 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
              <span className="text-xs text-neutral-300 font-medium">
                {dishInfo?.name || '海报预览'}
              </span>
              {dishInfo?.nameEn && (
                <span className="text-xs text-neutral-500">{dishInfo.nameEn}</span>
              )}
              <span className="text-[10px] text-neutral-600">
                {CANVAS_WIDTH} × {CANVAS_HEIGHT} px
              </span>
            </div>
          </>
        ) : (
          <div className="text-neutral-600 text-sm flex flex-col items-center gap-3">
            <ImageIcon className="w-12 h-12" />
            <p>没有可预览的海报</p>
            <Button variant="ghost" size="sm" onClick={() => prevStep()}>
              <ChevronLeft className="w-4 h-4 mr-1" /> 返回编辑
            </Button>
          </div>
        )}
      </div>

      {/* ── 右侧：导出选项（40%） ─────────────────────────────────── */}
      <div className="flex-[0_0_40%] bg-neutral-900 border-l border-neutral-800 flex flex-col overflow-y-auto">
        <div className="flex flex-col gap-6 p-6">

          {/* 标题 */}
          <div>
            <h2 className="text-lg font-bold text-white">下载海报</h2>
            <p className="text-xs text-neutral-500 mt-0.5">选择格式和质量，然后点击下载</p>
          </div>

          {/* 格式选择 */}
          <section>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-3">文件格式</p>
            <div className="flex gap-2.5">
              {FORMAT_OPTIONS.map(({ value, icon, label, sublabel }) => (
                <button
                  key={value}
                  onClick={() => setFormat(value)}
                  className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border transition-all ${
                    format === value
                      ? 'bg-orange-500/15 border-orange-500 text-orange-300 ring-1 ring-orange-500/30'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
                  }`}
                >
                  {icon}
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-[10px] text-neutral-500 text-center leading-tight">{sublabel}</span>
                  {format === value && (
                    <span className="text-[9px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium">✓ 已选</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* 质量 / DPI 选择 */}
          <section>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-3">导出质量</p>
            <div className="flex flex-col gap-2">
              {DPI_OPTIONS.map((opt) => (
                <button
                  key={opt.dpi}
                  onClick={() => setDpiOption(opt)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    dpiOption.dpi === opt.dpi
                      ? 'bg-orange-500/10 border-orange-500 text-white'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
                  }`}
                >
                  {/* 单选圆点 */}
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    dpiOption.dpi === opt.dpi
                      ? 'border-orange-500'
                      : 'border-neutral-600'
                  }`}>
                    {dpiOption.dpi === opt.dpi && (
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-neutral-600">
                        {opt.labelEn}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {opt.dpi} dpi
                      </span>
                      {opt.recommended && (
                        <span className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-full font-medium">
                          推荐
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-600 mt-0.5 truncate">{opt.note}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* 输出信息卡片 */}
          <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl px-4 py-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-neutral-500 mb-0.5">输出尺寸</p>
              <p className="text-xs font-bold text-white tabular-nums">{outputW} × {outputH}</p>
            </div>
            <div>
              <p className="text-[10px] text-neutral-500 mb-0.5">格式</p>
              <p className="text-xs font-bold text-orange-400 uppercase">{format}</p>
            </div>
            <div>
              <p className="text-[10px] text-neutral-500 mb-0.5">预估大小</p>
              <p className="text-xs font-bold text-white">{estimatedSize}</p>
            </div>
          </div>

          {/* 下载按钮 */}
          <div className="flex flex-col gap-3">
            {/* 进度条 */}
            {isExporting && (
              <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={isExporting || !previewUrl}
              className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors text-base shadow-lg shadow-orange-500/20"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  处理中… {progress > 0 ? `${Math.round(progress)}%` : ''}
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <div className="text-left">
                    <div>下载海报</div>
                    <div className="text-xs font-normal opacity-80">Download Poster</div>
                  </div>
                </>
              )}
            </button>

            {/* 成功/失败提示 */}
            {doneMsg && (
              <div className={`flex items-center justify-center gap-2 text-sm py-2 rounded-lg ${
                doneMsg.includes('成功')
                  ? 'text-green-400 bg-green-500/10'
                  : 'text-red-400 bg-red-500/10'
              }`}>
                {doneMsg.includes('成功') && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {doneMsg}
              </div>
            )}
          </div>

          {/* 底部导航链接 */}
          <div className="border-t border-neutral-800 pt-4 flex flex-col gap-2">
            <button
              onClick={() => prevStep()}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              返回编辑器
            </button>
            <button
              onClick={() => reset()}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              制作新海报（重置所有）
            </button>
          </div>

          {/* 版权小字 */}
          <p className="text-[10px] text-neutral-700 text-center">
            由 PosterChef · AI 餐厅海报生成器 制作
          </p>
        </div>
      </div>

      {/* ── Lightbox 全屏查看 ────────────────────────────────────── */}
      {lightboxOpen && previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={previewUrl}
            alt="海报全屏预览"
            className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 text-neutral-400 hover:text-white bg-neutral-800 rounded-full p-2"
            onClick={() => setLightboxOpen(false)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
