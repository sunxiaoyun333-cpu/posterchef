'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, FlipHorizontal, FlipVertical,
  RotateCcw, Palette, RefreshCw, ArrowLeft, FileEdit,
} from 'lucide-react';
import type { Canvas, FabricObject, Textbox, FabricImage } from 'fabric';
import { usePosterStore } from '@/lib/store/posterStore';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';

// ── 字体列表 ─────────────────────────────────────────────────────────
const CN_FONTS = [
  'Noto Sans SC',
  'Noto Serif SC',
  'ZCOOL XiaoWei',
  'ZCOOL KuaiLe',
  'Ma Shan Zheng',
];

const EN_FONTS = [
  'Inter',
  'Playfair Display',
  'Bebas Neue',
  'Lobster',
  'Permanent Marker',
  'Abril Fatface',
  'Righteous',
  'Pacifico',
];

// 动态加载单个 Google Font
const loadedFonts = new Set<string>();
function loadGoogleFont(family: string) {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const encoded = family.replace(/ /g, '+');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

// ── 内部类型 ─────────────────────────────────────────────────────────
type SelectionKind = 'text' | 'image' | 'none';

interface TextProps {
  text:         string;
  fontFamily:   string;
  fontSize:     number;
  fill:         string;          // 文字颜色
  stroke:       string;          // 描边颜色
  strokeWidth:  number;
  textAlign:    'left' | 'center' | 'right';
  fontWeight:   string;
  fontStyle:    string;
  lineHeight:   number;
  opacity:      number;          // 0-100
  left:         number;
  top:          number;
  angle:        number;
}

interface ImageProps {
  opacity:  number;  // 0-100
  left:     number;
  top:      number;
  width:    number;
  height:   number;
  angle:    number;
  flipX:    boolean;
  flipY:    boolean;
}

// ── 辅助 ─────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function toHex(color: string): string {
  if (!color || color === 'transparent') return '#ffffff';
  if (color.startsWith('#') && color.length <= 7) return color;
  // rgba(r,g,b,a) → #rrggbb
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    return (
      '#' +
      [m[1], m[2], m[3]]
        .map((n) => parseInt(n).toString(16).padStart(2, '0'))
        .join('')
    );
  }
  return '#ffffff';
}

function readTextProps(obj: FabricObject): TextProps {
  const tb = obj as unknown as Textbox;
  return {
    text:        (tb.text as string) ?? '',
    fontFamily:  (tb.fontFamily as string) ?? 'Inter',
    fontSize:    (tb.fontSize as number) ?? 24,
    fill:        toHex(String(tb.fill ?? '#ffffff')),
    stroke:      toHex(String((tb as any).stroke ?? '#000000')),
    strokeWidth: (tb as any).strokeWidth ?? 0,
    textAlign:   ((tb.textAlign as string) ?? 'left') as TextProps['textAlign'],
    fontWeight:  (tb.fontWeight as string) ?? 'normal',
    fontStyle:   (tb.fontStyle as string) ?? 'normal',
    lineHeight:  (tb.lineHeight as number) ?? 1.2,
    opacity:     Math.round((obj.opacity ?? 1) * 100),
    left:        Math.round(obj.left ?? 0),
    top:         Math.round(obj.top  ?? 0),
    angle:       Math.round(obj.angle ?? 0),
  };
}

function readImageProps(obj: FabricObject): ImageProps {
  const img = obj as unknown as FabricImage;
  const bw  = img.getBoundingRect().width  / (img.canvas?.getZoom() ?? 1);
  const bh  = img.getBoundingRect().height / (img.canvas?.getZoom() ?? 1);
  return {
    opacity: Math.round((obj.opacity ?? 1) * 100),
    left:    Math.round(obj.left  ?? 0),
    top:     Math.round(obj.top   ?? 0),
    width:   Math.round(bw),
    height:  Math.round(bh),
    angle:   Math.round(obj.angle ?? 0),
    flipX:   !!(img as any).flipX,
    flipY:   !!(img as any).flipY,
  };
}

// ── 子控件 ───────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
      {children}
    </span>
  );
}

