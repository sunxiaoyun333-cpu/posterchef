'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, FabricImage, IText, Rect } from 'fabric';
import { Download, ChevronLeft, Palette, Type, Bold, Italic, Sparkles, RefreshCw, CheckCircle, ChevronRight } from 'lucide-react';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { usePosterStore } from '@/lib/store/posterStore';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';
import type { GeneratedCopy } from '@/app/api/generate-copy/route';

// ── 海报逻辑尺寸 ─────────────────────────────────────────────────
const POSTER_W = CANVAS_WIDTH;   // 800
const POSTER_H = CANVAS_HEIGHT;  // 1000

// 画布文字对象的 data 标记，用于一键替换时精确定位
const TEXT_KEYS = {
  MAIN_TITLE:   'main_title',
  SUB_TITLE:    'sub_title',
  DESCRIPTION:  'description',
  PRICE:        'price',
};

// 背景颜色预设
const BG_PRESETS = [
  '#1a1a2e', '#16213e', '#0f3460', '#533483',
  '#1b1b2f', '#2c2c54', '#2d4a22', '#3d1a0f',
  '#ffffff', '#f5f5f0', '#fef9ef', '#fff8f0',
  '#c0392b', '#e67e22', '#27ae60', '#d4ac0d',
];

// 文字颜色预设
const TEXT_COLOR_PRESETS = [
  '#ffffff', '#fbbf24', '#f87171', '#34d399',
  '#60a5fa', '#c084fc', '#fb7185', '#1a1a2e',
];

