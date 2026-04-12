'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { IText, Textbox } from 'fabric';
import {
  Download, ChevronLeft, Type, Bold, Italic,
  Sparkles, RefreshCw, CheckCircle, Wand2, ImageIcon,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { usePosterStore, type PosterStyleId } from '@/lib/store/posterStore';
import { toast } from '@/lib/toast';
import type { CopySet, PosterData } from '@/lib/types';
import { STYLE_TEMPLATES } from '@/lib/constants';
import PosterCanvas, { type PosterCanvasHandle } from '@/components/editor/PosterCanvas';
import ContentSelectionStation, {
  initialStationStateFromPoster,
  type ContentStationState,
} from '@/components/ContentSelectionStation';
import {
  computeSyncedVisualPrompt,
  buildPosterExportFilename,
} from '@/lib/poster/syncVisualPrompt';

/** Fabric 导出倍率（逻辑分辨率 × 此值 = PNG 像素） */
const EXPORT_PNG_MULTIPLIER = 2;

const DEFAULT_LAYOUT = { w: 720, h: 1280 }; // 9:16 社交

/** US Letter：高/宽 ≈ 11/8.5 ≈ 1.294 */
function canvasLayoutForScene(scene: ContentStationState['activeScene'] | undefined) {
  if (scene === 'offline') {
    const w = 850;
    return { w, h: Math.round((w * 11) / 8.5) };
  }
  return { w: DEFAULT_LAYOUT.w, h: DEFAULT_LAYOUT.h };
}

const TEXT_COLOR_PRESETS = [
  '#ffffff', '#fbbf24', '#f87171', '#34d399',
  '#60a5fa', '#c084fc', '#1a1a1a', '#f5e6c8',
];

const DEFAULT_STYLE_TEMPLATE = STYLE_TEMPLATES[0]!;

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

  const posterCanvasRef = useRef<PosterCanvasHandle>(null);

  const [selectedTextColor, setSelectedTextColor] = useState('#ffffff');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isTextActive, setIsTextActive] = useState(false);

  const [posterData, setPosterData] = useState<PosterData | null>(null);
  const [stationState, setStationState] = useState<ContentStationState | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRenderingBg, setIsRenderingBg] = useState(false);

  const layoutSize = useMemo(
    () => canvasLayoutForScene(stationState?.activeScene),
    [stationState?.activeScene],
  );
  const layoutW = layoutSize.w;
  const layoutH = layoutSize.h;

  const stationPreview = useMemo(() => {
    if (!posterData || !stationState) return null;
    return { state: stationState, textColor: selectedTextColor };
  }, [posterData, stationState, selectedTextColor]);

  const placeholderCopy = useMemo((): CopySet | null => {
    if (posterData) return null;
    if (!dishInfo) return null;
    return {
      id: 'placeholder',
      style: 'professional',
      headline: dishInfo.name,
      headlineEn: dishInfo.nameEn,
      subheadline: '',
      subheadlineEn: '',
      tagline: dishInfo.description,
      taglineEn: dishInfo.descriptionEn,
    };
  }, [posterData, dishInfo]);

  const backgroundUrl = generatedPosterImage
    ? `data:image/png;base64,${generatedPosterImage}`
    : null;

  const visualPromptForRender = useMemo(
    () => computeSyncedVisualPrompt(posterData, stationState),
    [posterData, stationState],
  );

  const exportSceneLabel = useMemo((): 'Social' | 'Print' | 'Clean' | 'DIY' => {
    const s = stationState?.activeScene;
    if (s === 'offline') return 'Print';
    if (s === 'clean') return 'Clean';
    if (s === 'diy') return 'DIY';
    return 'Social';
  }, [stationState?.activeScene]);

  const exportDishLabel = useMemo(() => {
    const en =
      stationState?.labels.main_title.en.trim() ||
      posterData?.name_en ||
      dishInfo?.nameEn ||
      '';
    const cn =
      stationState?.labels.main_title.cn.trim() ||
      posterData?.name_cn ||
      dishInfo?.name ||
      '';
    return en || cn || 'Poster';
  }, [stationState, posterData, dishInfo]);

  function syncToolbarFromCanvas() {
    const obj = posterCanvasRef.current?.getCanvas()?.getActiveObject();
    if (obj instanceof IText || obj instanceof Textbox) {
      setIsTextActive(true);
      const fill = obj.fill;
      if (typeof fill === 'string') setSelectedTextColor(fill);
      setIsBold(obj.fontWeight === 'bold');
      setIsItalic(obj.fontStyle === 'italic');
    } else {
      setIsTextActive(false);
    }
  }

  useEffect(() => {
    const fc = posterCanvasRef.current?.getCanvas();
    if (!fc) return;
    const onSel = () => syncToolbarFromCanvas();
    const onClear = () => setIsTextActive(false);
    fc.on('selection:created', onSel);
    fc.on('selection:updated', onSel);
    fc.on('selection:cleared', onClear);
    return () => {
      fc.off('selection:created', onSel);
      fc.off('selection:updated', onSel);
      fc.off('selection:cleared', onClear);
    };
  }, [layoutW, layoutH, stationPreview, backgroundUrl, posterData]);

  function applyTextColor(color: string) {
    setSelectedTextColor(color);
    const fc = posterCanvasRef.current?.getCanvas();
    const obj = fc?.getActiveObject();
    if (obj instanceof IText || obj instanceof Textbox) {
      obj.set('fill', color);
      fc?.requestRenderAll();
    }
  }

  function toggleBold() {
    const fc = posterCanvasRef.current?.getCanvas();
    const obj = fc?.getActiveObject();
    if (obj instanceof IText || obj instanceof Textbox) {
      const next = obj.fontWeight === 'bold' ? 'normal' : 'bold';
      obj.set('fontWeight', next);
      setIsBold(next === 'bold');
      fc?.requestRenderAll();
    }
  }

  function toggleItalic() {
    const fc = posterCanvasRef.current?.getCanvas();
    const obj = fc?.getActiveObject();
    if (obj instanceof IText || obj instanceof Textbox) {
      const next = obj.fontStyle === 'italic' ? 'normal' : 'italic';
      obj.set('fontStyle', next);
      setIsItalic(next === 'italic');
      fc?.requestRenderAll();
    }
  }

  /** Step 3a：仅识图 + 双场景文案（不调用 DALL·E） */
  async function handleAnalyze() {
    if (!originalImage || !selectedPosterStyle) return;
    setIsAnalyzing(true);
    setGenerateError(null);
    try {
      const match = originalImage.match(/^data:([^;]+);base64,(.+)$/);
      const mimeType = match?.[1] ?? 'image/jpeg';
      const imageBase64 = match?.[2] ?? originalImage;
      const res = await fetch('/api/generate-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          styleId: selectedPosterStyle,
          phase: 'analyze',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '识图失败');
      const { dishInfo: newDishInfo, posterData: newPosterData, textColor } = json.data;
      if (newDishInfo) setDishInfo(newDishInfo);
      if (newPosterData) {
        setPosterData(newPosterData);
        setStationState(initialStationStateFromPoster(newPosterData));
      }
      if (typeof textColor === 'string' && textColor) setSelectedTextColor(textColor);
      setGeneratedPosterImage(null);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : '识图失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  }

  /** Step 3b：用户确认分拣站后，仅生成 DALL·E 3 背景底图（使用视觉摘要同步后的提示） */
  async function handleRenderBackground() {
    const vp = visualPromptForRender.trim();
    if (!vp || !selectedPosterStyle) return;
    setIsRenderingBg(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/generate-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'render',
          visualPrompt: vp,
          styleId: selectedPosterStyle,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '生成背景失败');
      const { posterImageBase64, textColor } = json.data;
      if (posterImageBase64) setGeneratedPosterImage(posterImageBase64);
      if (typeof textColor === 'string' && textColor) setSelectedTextColor(textColor);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : '生成背景失败，请重试');
    } finally {
      setIsRenderingBg(false);
    }
  }

  /** 一步完成：识图 + 文案 + 生图（兼容旧习惯） */
  async function handleFullGenerate() {
    if (!originalImage || !selectedPosterStyle) return;
    setIsGeneratingPoster(true);
    setGenerateError(null);
    try {
      const match = originalImage.match(/^data:([^;]+);base64,(.+)$/);
      const mimeType = match?.[1] ?? 'image/jpeg';
      const imageBase64 = match?.[2] ?? originalImage;
      const res = await fetch('/api/generate-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType, styleId: selectedPosterStyle, phase: 'full' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '生成失败');
      const {
        posterImageBase64,
        usedFallback,
        dishInfo: newDishInfo,
        posterData: newPosterData,
        textColor,
      } = json.data;
      if (usedFallback) toast.warn('API限流，已为您加载演示海报效果');
      if (newDishInfo) setDishInfo(newDishInfo);
      if (newPosterData) {
        setPosterData(newPosterData);
        setStationState(initialStationStateFromPoster(newPosterData));
      }
      if (typeof textColor === 'string' && textColor) setSelectedTextColor(textColor);
      if (posterImageBase64) setGeneratedPosterImage(posterImageBase64);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setIsGeneratingPoster(false);
    }
  }

  async function handleExport() {
    const dataUrl = posterCanvasRef.current?.exportPng(EXPORT_PNG_MULTIPLIER);
    if (!dataUrl) return;
    setIsExporting(true);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const filename = buildPosterExportFilename({
        dishLabel: exportDishLabel,
        sceneLabel: exportSceneLabel,
        brand: 'PosterChef',
      });
      saveAs(blob, filename);
    } finally {
      setIsExporting(false);
    }
  }

  const stepBusy = isAnalyzing || isRenderingBg || isGeneratingPoster;
  const canAnalyze = !!originalImage && !!selectedPosterStyle && !stepBusy;
  const canRenderBg = !!visualPromptForRender.trim() && !!selectedPosterStyle && !stepBusy;
  const canDownloadPoster = !!posterData && !isExporting;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      {/* 标题 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-1">AI 海报生成</h2>
        <p className="text-neutral-400 text-sm">识图与分拣站 · 生成预览底图 · 拖拽编辑 · 导出</p>
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

          <Button
            className="w-full bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-semibold py-4 rounded-2xl shadow-lg disabled:opacity-50"
            onClick={handleAnalyze}
            disabled={!canAnalyze}
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                识图与文案…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI 识图与双场景文案
              </span>
            )}
          </Button>

          <Button
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold py-4 rounded-2xl shadow-lg disabled:opacity-50"
            onClick={handleRenderBackground}
            disabled={!canRenderBg}
          >
            {isRenderingBg ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                DALL·E 生成中…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                生成预览底图
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full border-neutral-600 text-neutral-300 hover:bg-neutral-800 py-3 rounded-xl text-sm"
            onClick={handleFullGenerate}
            disabled={!canAnalyze}
          >
            {isGeneratingPoster ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                全流程生成中…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Wand2 className="w-4 h-4" />
                一键全流程（识图+生图）
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
              <li>• 右侧分拣站实时驱动预览</li>
            </ul>
          </div>
        </div>

        {/* ── 中间：PosterCanvas（与分拣站联动）──────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3" style={{ minWidth: 0 }}>
          <div className="relative min-h-[520px] rounded-2xl border border-neutral-700 overflow-hidden bg-neutral-900">
            <PosterCanvas
              ref={posterCanvasRef}
              posterWidth={layoutW}
              posterHeight={layoutH}
              backgroundUrl={backgroundUrl}
              dishUrl={originalImage}
              style={stationPreview ? null : DEFAULT_STYLE_TEMPLATE}
              copy={stationPreview ? null : (placeholderCopy ?? selectedCopy)}
              stationPreview={stationPreview}
            />
            {stepBusy && (
              <div className="absolute inset-0 z-10 bg-black/65 flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-full border-4 border-orange-500/30 border-t-orange-500 animate-spin" />
                <p className="text-white font-medium text-sm px-4 text-center">
                  {isAnalyzing && '正在识图并生成分拣站文案…'}
                  {isRenderingBg && '正在调用 DALL·E 3 生成背景…'}
                  {isGeneratingPoster && '正在执行全流程生成…'}
                </p>
              </div>
            )}
          </div>

          {generateError && (
            <div className="bg-red-950/30 border border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-300 w-full max-w-md text-center mx-auto">
              {generateError}
            </div>
          )}

          <p className="text-xs text-neutral-600 text-center">
            逻辑尺寸 {layoutW}×{layoutH}px
            {stationState?.activeScene === 'offline' ? '（US Letter 比例）' : '（社交 9:16）'}
            {' · '}下载海报为 PNG（×{EXPORT_PNG_MULTIPLIER} 高清导出）
          </p>
          {posterData && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-left">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">
                生图视觉摘要（随分拣站主副标题自动同步）
              </p>
              <p className="text-[11px] text-neutral-400 font-mono leading-snug break-words max-h-20 overflow-y-auto">
                {visualPromptForRender}
              </p>
            </div>
          )}
        </div>

        {/* ── 右侧：内容分拣站 ───────────────────────────────────────────── */}
        <div className="xl:w-80 w-full flex flex-col gap-3 shrink-0 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
          {stepBusy && (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-neutral-900 rounded-2xl border border-neutral-800 p-4 animate-pulse">
                  <div className="h-3 w-24 bg-neutral-700 rounded mb-3" />
                  <div className="h-16 w-full bg-neutral-800 rounded mb-2" />
                  <div className="h-12 w-full bg-neutral-800 rounded" />
                </div>
              ))}
            </div>
          )}
          <ContentSelectionStation
            posterData={posterData}
            disabled={stepBusy}
            onChange={setStationState}
          />
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
          disabled={!canDownloadPoster}
        >
          {isExporting ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              正在导出…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              下载海报
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
