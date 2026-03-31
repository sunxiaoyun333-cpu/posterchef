'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, FabricImage, IText, Rect } from 'fabric';
import {
  Download, ChevronLeft, Type, Bold, Italic,
  Sparkles, RefreshCw, CheckCircle, ChevronRight, Wand2,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { usePosterStore, type PosterStyleId } from '@/lib/store/posterStore';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';
import { toast } from '@/lib/toast';
import type { GeneratedCopyV2 } from '@/lib/types';

const POSTER_W = CANVAS_WIDTH;   // 800
const POSTER_H = CANVAS_HEIGHT;  // 1000

const TEXT_KEYS = {
  MAIN_TITLE:  'main_title',
  SUB_TITLE:   'sub_title',
  DESCRIPTION: 'description',
  PRICE:       'price',
};

const TEXT_COLOR_PRESETS = [
  '#ffffff', '#fbbf24', '#f87171', '#34d399',
  '#60a5fa', '#c084fc', '#1a1a1a', '#f5e6c8',
];

const STYLE_BADGE: Record<string, string> = {
  formal: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  casual: 'bg-green-500/20 text-green-300 border-green-500/30',
  promo:  'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

// ── 6 种海报风格卡片定义 ───────────────────────────────────────────────────
interface PosterStyle {
  id: PosterStyleId;
  label: string;
  labelCn: string;
  desc: string;
  bgClass: string;
  accentColor: string;
}

const POSTER_STYLES: PosterStyle[] = [
  {
    id: 'modern-minimalist',
    label: 'Modern Minimalist',
    labelCn: '现代极简白',
    desc: '大面积留白，干净高级',
    bgClass: 'bg-white',
    accentColor: '#1a1a1a',
  },
  {
    id: 'rustic-farmhouse',
    label: 'Rustic Farmhouse',
    labelCn: '农场木质风',
    desc: '深色木纹，温暖舒适',
    bgClass: 'bg-amber-900',
    accentColor: '#fff8e7',
  },
  {
    id: 'elegant-fine-dining',
    label: 'Elegant Fine Dining',
    labelCn: '高端优雅黑',
    desc: '暗色调，戏剧性光影',
    bgClass: 'bg-neutral-900',
    accentColor: '#f5e6c8',
  },
  {
    id: 'bright-cafe',
    label: 'Bright & Fresh Cafe',
    labelCn: '清新明亮风',
    desc: '自然光，大理石浅木纹',
    bgClass: 'bg-stone-100',
    accentColor: '#2d2d2d',
  },
  {
    id: 'vintage-chalkboard',
    label: 'Vintage Bistro Chalkboard',
    labelCn: '复古小酒馆',
    desc: '黑板背景，粉笔元素',
    bgClass: 'bg-emerald-950',
    accentColor: '#f0ead6',
  },
  {
    id: 'bold-pop',
    label: 'Bold Fast Casual Pop',
    labelCn: '活力波普风',
    desc: '高饱和度撞色，活力四射',
    bgClass: 'bg-gradient-to-br from-red-500 to-yellow-400',
    accentColor: '#ffffff',
  },
];

export default function StepGenerate() {
  const {
    originalImage,
    dishInfo,
    selectedCopy,
    prevStep,
    selectedPosterStyle,
    setSelectedPosterStyle,
    generatedPosterImage,
    setGeneratedPosterImage,
    isGeneratingPoster,
    setIsGeneratingPoster,
    setDishInfo,
  } = usePosterStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef  = useRef<HTMLCanvasElement>(null);
  const fabricRef    = useRef<Canvas | null>(null);

  const [canvasScale,       setCanvasScale]       = useState(1);
  const [selectedTextColor, setSelectedTextColor] = useState('#ffffff');
  const [isBold,            setIsBold]            = useState(false);
  const [isItalic,          setIsItalic]          = useState(false);
  const [isExporting,       setIsExporting]       = useState(false);
  const [isTextActive,      setIsTextActive]      = useState(false);

  // 文案面板
  const [copySets,      setCopySets]      = useState<GeneratedCopyV2[]>([]);
  const [appliedIndex,  setAppliedIndex]  = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // ── 计算响应式缩放 ──────────────────────────────────────────────────────
  const calcScale = useCallback(() => {
    if (!containerRef.current) return 1;
    const available = containerRef.current.clientWidth - 32;
    return Math.min(1, available / POSTER_W);
  }, []);

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

  // ── 将 AI 生成的海报底图设为 Canvas 背景 ────────────────────────────────
  async function applyPosterBackground(fc: Canvas, base64: string) {
    try {
      const dataUrl = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
      const img = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
      const scaleX = POSTER_W / (img.width ?? POSTER_W);
      const scaleY = POSTER_H / (img.height ?? POSTER_H);
      img.set({
        left: 0, top: 0,
        scaleX, scaleY,
        selectable: false, evented: false,
        data: { key: 'poster_bg' },
      });
      fc.getObjects().forEach((o) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (((o as any).data as { key?: string } | undefined)?.key === 'poster_bg') fc.remove(o);
      });
      fc.insertAt(0, img);
      fc.backgroundColor = 'transparent';
      fc.requestRenderAll();
    } catch {
      // 加载失败时保持纯色背景
    }
  }

  // ── 文字层布局 ────────────────────────────────────────────────────────
  async function buildTextLayout(fc: Canvas, textColor = '#ffffff') {
    const headlineCn = selectedCopy?.headline  ?? dishInfo?.name          ?? '菜品名称';
    const headlineEn = selectedCopy?.headlineEn ?? dishInfo?.nameEn       ?? 'Dish Name';
    const tagline    = selectedCopy?.tagline    ?? dishInfo?.description   ?? '';
    const taglineEn  = selectedCopy?.taglineEn  ?? dishInfo?.descriptionEn ?? '';

    // 移除旧文字层（保留背景图）
    fc.getObjects().forEach((o) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const key = ((o as any).data as { key?: string } | undefined)?.key;
      if (key && key !== 'poster_bg') fc.remove(o);
    });

    const alpha = (hex: string, a: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    };

    fc.add(new Rect({
      left: 0, top: POSTER_H * 0.62,
      width: POSTER_W, height: POSTER_H * 0.38,
      fill: 'rgba(0,0,0,0.45)',
      selectable: false, evented: false,
      data: { key: 'text_overlay' },
    }));

    fc.add(new Rect({
      left: POSTER_W / 2, top: POSTER_H * 0.71,
      originX: 'center', originY: 'center',
      width: POSTER_W * 0.4, height: 1,
      fill: alpha(textColor, 0.4),
      selectable: false, evented: false,
      data: { key: 'divider' },
    }));

    fc.add(new IText(headlineCn, {
      left: POSTER_W / 2, top: POSTER_H * 0.76,
      originX: 'center', originY: 'center',
      fontSize: 52, fontWeight: 'bold',
      fill: textColor, fontFamily: 'Georgia, serif',
      textAlign: 'center', data: { key: TEXT_KEYS.MAIN_TITLE },
    }));

    fc.add(new IText(headlineEn, {
      left: POSTER_W / 2, top: POSTER_H * 0.84,
      originX: 'center', originY: 'center',
      fontSize: 26, fill: alpha(textColor, 0.8),
      fontFamily: 'Arial, sans-serif', fontStyle: 'italic',
      textAlign: 'center', data: { key: TEXT_KEYS.SUB_TITLE },
    }));

    if (tagline) {
      fc.add(new IText(tagline, {
        left: POSTER_W / 2, top: POSTER_H * 0.90,
        originX: 'center', originY: 'center',
        fontSize: 18, fill: alpha(textColor, 0.65),
        fontFamily: 'Arial, sans-serif', textAlign: 'center',
        data: { key: TEXT_KEYS.DESCRIPTION },
      }));
    }

    if (taglineEn) {
      fc.add(new IText(taglineEn, {
        left: POSTER_W / 2, top: POSTER_H * (tagline ? 0.94 : 0.90),
        originX: 'center', originY: 'center',
        fontSize: 14, fill: alpha(textColor, 0.45),
        fontFamily: 'Arial, sans-serif', textAlign: 'center',
        data: { key: 'description_en' },
      }));
    }

    fc.requestRenderAll();
  }

  // ── 初始化 Fabric.js ──────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return;

    const scale = calcScale();
    setCanvasScale(scale);

    const fc = new Canvas(canvasElRef.current, {
      width: POSTER_W * scale,
      height: POSTER_H * scale,
      backgroundColor: '#1a1a2e',
      selection: true,
      preserveObjectStacking: true,
    });

    fc.setZoom(scale);
    fabricRef.current = fc;

    fc.on('selection:created', (e) => syncToolbarFromObj(e.selected?.[0]));
    fc.on('selection:updated', (e) => syncToolbarFromObj(e.selected?.[0]));
    fc.on('selection:cleared', () => setIsTextActive(false));

    if (generatedPosterImage) {
      applyPosterBackground(fc, generatedPosterImage).then(() => buildTextLayout(fc));
    } else {
      buildTextLayout(fc);
    }

    return () => {
      fc.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 响应式 resize ──────────────────────────────────────────────────────
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

  // ── 文字颜色 ───────────────────────────────────────────────────────────
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

  // ── 将文案应用到画布 ───────────────────────────────────────────────────
  function applyCopyToCanvas(copy: GeneratedCopyV2, index: number) {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.getObjects().forEach((obj) => {
      if (!(obj instanceof IText)) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const key = ((obj as any).data as { key?: string } | undefined)?.key;
      if (!key) return;
      switch (key) {
        case TEXT_KEYS.MAIN_TITLE:  obj.set('text', copy.main_title || copy.main_title_en); break;
        case TEXT_KEYS.SUB_TITLE:   obj.set('text', copy.sub_title_en || copy.sub_title); break;
        case TEXT_KEYS.DESCRIPTION: obj.set('text', copy.description); break;
        case 'description_en':      obj.set('text', copy.description_en); break;
        case TEXT_KEYS.PRICE:       obj.set('text', copy.price || ''); break;
      }
    });
    fc.requestRenderAll();
    setAppliedIndex(index);
  }

  // ── 核心：调用 generate-poster API ────────────────────────────────────
  async function handleGenerate() {
    if (!originalImage || !selectedPosterStyle) return;

    setIsGeneratingPoster(true);
    setGenerateError(null);
    setAppliedIndex(null);

    try {
      const match = originalImage.match(/^data:([^;]+);base64,(.+)$/);
      const mimeType    = match?.[1] ?? 'image/jpeg';
      const imageBase64 = match?.[2] ?? originalImage;

      const res = await fetch('/api/generate-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType, styleId: selectedPosterStyle }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '生成失败');

      const { posterImageBase64, usedFallback, dishInfo: newDishInfo, copySets: newCopySets, textColor } = json.data;

      // 如果走了兜底逻辑，弹出 Toast 提示
      if (usedFallback) {
        toast.warn('API限流，已为您加载演示海报效果');
      }

      if (newDishInfo) setDishInfo(newDishInfo);
      if (newCopySets?.length) setCopySets(newCopySets);

      const fc = fabricRef.current;
      if (fc) {
        if (posterImageBase64) {
          setGeneratedPosterImage(posterImageBase64);
          await applyPosterBackground(fc, posterImageBase64);
        }
        await buildTextLayout(fc, textColor || '#ffffff');
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setIsGeneratingPoster(false);
    }
  }

  // ── 导出 PNG ───────────────────────────────────────────────────────────
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

  const canGenerate = !!originalImage && !!selectedPosterStyle && !isGeneratingPoster;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      {/* 标题 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-1">AI 海报生成</h2>
        <p className="text-neutral-400 text-sm">选择风格 · AI 一键生图 · 拖拽编辑 · 导出</p>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">

        {/* ── 左侧：风格选择面板 ─────────────────────────────────────── */}
        <div className="xl:w-64 w-full flex xl:flex-col flex-row flex-wrap gap-3 shrink-0">

          {/* 风格卡片 */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-700 p-4 w-full">
            <p className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-400" />
              选择海报风格
            </p>
            <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
              {POSTER_STYLES.map((style) => {
                const isSelected = selectedPosterStyle === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setSelectedPosterStyle(style.id)}
                    className={`relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all hover:border-orange-500/60 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                        : 'border-neutral-700 bg-neutral-800/50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg shrink-0 ${style.bgClass} flex items-center justify-center border border-white/10`}>
                      <span className="text-xs font-bold" style={{ color: style.accentColor === '#1a1a1a' || style.accentColor === '#2d2d2d' ? '#999' : style.accentColor }}>
                        A
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white leading-tight truncate">{style.labelCn}</p>
                      <p className="text-[10px] text-neutral-500 leading-tight mt-0.5 line-clamp-1">{style.desc}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-orange-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 生成按钮 */}
          <Button
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-5 rounded-2xl shadow-lg disabled:opacity-50"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            {isGeneratingPoster ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                AI 生成中…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                {generatedPosterImage ? '重新生成' : '一键生成海报'}
              </span>
            )}
          </Button>

          {!selectedPosterStyle && (
            <p className="text-xs text-neutral-600 text-center w-full">请先选择一种风格</p>
          )}

          {/* 文字工具 */}
          <div className={`bg-neutral-900 rounded-2xl border p-4 w-full transition-colors ${
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

          {/* 操作说明 */}
          <div className="bg-neutral-900/50 rounded-2xl border border-neutral-800 p-4 w-full">
            <p className="text-xs text-neutral-500 font-medium mb-2">操作说明</p>
            <ul className="text-xs text-neutral-600 space-y-1">
              <li>• 拖拽元素可移动位置</li>
              <li>• 双击文字可编辑内容</li>
              <li>• 选中文字后调整颜色</li>
              <li>• 点击右侧文案一键应用</li>
            </ul>
          </div>
        </div>

        {/* ── 中间：Canvas 画布 ─────────────────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 flex flex-col items-center gap-3"
          style={{ minWidth: 0 }}
        >
          <div className="relative">
            <div
              className="rounded-2xl overflow-hidden shadow-2xl border border-neutral-700"
              style={{ width: POSTER_W * canvasScale, height: POSTER_H * canvasScale }}
            >
              <canvas ref={canvasElRef} />
            </div>

            {isGeneratingPoster && (
              <div className="absolute inset-0 bg-black/70 rounded-2xl flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full border-4 border-orange-500/30 border-t-orange-500 animate-spin" />
                <div className="text-center">
                  <p className="text-white font-semibold text-lg">AI 正在创作中…</p>
                  <p className="text-neutral-400 text-sm mt-1">识菜 → 生成文案 → 全景生图</p>
                </div>
              </div>
            )}
          </div>

          {generateError && (
            <div className="bg-red-950/30 border border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-300 w-full max-w-md text-center">
              {generateError}
            </div>
          )}

          <p className="text-xs text-neutral-600">
            逻辑尺寸 {POSTER_W}×{POSTER_H}px · 导出为原始分辨率 PNG
          </p>
        </div>

        {/* ── 右侧：AI 文案面板 ─────────────────────────────────────────── */}
        <div className="xl:w-72 w-full flex flex-col gap-3 shrink-0">

          <div className="bg-neutral-900 rounded-2xl border border-neutral-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-white">AI 营销文案</span>
            </div>
            <p className="text-xs text-neutral-500">
              {copySets.length > 0
                ? '点击任意一套文案，立即应用到画布'
                : '点击「一键生成海报」后，3套中英双语文案将自动出现在这里'}
            </p>
          </div>

          {/* 骨架屏 */}
          {isGeneratingPoster && (
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

          {/* 文案列表 */}
          {!isGeneratingPoster && copySets.length > 0 && (
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

                    <p className="text-white font-bold text-base leading-tight mb-0.5">
                      {copy.main_title}
                    </p>
                    <p className="text-neutral-400 text-xs italic mb-2">
                      {copy.main_title_en}
                    </p>
                    <p className="text-neutral-300 text-sm mb-0.5">{copy.sub_title}</p>
                    <p className="text-neutral-500 text-xs mb-2">{copy.sub_title_en}</p>
                    <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                      {copy.description}
                    </p>

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

      {/* ── 底部按钮 ─────────────────────────────────────────────────────── */}
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
