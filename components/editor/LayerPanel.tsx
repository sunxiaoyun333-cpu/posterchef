'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, Type, Image as ImageIcon, Box } from 'lucide-react';
import type { Canvas, FabricObject } from 'fabric';

// ── 图层元数据 ───────────────────────────────────────────────────────

// data.tag 常量（与 PosterCanvas 一致）
const TEXT_LAYER_TAG = 'text_layer';
const DIVIDER_TAG    = 'divider';
const GUIDE_TAG      = '__guide__';
const DECO_TAG       = 'decoration';

// data.type → 中文名
const TYPE_LABEL: Record<string, string> = {
  mainTitle:    '主标题',
  subTitle:     '副标题',
  tagline:      'Slogan',
  price:        '价格',
  priceOriginal:'原价',
  promoGroup:   '促销标签',
  spiceLevel:   '辣度',
  dish:         '菜品图',
  background:   '背景图',
  divider:      '分隔线',
  decoration:   '装饰',
};

interface LayerInfo {
  id:       string;   // fabricObject._id 或 index 作为 key
  obj:      FabricObject;
  label:    string;
  kind:     'text' | 'image' | 'group' | 'other';
  visible:  boolean;
  locked:   boolean;
  index:    number;   // 在 fc.getObjects() 中的位置（越大越靠前）
}

function getObjData(o: FabricObject): any {
  return (o as any).data;
}

function buildLabel(o: FabricObject, index: number): string {
  const d = getObjData(o);
  if (d?.type  && TYPE_LABEL[d.type])  return TYPE_LABEL[d.type];
  if (d?.tag   === DIVIDER_TAG)         return '分隔线';
  if (d?.tag   === DECO_TAG)            return d?.label ?? '装饰';
  if (d?.key   === 'dish')              return '菜品图';
  const t = o.type;
  if (t === 'textbox' || t === 'i-text') return `文字 ${index + 1}`;
  if (t === 'image')                     return `图片 ${index + 1}`;
  if (t === 'group')                     return `组合 ${index + 1}`;
  return `元素 ${index + 1}`;
}

function getKind(o: FabricObject): LayerInfo['kind'] {
  const t = o.type;
  if (t === 'textbox' || t === 'i-text') return 'text';
  if (t === 'image')                     return 'image';
  if (t === 'group')                     return 'group';
  return 'other';
}

function shouldHide(o: FabricObject): boolean {
  const d = getObjData(o);
  return d?.tag === GUIDE_TAG;
}

// ── 单个图层行 ───────────────────────────────────────────────────────
function LayerRow({
  layer,
  isActive,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onMoveUp,
  onMoveDown,
  isTop,
  isBottom,
}: {
  layer:           LayerInfo;
  isActive:        boolean;
  onSelect:        () => void;
  onToggleVisible: () => void;
  onToggleLock:    () => void;
  onMoveUp:        () => void;
  onMoveDown:      () => void;
  isTop:           boolean;
  isBottom:        boolean;
}) {
  const KindIcon =
    layer.kind === 'text'  ? Type      :
    layer.kind === 'image' ? ImageIcon : Box;

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors select-none ${
        isActive
          ? 'bg-orange-500/15 border border-orange-500/30'
          : 'border border-transparent hover:bg-neutral-800/60'
      }`}
    >
      {/* 种类图标 */}
      <span className={`shrink-0 ${isActive ? 'text-orange-400' : 'text-neutral-500'}`}>
        <KindIcon className="w-3 h-3" />
      </span>

      {/* 名称 */}
      <span className={`flex-1 text-xs truncate ${
        isActive ? 'text-orange-300 font-medium' : 'text-neutral-300'
      } ${!layer.visible ? 'opacity-40' : ''}`}>
        {layer.label}
      </span>

      {/* 操作按钮（hover/active 时显示） */}
      <div className={`flex items-center gap-0.5 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
        <button
          title={layer.visible ? '隐藏' : '显示'}
          onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
          className="w-5 h-5 flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
        >
          {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-neutral-600" />}
        </button>
        <button
          title={layer.locked ? '解锁' : '锁定'}
          onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
          className="w-5 h-5 flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
        >
          {layer.locked ? <Lock className="w-3 h-3 text-orange-500" /> : <Unlock className="w-3 h-3" />}
        </button>
        <button
          title="上移一层"
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isTop}
          className="w-5 h-5 flex items-center justify-center text-neutral-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          title="下移一层"
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isBottom}
          className="w-5 h-5 flex items-center justify-center text-neutral-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── 图层 Tab ─────────────────────────────────────────────────────────
