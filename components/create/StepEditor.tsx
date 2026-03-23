'use client';

import { useRef, useState, useCallback } from 'react';
import {
  ChevronLeft, Download,
  PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import PosterCanvas, { type PosterCanvasHandle } from '@/components/editor/PosterCanvas';
import PropertyPanel from '@/components/editor/PropertyPanel';
import LayerPanel from '@/components/editor/LayerPanel';
import { usePosterStore } from '@/lib/store/posterStore';
import { CANVAS_WIDTH, CANVAS_HEIGHT, STYLE_TEMPLATES } from '@/lib/constants';
import type { LanguageMode } from '@/lib/templates/layoutEngine';

const DEFAULT_BG = { brightness: 0, blur: 0, warmth: 0 };

export default function StepEditor() {
  const {
    processedImage,
    removedBgImage,
    enhancedImage,
    selectedBackground,
    selectedStyle,
    selectedCopy,
    dishInfo,
    prevStep,
    setStep,
  } = usePosterStore();

  const canvasRef = useRef<PosterCanvasHandle>(null);

  const [leftOpen,    setLeftOpen]    = useState(true);
  const [rightOpen,   setRightOpen]   = useState(true);
  const [bgParams,    setBgParams]    = useState(DEFAULT_BG);
  const [isExporting, setIsExporting] = useState(false);
  const [langMode,    setLangMode]    = useState<LanguageMode>('bilingual');

  const dishUrl       = processedImage || removedBgImage || enhancedImage || null;
  const backgroundUrl = selectedBackground?.url ?? null;
  const styleTemplate = STYLE_TEMPLATES.find((s) => s.id === selectedStyle) ?? null;

  async function handleExport() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsExporting(true);
    try {
      const dataUrl = canvas.exportPng();
      const blob    = await (await fetch(dataUrl)).blob();
      saveAs(blob, `posterchef_${Date.now()}.png`);
    } finally {
      setIsExporting(false);
    }
  }

  // 共享给左右面板的 canvas 访问器
  const getCanvas = useCallback(
    () => canvasRef.current?.getCanvas() ?? null,
    [],
  );

  const handleRelayout         = useCallback(() => { canvasRef.current?.refreshTextLayer(); }, []);
  const handleChangeBackground = useCallback(() => { setStep(4 as any); }, [setStep]);
  const handleEditCopy         = useCallback(() => { setStep(5 as any); }, [setStep]);

  return (
    <div className="flex flex-col h-full w-full" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── 顶部工具栏 ──────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-2 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="icon"
            className="text-neutral-400 hover:text-white w-8 h-8"
            title={leftOpen ? '折叠左侧面板' : '展开左侧面板'}
            onClick={() => setLeftOpen((v) => !v)}
          >
            {leftOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost" size="sm"
            className="text-neutral-400 hover:text-white gap-1.5"
            onClick={prevStep}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs">上一步</span>
          </Button>
        </div>

        <div className="flex-1 text-center">
          <span className="text-sm font-semibold text-white">海报编辑器</span>
          {dishInfo?.name && (
            <span className="text-xs text-neutral-500 ml-2">— {dishInfo.name}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 语言模式快速切换 */}
          <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-0.5">
            {(
              [
                { id: 'bilingual', label: '双语' },
                { id: 'cn_only',  label: '中文' },
                { id: 'en_only',  label: 'EN'   },
              ] as { id: LanguageMode; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setLangMode(id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  langMode === id
                    ? 'bg-orange-500 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white h-8 px-4 text-xs font-semibold gap-1.5"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? '导出中…' : '下载 PNG'}
          </Button>

          <Button
            variant="ghost" size="icon"
            className="text-neutral-400 hover:text-white w-8 h-8"
            title={rightOpen ? '折叠右侧面板' : '展开右侧面板'}
            onClick={() => setRightOpen((v) => !v)}
          >
            {rightOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* ── 主体三栏 ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* 左侧面板：图层 + 装饰素材 */}
        <aside
          className="shrink-0 flex flex-col bg-neutral-900 border-r border-neutral-800 transition-all duration-200"
          style={{ width: leftOpen ? 260 : 0, opacity: leftOpen ? 1 : 0, overflow: leftOpen ? 'visible' : 'hidden' }}
        >
          <div className="min-w-[260px] h-full flex flex-col overflow-hidden">
            <LayerPanel getCanvas={getCanvas} />
          </div>
        </aside>

        {/* 中间：画布 */}
        <PosterCanvas
          ref={canvasRef}
          posterWidth={CANVAS_WIDTH}
          posterHeight={CANVAS_HEIGHT}
          backgroundUrl={backgroundUrl}
          dishUrl={dishUrl}
          brightness={bgParams.brightness}
          blur={bgParams.blur}
          warmth={bgParams.warmth}
          style={styleTemplate}
          copy={selectedCopy}
          languageMode={langMode}
        />

        {/* 右侧面板：属性 + 背景调节 */}
        <aside
          className="shrink-0 flex flex-col bg-neutral-900 border-l border-neutral-800 transition-all duration-200"
          style={{ width: rightOpen ? 300 : 0, opacity: rightOpen ? 1 : 0, overflow: rightOpen ? 'auto' : 'hidden' }}
        >
          <div className="min-w-[300px]">
            {/* 背景调节 */}
            <div className="px-4 pt-4 pb-2 border-b border-neutral-800">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-3">
                背景调节
              </p>
              <div className="flex flex-col gap-3">
                <SliderControl
                  label="亮度" labelEn="Brightness"
                  value={bgParams.brightness} min={-1} max={1} step={0.05}
                  onChange={(v) => setBgParams((p) => ({ ...p, brightness: v }))}
                  format={(v) => (v >= 0 ? `+${Math.round(v * 100)}` : `${Math.round(v * 100)}`)}
                />
                <SliderControl
                  label="模糊" labelEn="Blur"
                  value={bgParams.blur} min={0} max={20} step={1}
                  onChange={(v) => setBgParams((p) => ({ ...p, blur: v }))}
                  format={(v) => `${v}px`}
                />
                <SliderControl
                  label="暖色调" labelEn="Warmth"
                  value={bgParams.warmth} min={-1} max={1} step={0.05}
                  onChange={(v) => setBgParams((p) => ({ ...p, warmth: v }))}
                  format={(v) => (v >= 0 ? `+${Math.round(v * 100)}` : `${Math.round(v * 100)}`)}
                />
                <button
                  className="text-xs text-neutral-600 hover:text-neutral-400 self-start transition-colors"
                  onClick={() => setBgParams(DEFAULT_BG)}
                >
                  重置
                </button>
              </div>
            </div>

            {/* 属性面板 */}
            <PropertyPanel
              getCanvas={getCanvas}
              onRelayout={handleRelayout}
              onChangeBackground={handleChangeBackground}
              onEditCopy={handleEditCopy}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── 子控件 ────────────────────────────────────────────────────────

function SliderControl({ label, labelEn, value, min, max, step, onChange, format }: {
  label: string; labelEn: string; value: number;
  min: number; max: number; step: number;
  onChange: (v: number) => void; format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-xs font-medium text-white">{label}</span>
          <span className="text-[10px] text-neutral-600 ml-1">{labelEn}</span>
        </div>
        <span className="text-xs text-orange-400 tabular-nums font-medium">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-neutral-700 accent-orange-500 cursor-pointer"
      />
    </div>
  );
}