function Row({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function NumInput({
  value, min, max, step = 1, onChange, className = '',
}: {
  value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void; className?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
      className={`bg-neutral-800 border border-neutral-700 text-white text-xs rounded px-2 py-1 w-full focus:outline-none focus:border-orange-500 ${className}`}
    />
  );
}

function ToggleBtn({
  active, onClick, children, title,
}: {
  active: boolean; onClick: () => void;
  children: React.ReactNode; title?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex items-center justify-center w-8 h-7 rounded text-xs border transition-colors ${
        active
          ? 'bg-orange-500 border-orange-500 text-white'
          : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="border-t border-neutral-800 my-3" />;
}

// ── 文字属性面板 ─────────────────────────────────────────────────────
function TextPanel({
  props,
  onChange,
}: {
  props: TextProps;
  onChange: (partial: Partial<TextProps>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle><span className="text-orange-400">T</span> 文字属性</SectionTitle>

      {/* 文字内容 */}
      <div className="flex flex-col gap-1">
        <Label>文字内容</Label>
        <textarea
          value={props.text}
          rows={3}
          onChange={(e) => onChange({ text: e.target.value })}
          className="bg-neutral-800 border border-neutral-700 text-white text-xs rounded px-2 py-1.5 w-full resize-none focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* 字体 */}
      <div className="flex flex-col gap-1">
        <Label>字体</Label>
        <select
          value={props.fontFamily}
          onChange={(e) => {
            loadGoogleFont(e.target.value);
            onChange({ fontFamily: e.target.value });
          }}
          className="bg-neutral-800 border border-neutral-700 text-white text-xs rounded px-2 py-1.5 w-full focus:outline-none focus:border-orange-500"
        >
          <optgroup label="中文字体">
            {CN_FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </optgroup>
          <optgroup label="English Fonts">
            {EN_FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* 字号 */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <Label>字号</Label>
          <span className="text-[10px] text-orange-400 tabular-nums">{props.fontSize}px</span>
        </div>
        <div className="flex gap-2 items-center">
          <NumInput
            value={props.fontSize} min={12} max={200}
            onChange={(v) => onChange({ fontSize: clamp(v, 12, 200) })}
            className="w-16 shrink-0"
          />
          <input
            type="range" min={12} max={200} step={1}
            value={props.fontSize}
            onChange={(e) => onChange({ fontSize: parseInt(e.target.value) })}
            className="flex-1 h-1.5 rounded-full appearance-none bg-neutral-700 accent-orange-500 cursor-pointer"
          />
        </div>
      </div>

      {/* 颜色 */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-1 flex-1">
          <Label>文字颜色</Label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={props.fill}
              onChange={(e) => onChange({ fill: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="text-[10px] text-neutral-400 font-mono">{props.fill}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <Label>描边颜色</Label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={props.stroke}
              onChange={(e) => onChange({ stroke: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="text-[10px] text-neutral-400 font-mono">{props.stroke}</span>
          </div>
        </div>
      </div>

      {/* 描边宽度 */}
      <Row label="描边宽度">
        <NumInput
          value={props.strokeWidth} min={0} max={10} step={0.5}
          onChange={(v) => onChange({ strokeWidth: clamp(v, 0, 10) })}
        />
      </Row>

      {/* 对齐 + 样式 */}
      <div className="flex flex-col gap-1">
        <Label>对齐 / 样式</Label>
        <div className="flex gap-1">
          <ToggleBtn active={props.textAlign === 'left'}   onClick={() => onChange({ textAlign: 'left' })}   title="左对齐"><AlignLeft  className="w-3.5 h-3.5" /></ToggleBtn>
          <ToggleBtn active={props.textAlign === 'center'} onClick={() => onChange({ textAlign: 'center' })} title="居中"><AlignCenter className="w-3.5 h-3.5" /></ToggleBtn>
          <ToggleBtn active={props.textAlign === 'right'}  onClick={() => onChange({ textAlign: 'right' })}  title="右对齐"><AlignRight className="w-3.5 h-3.5" /></ToggleBtn>
          <div className="w-px bg-neutral-700 mx-1" />
          <ToggleBtn
            active={props.fontWeight === 'bold'}
            onClick={() => onChange({ fontWeight: props.fontWeight === 'bold' ? 'normal' : 'bold' })}
            title="加粗"
          ><Bold className="w-3.5 h-3.5" /></ToggleBtn>
          <ToggleBtn
            active={props.fontStyle === 'italic'}
            onClick={() => onChange({ fontStyle: props.fontStyle === 'italic' ? 'normal' : 'italic' })}
            title="斜体"
          ><Italic className="w-3.5 h-3.5" /></ToggleBtn>
        </div>
      </div>

      {/* 行间距 */}
      <Row label="行间距">
        <NumInput
          value={props.lineHeight} min={0.8} max={3.0} step={0.05}
          onChange={(v) => onChange({ lineHeight: clamp(parseFloat(v.toFixed(2)), 0.8, 3.0) })}
        />
        <span className="text-[10px] text-neutral-500 shrink-0">(0.8 – 3.0)</span>
      </Row>

      <Divider />

      {/* 透明度 */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <Label>透明度</Label>
          <span className="text-[10px] text-orange-400 tabular-nums">{props.opacity}%</span>
        </div>
        <input
          type="range" min={0} max={100} step={1}
          value={props.opacity}
          onChange={(e) => onChange({ opacity: parseInt(e.target.value) })}
          className="w-full h-1.5 rounded-full appearance-none bg-neutral-700 accent-orange-500 cursor-pointer"
        />
      </div>

      <Divider />

      {/* 位置 / 旋转 */}
      <div className="flex flex-col gap-2">
        <Label>位置 / 旋转</Label>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-600">X</span>
            <NumInput value={props.left} onChange={(v) => onChange({ left: Math.round(v) })} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-600">Y</span>
            <NumInput value={props.top} onChange={(v) => onChange({ top: Math.round(v) })} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-600">旋转</span>
            <NumInput value={props.angle} min={-360} max={360} onChange={(v) => onChange({ angle: clamp(Math.round(v), -360, 360) })} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 图片属性面板 ─────────────────────────────────────────────────────
function ImagePanel({
  props,
  onChange,
}: {
  props: ImageProps;
  onChange: (partial: Partial<ImageProps>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle><Palette className="w-3.5 h-3.5 text-orange-400" /> 图片属性</SectionTitle>

      {/* 透明度 */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <Label>透明度</Label>
          <span className="text-[10px] text-orange-400 tabular-nums">{props.opacity}%</span>
        </div>
        <input
          type="range" min={0} max={100} step={1}
          value={props.opacity}
          onChange={(e) => onChange({ opacity: parseInt(e.target.value) })}
          className="w-full h-1.5 rounded-full appearance-none bg-neutral-700 accent-orange-500 cursor-pointer"
        />
      </div>

      <Divider />

      {/* 位置 */}
      <div className="flex flex-col gap-2">
        <Label>位置</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-600">X</span>
            <NumInput value={props.left} onChange={(v) => onChange({ left: Math.round(v) })} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-600">Y</span>
            <NumInput value={props.top} onChange={(v) => onChange({ top: Math.round(v) })} />
          </div>
        </div>
      </div>

      {/* 尺寸（只读显示） */}
      <div className="flex flex-col gap-2">
        <Label>尺寸（参考）</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-600">宽</span>
            <div className="bg-neutral-800/50 border border-neutral-700 text-neutral-500 text-xs rounded px-2 py-1 tabular-nums">{props.width}</div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-600">高</span>
            <div className="bg-neutral-800/50 border border-neutral-700 text-neutral-500 text-xs rounded px-2 py-1 tabular-nums">{props.height}</div>
          </div>
        </div>
      </div>

      {/* 旋转 */}
      <Row label="旋转角度">
        <NumInput
          value={props.angle} min={-360} max={360}
          onChange={(v) => onChange({ angle: clamp(Math.round(v), -360, 360) })}
        />
        <span className="text-[10px] text-neutral-500 shrink-0">°</span>
      </Row>

      <Divider />

      {/* 翻转 */}
      <div className="flex flex-col gap-1">
        <Label>翻转</Label>
        <div className="flex gap-2">
          <ToggleBtn active={props.flipX} onClick={() => onChange({ flipX: !props.flipX })} title="水平翻转">
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span className="text-[10px] ml-1">水平</span>
          </ToggleBtn>
          <ToggleBtn active={props.flipY} onClick={() => onChange({ flipY: !props.flipY })} title="垂直翻转">
            <FlipVertical className="w-3.5 h-3.5" />
            <span className="text-[10px] ml-1">垂直</span>
          </ToggleBtn>
        </div>
      </div>
    </div>
  );
}

// ── 画布设置面板（无选中） ────────────────────────────────────────────
function CanvasPanel({
  canvasWidth,
  canvasHeight,
  onRelayout,
  onChangeBackground,
  onEditCopy,
}: {
  canvasWidth: number;
  canvasHeight: number;
  onRelayout: () => void;
  onChangeBackground: () => void;
  onEditCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>画布设置</SectionTitle>

      <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-3">
        <p className="text-[10px] text-neutral-500 mb-1.5">画布尺寸</p>
        <p className="text-sm font-bold text-white tabular-nums">
          {canvasWidth} × {canvasHeight}
        </p>
        <p className="text-[10px] text-neutral-600 mt-0.5">像素 (px)</p>
      </div>

      <div className="flex flex-col gap-2 mt-1">
        <button
          onClick={onRelayout}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-neutral-300 hover:border-orange-500 hover:text-orange-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          重新自动排版
        </button>
        <button
          onClick={onChangeBackground}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-neutral-300 hover:border-orange-500 hover:text-orange-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          更换背景
        </button>
        <button
          onClick={onEditCopy}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-neutral-300 hover:border-orange-500 hover:text-orange-300 transition-colors"
        >
          <FileEdit className="w-3.5 h-3.5 shrink-0" />
          编辑文案
        </button>
      </div>

      <Divider />

      <div className="bg-neutral-800/40 rounded-lg p-3 border border-neutral-800">
        <p className="text-[10px] text-neutral-500 mb-1.5">操作提示</p>
        <ul className="text-[10px] text-neutral-600 space-y-1 leading-relaxed">
          <li>• 单击画布元素以选中</li>
          <li>• 双击文字可直接编辑</li>
          <li>• 拖拽移动，角点缩放</li>
          <li>• 方向键微移（Shift=10px）</li>
          <li>• Delete 删除选中元素</li>
          <li>• Ctrl + 滚轮缩放画布</li>
        </ul>
      </div>
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────────────────────
export interface PropertyPanelProps {
  getCanvas: () => Canvas | null;
  onRelayout: () => void;
  onChangeBackground: () => void;
  onEditCopy: () => void;
}

export default function PropertyPanel({
  getCanvas,
  onRelayout,
  onChangeBackground,
  onEditCopy,
}: PropertyPanelProps) {
  const { canvasWidth, canvasHeight, prevStep } = usePosterStore();

  const [kind,       setKind]       = useState<SelectionKind>('none');
  const [textProps,  setTextProps]  = useState<TextProps | null>(null);
  const [imageProps, setImageProps] = useState<ImageProps | null>(null);

  // 当前选中的 FabricObject 引用（不触发 re-render）
  const activeObjRef = useRef<FabricObject | null>(null);

  // ── 从 canvas 读取选中对象状态 ──────────────────────────────────
  const syncFromCanvas = useCallback(() => {
    const fc  = getCanvas();
    if (!fc) return;
    const obj = fc.getActiveObject();
    activeObjRef.current = obj ?? null;

    if (!obj) {
      setKind('none');
      setTextProps(null);
      setImageProps(null);
      return;
    }

    // Fabric 6: Textbox 继承自 FabricObject
    const isText  = 'text' in obj && typeof (obj as any).text === 'string';
    const isImage = obj.type === 'image';

    if (isText) {
      setKind('text');
      setTextProps(readTextProps(obj));
      setImageProps(null);
    } else if (isImage) {
      setKind('image');
      setImageProps(readImageProps(obj));
      setTextProps(null);
    } else {
      // Group / Rect 等 — 作为通用图像处理
      setKind('image');
      setImageProps(readImageProps(obj));
      setTextProps(null);
    }
  }, [getCanvas]);

  // ── 注册 canvas 选中事件 ────────────────────────────────────────
  useEffect(() => {
    // 轮询等 canvas 就绪（canvas 初始化是异步的）
    const tryAttach = () => {
      const fc = getCanvas();
      if (!fc) {
        setTimeout(tryAttach, 200);
        return;
      }
      fc.on('selection:created', syncFromCanvas);
      fc.on('selection:updated', syncFromCanvas);
      fc.on('selection:cleared', syncFromCanvas);
      // 对象修改后也要刷新（位置/尺寸变了）
      fc.on('object:modified', syncFromCanvas);
      fc.on('object:scaling',  syncFromCanvas);
      fc.on('object:moving',   syncFromCanvas);
      fc.on('object:rotating', syncFromCanvas);
    };
    tryAttach();

    return () => {
      const fc = getCanvas();
      if (!fc) return;
      fc.off('selection:created', syncFromCanvas);
      fc.off('selection:updated', syncFromCanvas);
      fc.off('selection:cleared', syncFromCanvas);
      fc.off('object:modified',   syncFromCanvas);
      fc.off('object:scaling',    syncFromCanvas);
      fc.off('object:moving',     syncFromCanvas);
      fc.off('object:rotating',   syncFromCanvas);
    };
  }, [getCanvas, syncFromCanvas]);

  // ── 把文字属性写回 canvas ────────────────────────────────────────
  const applyTextChange = useCallback((partial: Partial<TextProps>) => {
    const fc  = getCanvas();
    const obj = activeObjRef.current;
    if (!fc || !obj) return;

    const merged = { ...textProps, ...partial } as TextProps;
    setTextProps(merged);

    const fabricSet: Record<string, unknown> = {};
    if ('text'        in partial) fabricSet.text        = partial.text;
    if ('fontFamily'  in partial) fabricSet.fontFamily  = partial.fontFamily;
    if ('fontSize'    in partial) fabricSet.fontSize    = partial.fontSize;
    if ('fill'        in partial) fabricSet.fill        = partial.fill;
    if ('stroke'      in partial) fabricSet.stroke      = partial.stroke;
    if ('strokeWidth' in partial) fabricSet.strokeWidth = partial.strokeWidth;
    if ('textAlign'   in partial) fabricSet.textAlign   = partial.textAlign;
    if ('fontWeight'  in partial) fabricSet.fontWeight  = partial.fontWeight;
    if ('fontStyle'   in partial) fabricSet.fontStyle   = partial.fontStyle;
    if ('lineHeight'  in partial) fabricSet.lineHeight  = partial.lineHeight;
    if ('opacity'     in partial) fabricSet.opacity     = (partial.opacity ?? 100) / 100;
    if ('left'        in partial) fabricSet.left        = partial.left;
    if ('top'         in partial) fabricSet.top         = partial.top;
    if ('angle'       in partial) fabricSet.angle       = partial.angle;

    obj.set(fabricSet as any);
    obj.setCoords();
    fc.requestRenderAll();
  }, [getCanvas, textProps]);

  // ── 把图片属性写回 canvas ────────────────────────────────────────
  const applyImageChange = useCallback((partial: Partial<ImageProps>) => {
    const fc  = getCanvas();
    const obj = activeObjRef.current;
    if (!fc || !obj) return;

    const merged = { ...imageProps, ...partial } as ImageProps;
    setImageProps(merged);

    const fabricSet: Record<string, unknown> = {};
    if ('opacity' in partial) fabricSet.opacity = (partial.opacity ?? 100) / 100;
    if ('left'    in partial) fabricSet.left    = partial.left;
    if ('top'     in partial) fabricSet.top     = partial.top;
    if ('angle'   in partial) fabricSet.angle   = partial.angle;
    if ('flipX'   in partial) fabricSet.flipX   = partial.flipX;
    if ('flipY'   in partial) fabricSet.flipY   = partial.flipY;

    obj.set(fabricSet as any);
    obj.setCoords();
    fc.requestRenderAll();
  }, [getCanvas, imageProps]);

  // ── 渲染 ─────────────────────────────────────────────────────────
  return (
    <div className="p-4">
      {kind === 'text' && textProps && (
        <TextPanel props={textProps} onChange={applyTextChange} />
      )}
      {kind === 'image' && imageProps && (
        <ImagePanel props={imageProps} onChange={applyImageChange} />
      )}
      {kind === 'none' && (
        <CanvasPanel
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onRelayout={onRelayout}
          onChangeBackground={onChangeBackground}
          onEditCopy={onEditCopy}
        />
      )}
    </div>
  );
}