export function LayersTab({ getCanvas }: { getCanvas: () => Canvas | null }) {
  const [layers,    setLayers]    = useState<LayerInfo[]>([]);
  const [activeId,  setActiveId]  = useState<string | null>(null);

  // 从 canvas 重建图层列表
  const refresh = useCallback(() => {
    const fc = getCanvas();
    if (!fc) return;

    const objs = fc.getObjects();
    const visible: LayerInfo[] = [];

    objs.forEach((o, idx) => {
      if (shouldHide(o)) return;
      visible.push({
        id:      String((o as any).__uid ?? idx),
        obj:     o,
        label:   buildLabel(o, idx),
        kind:    getKind(o),
        visible: o.visible !== false,
        locked:  !(o.selectable),
        index:   idx,
      });
    });

    // 画布中层级越高 index 越大，图层面板中越靠上
    visible.reverse();
    setLayers(visible);

    const active = fc.getActiveObject();
    setActiveId(active ? String((active as any).__uid ?? objs.indexOf(active)) : null);
  }, [getCanvas]);

  // 注册 canvas 事件
  useEffect(() => {
    const tryAttach = () => {
      const fc = getCanvas();
      if (!fc) { setTimeout(tryAttach, 200); return; }

      const events = [
        'object:added', 'object:removed',
        'object:modified', 'selection:created',
        'selection:updated', 'selection:cleared',
        'object:moving',
      ] as const;
      events.forEach((ev) => fc.on(ev, refresh));
      refresh();

      return () => events.forEach((ev) => fc.off(ev, refresh));
    };
    const cleanup = tryAttach();
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [getCanvas, refresh]);

  const handleSelect = (layer: LayerInfo) => {
    const fc = getCanvas();
    if (!fc) return;
    fc.setActiveObject(layer.obj);
    fc.requestRenderAll();
    setActiveId(layer.id);
  };

  const handleToggleVisible = (layer: LayerInfo) => {
    const fc = getCanvas();
    if (!fc) return;
    layer.obj.set('visible', !layer.obj.visible);
    fc.requestRenderAll();
    refresh();
  };

  const handleToggleLock = (layer: LayerInfo) => {
    const fc = getCanvas();
    if (!fc) return;
    const locked = !layer.obj.selectable;
    layer.obj.set({
      selectable:    locked,  // 解锁 → selectable=true
      evented:       locked,
      lockMovementX: !locked,
      lockMovementY: !locked,
    });
    if (!locked) {
      // 锁定后取消选中
      if (fc.getActiveObject() === layer.obj) fc.discardActiveObject();
    }
    fc.requestRenderAll();
    refresh();
  };

  const handleMoveUp = (layer: LayerInfo) => {
    const fc = getCanvas();
    if (!fc) return;
    fc.bringObjectForward(layer.obj);
    fc.requestRenderAll();
    refresh();
  };

  const handleMoveDown = (layer: LayerInfo) => {
    const fc = getCanvas();
    if (!fc) return;
    fc.sendObjectBackwards(layer.obj);
    fc.requestRenderAll();
    refresh();
  };

  if (layers.length === 0) {
    return (
      <p className="text-xs text-neutral-600 text-center py-6">暂无图层</p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {layers.map((layer, i) => (
        <LayerRow
          key={layer.id + '-' + layer.index}
          layer={layer}
          isActive={layer.id === activeId}
          onSelect={() => handleSelect(layer)}
          onToggleVisible={() => handleToggleVisible(layer)}
          onToggleLock={() => handleToggleLock(layer)}
          onMoveUp={() => handleMoveUp(layer)}
          onMoveDown={() => handleMoveDown(layer)}
          isTop={i === 0}
          isBottom={i === layers.length - 1}
        />
      ))}
    </div>
  );
}

// ── 装饰素材库 ───────────────────────────────────────────────────────

interface DecoItem {
  emoji:    string;
  label:    string;
  fontSize: number;
  bg?:      string;   // 可选背景色（用于标签类）
  color?:   string;   // 标签文字颜色
}

const DECO_CATEGORIES: { title: string; items: DecoItem[] }[] = [
  {
    title: '🌶️ 食材',
    items: [
      { emoji: '🌶️', label: '辣椒',   fontSize: 48 },
      { emoji: '🫑', label: '花椒',   fontSize: 48 },
      { emoji: '🍋', label: '柠檬片', fontSize: 48 },
      { emoji: '🧅', label: '葱花',   fontSize: 48 },
      { emoji: '🧄', label: '蒜瓣',   fontSize: 48 },
      { emoji: '🌿', label: '香草',   fontSize: 48 },
    ],
  },
  {
    title: '✨ 效果',
    items: [
      { emoji: '🔥', label: '火焰',   fontSize: 48 },
      { emoji: '⭐', label: '星星',   fontSize: 48 },
      { emoji: '✨', label: '光斑',   fontSize: 48 },
      { emoji: '💥', label: '爆炸',   fontSize: 48 },
      { emoji: '🌟', label: '亮星',   fontSize: 48 },
      { emoji: '💫', label: '旋转星', fontSize: 48 },
    ],
  },
  {
    title: '🏷️ 标签',
    items: [
      { emoji: 'NEW',  label: 'NEW',  fontSize: 22, bg: '#ef4444', color: '#ffffff' },
      { emoji: 'HOT',  label: 'HOT',  fontSize: 22, bg: '#f97316', color: '#ffffff' },
      { emoji: '推荐', label: '推荐', fontSize: 22, bg: '#22c55e', color: '#ffffff' },
      { emoji: '限时', label: '限时', fontSize: 22, bg: '#a855f7', color: '#ffffff' },
      { emoji: '特价', label: '特价', fontSize: 22, bg: '#eab308', color: '#1a1a1a' },
      { emoji: '招牌', label: '招牌', fontSize: 22, bg: '#e11d48', color: '#ffffff' },
    ],
  },
  {
    title: '❤️ 图标',
    items: [
      { emoji: '👍', label: '大拇指', fontSize: 48 },
      { emoji: '👑', label: '皇冠',   fontSize: 48 },
      { emoji: '🏆', label: '奖杯',   fontSize: 48 },
      { emoji: '🥢', label: '筷子',   fontSize: 48 },
      { emoji: '❤️', label: '爱心',   fontSize: 48 },
      { emoji: '💎', label: '钻石',   fontSize: 48 },
    ],
  },
];

function DecoCard({
  item,
  onAdd,
}: {
  item:  DecoItem;
  onAdd: (item: DecoItem) => void;
}) {
  const isLabel = !!item.bg;

  return (
    <button
      onClick={() => onAdd(item)}
      title={`添加 ${item.label}`}
      className="flex flex-col items-center gap-1 p-2 rounded-lg bg-neutral-800/60 border border-neutral-700 hover:border-orange-500/50 hover:bg-orange-500/5 transition-colors"
    >
      {isLabel ? (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: item.bg, color: item.color, fontSize: 11 }}
        >
          {item.emoji}
        </span>
      ) : (
        <span style={{ fontSize: item.fontSize * 0.4 }} className="leading-none">
          {item.emoji}
        </span>
      )}
      <span className="text-[9px] text-neutral-500">{item.label}</span>
    </button>
  );
}

