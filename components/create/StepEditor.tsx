'use client';

import { useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Download,
  Layers, Sliders, Type, PanelLeftClose, PanelRightClose,
  PanelLeftOpen, PanelRightOpen, Image as ImageIcon,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import PosterCanvas, { type PosterCanvasHandle } from '@/components/editor/PosterCanvas';
import { usePosterStore } from '@/lib/store/posterStore';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';

// ── 背景调节默认值 ────────────────────────────────────────────────
const DEFAULT_BG = { brightness: 0, blur: 0, warmth: 0 };

export default function StepEditor() {
  const {
    processedImage,
    removedBgImage,
    enhancedImage,
    selectedBackground,
    dishInfo,
    prevStep,
    nextStep,
  } = usePosterStore();

  const canvasRef = useRef<PosterCanvasHandle>(null);

  // 面板折叠状态
  const [leftOpen,  setLeftOpen]  = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // 背景调节参数
  const [bgParams, setBgParams] = useState(DEFAULT_BG);

  // 导出状态
  const [isExporting, setIsExporting] = useState(false);

  // 当前活跃的右侧面板 tab
  const [rightTab, setRightTab] = useState<'layers' | 'adjust' | 'text'>('adjust');

  // 图片源
  const dishUrl       = processedImage || removedBgImage || enhancedImage || null;
  const backgroundUrl = selectedBackground?.url ?? null;

  // ── 导出 ─────────────────────────────────────────────────────
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

  return (
    <div className="flex flex-col h-full w-full" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── 顶部工具栏 ──────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-2 bg-neutral-900 border-b border-neutral-800">

        {/* 左：折叠按钮 + 返回 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-neutral-400 hover:text-white w-8 h-8"
            title={leftOpen ? '折叠左侧面板' : '展开左侧面板'}
            onClick={() => setLeftOpen((v) => !v)}
          >
            {leftOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-neutral-400 hover:text-white gap-1.5"
            onClick={prevStep}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs">上一步</span>
          </Button>
        </div>

        {/* 中：标题 */}
        <div className="flex-1 text-center">
          <span className="text-sm font-semibold text-white">海报编辑器</span>
          {dishInfo?.name && (
            <span className="text-xs text-neutral-500 ml-2">— {dishInfo.name}</span>
          )}
        </div>

        {/* 右：导出 + 折叠 */}
        <div className="flex items-center gap-2">
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white h-8 px-4 text-xs font-semibold gap-1.5"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? '导出中…' : '下载 PNG'}
          </Button>

          <Button
            variant="ghost"
            size="icon"
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

        {/* ── 左侧面板（250px，可折叠） ───────────────────────────── */}
        <aside
          className="shrink-0 flex flex-col bg-neutral-900 border-r border-neutral-800 overflow-y-auto transition-all duration-200"
          style={{ width: leftOpen ? 250 : 0, opacity: leftOpen ? 1 : 0, overflow: leftOpen ? 'auto' : 'hidden' }}
        >
          <div className="p-4 min-w-[250px]">
            <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />图层
            </p>

            {/* 图层列表占位 */}
            <div className="flex flex-col gap-2">
              {/* 背景层 */}
              <LayerItem
                icon={<ImageIcon className="w-3.5 h-3.5" />}
                label="背景图"
                subLabel={selectedBackground ? '已加载' : '未设置'}
                active={false}
              />
              {/* 菜品层 */}
              <LayerItem
                icon={<ImageIcon className="w-3.5 h-3.5" />}
                label="菜品图片"
                subLabel={dishUrl ? '已加载' : '未设置'}
                active
              />
              {/* 文字层占位 */}
              <LayerItem
                icon={<Type className="w-3.5 h-3.5" />}
                label="文字（占位）"
                subLabel="后续步骤添加"
                active={false}
              />
            </div>

            <p className="text-xs text-neutral-600 mt-4 leading-relaxed">
              图层面板将在后续子步骤中完善。
            </p>
          </div>
        </aside>

        {/* ── 中间：画布区域（flex-1） ─────────────────────────── */}
        <PosterCanvas
          ref={canvasRef}
          posterWidth={CANVAS_WIDTH}
          posterHeight={CANVAS_HEIGHT}
          backgroundUrl={backgroundUrl}
          dishUrl={dishUrl}
          brightness={bgParams.brightness}
          blur={bgParams.blur}
          warmth={bgParams.warmth}
        />

        {/* ── 右侧面板（300px，可折叠） ───────────────────────────── */}
        <aside
          className="shrink-0 flex flex-col bg-neutral-900 border-l border-neutral-800 transition-all duration-200"
          style={{ width: rightOpen ? 300 : 0, opacity: rightOpen ? 1 : 0, overflow: rightOpen ? 'auto' : 'hidden' }}
        >
          <div className="min-w-[300px]">
            {/* Tab 栏 */}
            <div className="flex border-b border-neutral-800">
              {(
                [
                  { key: 'adjust', label: '背景调节', icon: <Sliders className="w-3.5 h-3.5" /> },
                  { key: 'text',   label: '文字',     icon: <Type     className="w-3.5 h-3.5" /> },
                  { key: 'layers', label: '图层',     icon: <Layers   className="w-3.5 h-3.5" /> },
                ] as const
              ).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setRightTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    rightTab === key
                      ? 'border-orange-500 text-orange-400'
                      : 'border-transparent text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* Tab 内容 */}
            <div className="p-4">

              {/* 背景调节 tab */}
              {rightTab === 'adjust' && (
                <div className="flex flex-col gap-5">
                  <SliderControl
                    label="亮度"
                    labelEn="Brightness"
                    value={bgParams.brightness}
                    min={-1} max={1} step={0.05}
                    onChange={(v) => setBgParams((p) => ({ ...p, brightness: v }))}
                    format={(v) => (v >= 0 ? `+${Math.round(v * 100)}` : `${Math.round(v * 100)}`)}
                  />
                  <SliderControl
                    label="模糊"
                    labelEn="Blur"
                    value={bgParams.blur}
                    min={0} max={20} step={1}
                    onChange={(v) => setBgParams((p) => ({ ...p, blur: v }))}
                    format={(v) => `${v}px`}
                  />
                  <SliderControl
                    label="暖色调"
                    labelEn="Warmth"
                    value={bgParams.warmth}
                    min={-1} max={1} step={0.05}
                    onChange={(v) => setBgParams((p) => ({ ...p, warmth: v }))}
                    format={(v) => (v >= 0 ? `+${Math.round(v * 100)}` : `${Math.round(v * 100)}`)}
                  />
                  <button
                    className="text-xs text-neutral-600 hover:text-neutral-400 self-start transition-colors"
                    onClick={() => setBgParams(DEFAULT_BG)}
                  >
                    重置全部
                  </button>
                </div>
              )}

              {/* 文字 tab 占位 */}
              {rightTab === 'text' && (
                <PlaceholderPanel
                  icon={<Type className="w-8 h-8 text-neutral-600" />}
                  title="文字工具"
                  desc="双击画布上的文字即可编辑。更多文字样式工具将在后续子步骤完善。"
                />
              )}

              {/* 图层 tab 占位 */}
              {rightTab === 'layers' && (
                <PlaceholderPanel
                  icon={<Layers className="w-8 h-8 text-neutral-600" />}
                  title="图层管理"
                  desc="图层排序、锁定、可见性控制将在后续子步骤完善。"
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── 子组件：图层条目 ─────────────────────────────────────────────
function LayerItem({
  icon, label, subLabel, active,
}: {
  icon: React.ReactNode;
  label: string;
  subLabel: string;
  active: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
      active
        ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
        : 'bg-neutral-800/50 border-neutral-700 text-neutral-400 hover:border-neutral-600'
    }`}>
      <span className="shrink-0">{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium truncate">{label}</span>
        <span className="text-[10px] text-neutral-600 truncate">{subLabel}</span>
      </div>
    </div>
  );
}

// ── 子组件：滑块控制 ─────────────────────────────────────────────
function SliderControl({
  label, labelEn, value, min, max, step, onChange, format,
}: {
  label: string;
  labelEn: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-xs font-medium text-white">{label}</span>
          <span className="text-[10px] text-neutral-600 ml-1">{labelEn}</span>
        </div>
        <span className="text-xs text-orange-400 tabular-nums font-medium">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-neutral-700 accent-orange-500 cursor-pointer"
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-neutral-700">{min}</span>
        <span className="text-[10px] text-neutral-700">{max}</span>
      </div>
    </div>
  );
}

// ── 子组件：占位面板 ─────────────────────────────────────────────
function PlaceholderPanel({
  icon, title, desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      {icon}
      <p className="text-sm font-medium text-neutral-400">{title}</p>
      <p className="text-xs text-neutral-600 leading-relaxed">{desc}</p>
    </div>
  );
}