const STYLE_BADGE: Record<string, string> = {
  formal: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  casual: 'bg-green-500/20 text-green-300 border-green-500/30',
  promo:  'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

export default function StepGenerate() {
  const {
    processedImage,
    enhancedImage,
    removedBgImage,
    dishInfo,
    selectedCopy,
    prevStep,
  } = usePosterStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef  = useRef<HTMLCanvasElement>(null);
  const fabricRef    = useRef<Canvas | null>(null);

  const [bgColor,            setBgColor]            = useState('#1a1a2e');
  const [canvasScale,        setCanvasScale]        = useState(1);
  const [selectedTextColor,  setSelectedTextColor]  = useState('#ffffff');
  const [isBold,             setIsBold]             = useState(false);
  const [isItalic,           setIsItalic]           = useState(false);
  const [isExporting,        setIsExporting]        = useState(false);
  const [isTextActive,       setIsTextActive]       = useState(false);

  // 文案面板状态
  const [copySets,           setCopySets]           = useState<GeneratedCopy[]>([]);
  const [isGeneratingCopy,   setIsGeneratingCopy]   = useState(false);
  const [copyError,          setCopyError]          = useState<string | null>(null);
  const [appliedIndex,       setAppliedIndex]       = useState<number | null>(null);

  // ── 计算响应式缩放 ────────────────────────────────────────────
  const calcScale = useCallback(() => {
    if (!containerRef.current) return 1;
    const available = containerRef.current.clientWidth - 32;
    return Math.min(1, available / POSTER_W);
  }, []);

  // ── 从选中对象同步工具栏状态 ─────────────────────────────────
  function syncToolbarFromObj(obj: unknown) {
    if (obj instanceof IText) {
      setIsTextActive(true);
      const fill = obj.fill;
      if (typeof fill === 'string') setSelectedTextColor(fill);
      setIsBold(obj.fontWeight === 'bold');
      setIsItalic(obj.fontStyle === 'italic');
    } else {
      setIsTextActive(false);
    }
  }

  // ── 自动初始布局 ─────────────────────────────────────────────
  async function buildInitialLayout(fc: Canvas) {
    const imgSrc = processedImage || removedBgImage || enhancedImage;
    if (imgSrc) {
      try {
        const img = await FabricImage.fromURL(imgSrc, { crossOrigin: 'anonymous' });
        const maxW = POSTER_W * 0.85;
        const maxH = POSTER_H * 0.52;
        const ratio = Math.min(maxW / (img.width ?? 1), maxH / (img.height ?? 1));
        img.scale(ratio);
        img.set({
          left: POSTER_W / 2,
          top: POSTER_H * 0.32,
          originX: 'center',
          originY: 'center',
          data: { key: 'dish_image' },
        });
        fc.add(img);
      } catch {
        // 图片加载失败时跳过
      }
    }

    const headlineCn = selectedCopy?.headline ?? dishInfo?.name        ?? '菜品名称';
    const headlineEn = selectedCopy?.headlineEn ?? dishInfo?.nameEn    ?? 'Dish Name';
    const tagline    = selectedCopy?.tagline    ?? dishInfo?.description   ?? '';
    const taglineEn  = selectedCopy?.taglineEn  ?? dishInfo?.descriptionEn ?? '';
    const price      = selectedCopy?.price;

    // 分隔线
    fc.add(new Rect({
      left: POSTER_W / 2,
      top: POSTER_H * 0.68,
      originX: 'center',
      originY: 'center',
      width: POSTER_W * 0.4,
      height: 1,
      fill: 'rgba(255,255,255,0.3)',
      selectable: false,
      evented: false,
    }));

    // 主标题（中文）
    fc.add(new IText(headlineCn, {
      left: POSTER_W / 2,
      top: POSTER_H * 0.73,
      originX: 'center',
      originY: 'center',
      fontSize: 52,
      fontWeight: 'bold',
      fill: '#ffffff',
      fontFamily: 'Georgia, serif',
      textAlign: 'center',
      data: { key: TEXT_KEYS.MAIN_TITLE },
    }));

    // 英文标题
    fc.add(new IText(headlineEn, {
      left: POSTER_W / 2,
      top: POSTER_H * 0.81,
      originX: 'center',
      originY: 'center',
      fontSize: 28,
      fill: 'rgba(255,255,255,0.7)',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'italic',
      textAlign: 'center',
      data: { key: TEXT_KEYS.SUB_TITLE },
    }));

    if (tagline) {
      fc.add(new IText(tagline, {
        left: POSTER_W / 2,
        top: POSTER_H * 0.88,
        originX: 'center',
        originY: 'center',
        fontSize: 20,
        fill: 'rgba(255,255,255,0.6)',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        data: { key: TEXT_KEYS.DESCRIPTION },
      }));
    }

    if (taglineEn) {
      fc.add(new IText(taglineEn, {
        left: POSTER_W / 2,
        top: POSTER_H * (tagline ? 0.92 : 0.88),
        originX: 'center',
        originY: 'center',
        fontSize: 16,
        fill: 'rgba(255,255,255,0.45)',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        data: { key: 'description_en' },
      }));
    }

    if (price) {
      fc.add(new Rect({
        left: POSTER_W / 2,
        top: POSTER_H * 0.96,
        originX: 'center',
        originY: 'center',
        width: 140,
        height: 42,
        fill: '#e67e22',
        rx: 21,
        ry: 21,
        data: { key: 'price_bg' },
      }));
      fc.add(new IText(price, {
        left: POSTER_W / 2,
        top: POSTER_H * 0.96,
        originX: 'center',
        originY: 'center',
        fontSize: 22,
        fontWeight: 'bold',
        fill: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        data: { key: TEXT_KEYS.PRICE },
      }));
    }

    fc.requestRenderAll();
  }

  // ── 初始化 Fabric.js ─────────────────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return;

    const scale = calcScale();
    setCanvasScale(scale);

    const fc = new Canvas(canvasElRef.current, {
      width: POSTER_W * scale,
      height: POSTER_H * scale,
      backgroundColor: bgColor,
      selection: true,
      preserveObjectStacking: true,
    });

    fc.setZoom(scale);
    fabricRef.current = fc;

    fc.on('selection:created', (e) => syncToolbarFromObj(e.selected?.[0]));
    fc.on('selection:updated', (e) => syncToolbarFromObj(e.selected?.[0]));
    fc.on('selection:cleared', () => setIsTextActive(false));

    buildInitialLayout(fc);

    return () => {
      fc.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 响应式 resize ────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      const fc = fabricRef.current;
      if (!fc || !containerRef.current) return;
      const scale = calcScale();
      setCanvasScale(scale);
      fc.setDimensions({ width: POSTER_W * scale, height: POSTER_H * scale });
      fc.setZoom(scale);
      fc.requestRenderAll();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [calcScale]);

  // ── 更换背景色 ───────────────────────────────────────────────
  function applyBgColor(color: string) {
    setBgColor(color);
    const fc = fabricRef.current;
    if (!fc) return;
    fc.backgroundColor = color;
    fc.requestRenderAll();
  }

  // ── 文字颜色 ─────────────────────────────────────────────────
  function applyTextColor(color: string) {
    setSelectedTextColor(color);
    const fc = fabricRef.current;
    if (!fc) return;
    const obj = fc.getActiveObject();
    if (obj instanceof IText) {
      obj.set('fill', color);
      fc.requestRenderAll();
    }
  }

  // ── 粗体 ─────────────────────────────────────────────────────
  function toggleBold() {
    const fc = fabricRef.current;
    if (!fc) return;
    const obj = fc.getActiveObject();
    if (obj instanceof IText) {
      const next = obj.fontWeight === 'bold' ? 'normal' : 'bold';
      obj.set('fontWeight', next);
      setIsBold(next === 'bold');
      fc.requestRenderAll();
    }
  }

  // ── 斜体 ─────────────────────────────────────────────────────
  function toggleItalic() {
    const fc = fabricRef.current;
    if (!fc) return;
    const obj = fc.getActiveObject();
    if (obj instanceof IText) {
      const next = obj.fontStyle === 'italic' ? 'normal' : 'italic';
      obj.set('fontStyle', next);
      setIsItalic(next === 'italic');
      fc.requestRenderAll();
    }
  }

  // ── 将某套文案一键替换到画布 ─────────────────────────────────
  function applyCopyToCanvas(copy: GeneratedCopy, index: number) {
    const fc = fabricRef.current;
    if (!fc) return;

    const objects = fc.getObjects();
    for (const obj of objects) {
      if (!(obj instanceof IText)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const key = ((obj as any).data as { key?: string } | undefined)?.key;
      if (!key) continue;

      switch (key) {
        case TEXT_KEYS.MAIN_TITLE:
          obj.set('text', copy.main_title || copy.main_title_en);
          break;
        case TEXT_KEYS.SUB_TITLE:
          obj.set('text', copy.sub_title_en || copy.sub_title);
          break;
        case TEXT_KEYS.DESCRIPTION:
          obj.set('text', copy.description);
          break;
        case 'description_en':
          obj.set('text', copy.description_en);
          break;
        case TEXT_KEYS.PRICE:
          obj.set('text', copy.price || '');
          break;
      }
    }

    fc.requestRenderAll();
    setAppliedIndex(index);
  }

  // ── 调用 AI 生成文案 ─────────────────────────────────────────
  async function handleGenerateCopy() {
    if (!dishInfo) return;
    setIsGeneratingCopy(true);
    setCopyError(null);
    setAppliedIndex(null);

    try {
      const res = await fetch('/api/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishInfo }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '生成失败');
      setCopySets(json.data.copySets);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setIsGeneratingCopy(false);
    }
  }

  // ── 导出 PNG ─────────────────────────────────────────────────
  async function handleExport() {
    const fc = fabricRef.current;
    if (!fc) return;
    setIsExporting(true);
    try {
      const currentZoom = fc.getZoom();
      fc.setZoom(1);
      fc.setDimensions({ width: POSTER_W, height: POSTER_H });

      const dataUrl = fc.toDataURL({ format: 'png', quality: 1, multiplier: 1 });

      fc.setZoom(currentZoom);
      fc.setDimensions({ width: POSTER_W * canvasScale, height: POSTER_H * canvasScale });
      fc.requestRenderAll();

      const blob = await (await fetch(dataUrl)).blob();
      saveAs(blob, `posterchef_${Date.now()}.png`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      {/* 标题 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-1">编辑海报</h2>
        <p className="text-neutral-400 text-sm">AI 文案生成 · 拖拽编辑 · 一键导出</p>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">

        {/* ── 左侧：设计工具栏 ─────────────────────────────────── */}
        <div className="xl:w-56 w-full flex xl:flex-col flex-row flex-wrap gap-3 shrink-0">

          {/* 背景颜色 */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-700 p-4 flex-1 xl:flex-none">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-white">背景颜色</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {BG_PRESETS.map((c) => (
                <button
                  key={c}
                  title={c}
                  onClick={() => applyBgColor(c)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                    bgColor === c ? 'border-orange-500 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-neutral-500">自定义</span>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => applyBgColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
              />
            </div>
          </div>

          {/* 文字工具 */}
          <div className={`bg-neutral-900 rounded-2xl border p-4 flex-1 xl:flex-none transition-colors ${
            isTextActive ? 'border-orange-500/50' : 'border-neutral-700 opacity-60'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Type className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-white">文字样式</span>
              {!isTextActive && (
                <span className="text-xs text-neutral-600 whitespace-nowrap">双击激活</span>
              )}
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={toggleBold}
                disabled={!isTextActive}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isBold && isTextActive
                    ? 'bg-orange-500 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-40'
                }`}
              >
                <Bold className="w-3 h-3" />粗体
              </button>
              <button
                onClick={toggleItalic}
                disabled={!isTextActive}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isItalic && isTextActive
                    ? 'bg-orange-500 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-40'
                }`}
              >
                <Italic className="w-3 h-3" />斜体
              </button>
            </div>

            <p className="text-xs text-neutral-500 mb-1.5">文字颜色</p>
            <div className="grid grid-cols-4 gap-1.5">
              {TEXT_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  title={c}
                  disabled={!isTextActive}
                  onClick={() => applyTextColor(c)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 disabled:opacity-40 ${
                    selectedTextColor === c && isTextActive ? 'border-orange-500 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-neutral-500">自定义</span>
              <input
                type="color"
                value={selectedTextColor}
                disabled={!isTextActive}
                onChange={(e) => applyTextColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent disabled:opacity-40"
              />
            </div>
          </div>

          {/* 操作提示 */}
          <div className="bg-neutral-900/50 rounded-2xl border border-neutral-800 p-4 flex-1 xl:flex-none">
            <p className="text-xs text-neutral-500 font-medium mb-2">操作说明</p>
            <ul className="text-xs text-neutral-600 space-y-1">
              <li>• 拖拽元素可移动位置</li>
              <li>• 拖拽角点可缩放大小</li>
              <li>• 双击文字可编辑内容</li>
              <li>• 选中文字后调整颜色</li>
            </ul>
          </div>
        </div>

        {/* ── 中间：画布 ─────────────────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 flex flex-col items-center gap-3"
          style={{ minWidth: 0 }}
        >
          <div
            className="rounded-2xl overflow-hidden shadow-2xl border border-neutral-700"
            style={{ width: POSTER_W * canvasScale, height: POSTER_H * canvasScale }}
          >
            <canvas ref={canvasElRef} />
          </div>
          <p className="text-xs text-neutral-600">
            逻辑尺寸 {POSTER_W}×{POSTER_H}px · 导出为原始分辨率 PNG
          </p>
        </div>

        {/* ── 右侧：AI 文案面板 ─────────────────────────────────── */}
        <div className="xl:w-72 w-full flex flex-col gap-3 shrink-0">

          {/* 生成按钮 */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-white">AI 营销文案</span>
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              基于识别出的菜品信息，一键生成 3 套中英双语营销文案，点击即可应用到画布。
            </p>
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium"
              onClick={handleGenerateCopy}
              disabled={!dishInfo || isGeneratingCopy}
            >
              {isGeneratingCopy ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  AI 生成中…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {copySets.length > 0 ? '重新生成' : '生成文案'}
                </span>
              )}
            </Button>
          </div>

          {/* Loading 骨架屏 */}
          {isGeneratingCopy && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-neutral-900 rounded-2xl border border-neutral-800 p-4 animate-pulse">
                  <div className="h-3 w-16 bg-neutral-700 rounded mb-3" />
                  <div className="h-5 w-3/4 bg-neutral-800 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-neutral-800 rounded mb-2" />
                  <div className="h-3 w-full bg-neutral-800 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* 错误提示 */}
          {copyError && !isGeneratingCopy && (
            <div className="bg-red-950/30 border border-red-800 rounded-2xl p-4 text-sm text-red-300">
              {copyError}
            </div>
          )}

          {/* 文案列表 */}
          {!isGeneratingCopy && copySets.length > 0 && (
            <div className="flex flex-col gap-3">
              {copySets.map((copy, i) => {
                const isApplied = appliedIndex === i;
                return (
                  <div
                    key={i}
                    className={`bg-neutral-900 rounded-2xl border p-4 transition-all cursor-pointer hover:border-orange-500/60 ${
                      isApplied ? 'border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.2)]' : 'border-neutral-700'
                    }`}
                    onClick={() => applyCopyToCanvas(copy, i)}
                  >
                    {/* 风格标签 */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STYLE_BADGE[copy.style] ?? 'bg-neutral-700 text-neutral-300 border-neutral-600'}`}>
                        {copy.style_label}
                      </span>
                      {isApplied && (
                        <span className="flex items-center gap-1 text-xs text-orange-400">
                          <CheckCircle className="w-3 h-3" />已应用
                        </span>
                      )}
                    </div>

                    {/* 主标题 */}
                    <p className="text-white font-bold text-base leading-tight mb-0.5">
                      {copy.main_title}
                    </p>
                    <p className="text-neutral-400 text-xs italic mb-2">
                      {copy.main_title_en}
                    </p>

                    {/* 副标题 */}
                    <p className="text-neutral-300 text-sm mb-0.5">{copy.sub_title}</p>
                    <p className="text-neutral-500 text-xs mb-2">{copy.sub_title_en}</p>

                    {/* 描述 */}
                    <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                      {copy.description}
                    </p>

                    {/* 底部信息行 */}
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      {copy.price && (
                        <span className="text-orange-400 text-sm font-bold">{copy.price}</span>
                      )}
                      {copy.promo_tag && (
                        <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">
                          {copy.promo_tag}
                        </span>
                      )}
                      {copy.spice_level && (
                        <span className="text-xs text-neutral-500">{copy.spice_level}</span>
                      )}
                    </div>

                    {/* 应用提示 */}
                    {!isApplied && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-neutral-600">
                        <ChevronRight className="w-3 h-3" />
                        点击应用到画布
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 底部按钮 ─────────────────────────────────────────────── */}
      <div className="flex gap-3 mt-2">
        <Button
          variant="outline"
          className="border-neutral-700 text-neutral-400 hover:text-white"
          onClick={prevStep}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          上一步
        </Button>

        <Button
          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-base py-3 font-semibold"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              正在导出…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              下载海报 PNG
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