export function DecorationTab({ getCanvas }: { getCanvas: () => Canvas | null }) {
  const handleAdd = useCallback((item: DecoItem) => {
    const fc = getCanvas();
    if (!fc) return;

    // 动态 import fabric Textbox（客户端）
    import('fabric').then(({ Textbox, Rect, Group }) => {
      const cw = (fc as any).width  / fc.getZoom();
      const ch = (fc as any).height / fc.getZoom();
      const cx = cw / 2;
      const cy = ch / 2;

      const isLabel = !!item.bg;

      if (isLabel) {
        // 标签类：圆角背景 + 文字
        const pH  = 40;
        const pW  = item.emoji.length * (item.fontSize * 0.75) + 24;
        const bg  = new Rect({
          width:  pW,
          height: pH,
          rx:     pH / 2,
          ry:     pH / 2,
          fill:   item.bg,
          left:   0,
          top:    0,
        });
        const txt = new Textbox(item.emoji, {
          width:      pW,
          fontSize:   item.fontSize,
          fontFamily: 'Inter',
          fontWeight: 'bold',
          fill:       item.color ?? '#ffffff',
          textAlign:  'center',
          left:       0,
          top:        (pH - item.fontSize * 1.2) / 2,
          selectable: false,
          evented:    false,
        });
        const group = new Group([bg, txt], {
          left:    cx - pW / 2,
          top:     cy - pH / 2,
          originX: 'left',
          originY: 'top',
        } as any);
        (group as any).data = { tag: DECO_TAG, label: item.label };
        fc.add(group);
        fc.setActiveObject(group);
      } else {
        // emoji 类：直接 Textbox
        const tb = new Textbox(item.emoji, {
          left:        cx,
          top:         cy,
          originX:     'center',
          originY:     'center',
          fontSize:    item.fontSize,
          fontFamily:  'Arial',
          textAlign:   'center',
          selectable:  true,
          editable:    false,
          width:       item.fontSize * 1.5,
        });
        (tb as any).data = { tag: DECO_TAG, label: item.label };
        fc.add(tb);
        fc.setActiveObject(tb);
      }

      fc.requestRenderAll();
    });
  }, [getCanvas]);

  return (
    <div className="flex flex-col gap-4">
      {DECO_CATEGORIES.map((cat) => (
        <div key={cat.title}>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-2">
            {cat.title}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {cat.items.map((item) => (
              <DecoCard key={item.label} item={item} onAdd={handleAdd} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 主组件（带 Tabs） ────────────────────────────────────────────────
export default function LayerPanel({ getCanvas }: { getCanvas: () => Canvas | null }) {
  const [tab, setTab] = useState<'layers' | 'deco'>('layers');

  return (
    <div className="flex flex-col h-full">
      {/* Tab 头 */}
      <div className="flex border-b border-neutral-800 shrink-0">
        <button
          onClick={() => setTab('layers')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
            tab === 'layers'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          图层
        </button>
        <button
          onClick={() => setTab('deco')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
            tab === 'deco'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          装饰素材
        </button>
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'layers' && <LayersTab getCanvas={getCanvas} />}
        {tab === 'deco'   && <DecorationTab getCanvas={getCanvas} />}
      </div>
    </div>
  );
}
