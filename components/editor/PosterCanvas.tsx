'use client';

import {
  useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle,
} from 'react';
import {
  Canvas, FabricImage, Textbox, Rect, Group, Line,
  filters as FabricFilters,
  type FabricObject,
} from 'fabric';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import {
  layoutPoster,
  GOOGLE_FONTS_URLS,
  DEFAULT_VISIBILITY,
  type TextElementConfig,
} from '@/lib/templates/layoutEngine';
import type { StyleTemplate, CopySet } from '@/lib/types';

// ── 类型 ─────────────────────────────────────────────────────────
export interface PosterCanvasProps {
  posterWidth:    number;
  posterHeight:   number;
  backgroundUrl?: string | null;
  dishUrl?:       string | null;
  brightness?:    number;
  blur?:          number;
  warmth?:        number;
  style?:         StyleTemplate | null;
  copy?:          CopySet | null;
  languageMode?:  'bilingual' | 'cn_only' | 'en_only';
}

export interface PosterCanvasHandle {
  getCanvas:        () => Canvas | null;
  exportPng:        () => string;
  setZoom:          (z: number) => void;
  refreshTextLayer: () => Promise<void>;
}

// ── 常量 ─────────────────────────────────────────────────────────
const MIN_ZOOM       = 0.1;
const MAX_ZOOM       = 3;
const ZOOM_STEP      = 0.1;
const SNAP_THRESHOLD = 5;          // 吸附距离（逻辑像素）
const TEXT_LAYER_TAG = 'text_layer';
const DIVIDER_TAG    = 'divider';
const GUIDE_TAG      = '__guide__'; // 辅助线标记

// ── Google Fonts ──────────────────────────────────────────────────
const loadedFonts = new Set<string>();

async function ensureGoogleFont(fontStyle: StyleTemplate['fontStyle']): Promise<void> {
  if (loadedFonts.has(fontStyle)) return;
  loadedFonts.add(fontStyle);
  const url = GOOGLE_FONTS_URLS[fontStyle];
  if (!url) return;
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
  await Promise.race([
    document.fonts.ready,
    new Promise<void>((r) => setTimeout(r, 3000)),
  ]);
}

// ── 辅助：读取对象的 data 属性（Fabric 6 无类型） ─────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getData = (o: FabricObject): any => (o as any).data;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setData = (o: FabricObject, v: any) => { (o as any).data = v; };

// ── 创建辅助线 ───────────────────────────────────────────────────
function makeGuide(
  x1: number, y1: number, x2: number, y2: number,
): Line {
  const line = new Line([x1, y1, x2, y2], {
    stroke:           '#ff3333',
    strokeWidth:      1,
    strokeDashArray:  [5, 4],
    selectable:       false,
    evented:          false,
    excludeFromExport: true,
    opacity:          0.85,
  });
  setData(line, { tag: GUIDE_TAG });
  return line;
}

// ── 清除所有辅助线 ───────────────────────────────────────────────
function clearGuides(fc: Canvas) {
  fc.getObjects()
    .filter((o) => getData(o)?.tag === GUIDE_TAG)
    .forEach((o) => fc.remove(o));
}

// ── 智能对齐：计算并绘制辅助线，返回吸附后的坐标偏移 ─────────────
interface SnapResult { dx: number; dy: number }

function applySnapping(
  fc:          Canvas,
  moving:      FabricObject,
  posterW:     number,
  posterH:     number,
): SnapResult {
  clearGuides(fc);

  const mBound = moving.getBoundingRect();     // 屏幕坐标
  const zoom   = fc.getZoom();

  // 对象逻辑坐标（除以 zoom 还原）
  const mL  = mBound.left   / zoom;
  const mT  = mBound.top    / zoom;
  const mR  = mL + mBound.width  / zoom;
  const mB  = mT + mBound.height / zoom;
  const mCX = (mL + mR) / 2;
  const mCY = (mT + mB) / 2;

  // 画布中心线
  const cCX = posterW / 2;
  const cCY = posterH / 2;

  // 其他可选中对象的边界
  const others = fc.getObjects().filter((o) => {
    if (o === moving) return false;
    if (!o.selectable) return false;
    const tag = getData(o)?.tag;
    return tag !== GUIDE_TAG;
  });

  const guides: Line[] = [];
  let dx = 0, dy = 0;
  let snappedX = false, snappedY = false;

  // ── 候选吸附线（x 方向） ──────────────────────────────────────
  const xCandidates: { val: number; type: 'left'|'right'|'cx' }[] = [
    { val: 0,    type: 'left'  },
    { val: cCX,  type: 'cx'   },
    { val: posterW, type: 'right' },
  ];

  others.forEach((o) => {
    const b  = o.getBoundingRect();
    const oL = b.left / zoom;
    const oR = oL + b.width / zoom;
    const oC = (oL + oR) / 2;
    xCandidates.push(
      { val: oL, type: 'left'  },
      { val: oR, type: 'right' },
      { val: oC, type: 'cx'   },
    );
  });

  // ── 候选吸附线（y 方向） ──────────────────────────────────────
  const yCandidates: { val: number; type: 'top'|'bottom'|'cy' }[] = [
    { val: 0,       type: 'top'    },
    { val: cCY,     type: 'cy'    },
    { val: posterH, type: 'bottom' },
  ];

  others.forEach((o) => {
    const b  = o.getBoundingRect();
    const oT = b.top / zoom;
    const oB = oT + b.height / zoom;
    const oC = (oT + oB) / 2;
    yCandidates.push(
      { val: oT, type: 'top'    },
      { val: oB, type: 'bottom' },
      { val: oC, type: 'cy'    },
    );
  });

  // ── X 轴吸附（按最近距离取一条） ────────────────────────────
  let bestX: { dist: number; snap: number; objVal: number } | null = null;

  for (const { val, type } of xCandidates) {
    // 吸附目标：对象的左边 / 中心 / 右边 vs 候选线
    const checks = [
      { objVal: mL,  snap: val },
      { objVal: mCX, snap: val },
      { objVal: mR,  snap: val },
    ];
    for (const c of checks) {
      const dist = Math.abs(c.objVal - c.snap);
      if (dist < SNAP_THRESHOLD && (!bestX || dist < bestX.dist)) {
        bestX = { dist, snap: c.snap, objVal: c.objVal };
      }
    }
    void type; // 仅用于过滤时区分来源，此处不影响逻辑
  }

  if (bestX && !snappedX) {
    dx = bestX.snap - bestX.objVal;
    snappedX = true;
    guides.push(makeGuide(bestX.snap, 0, bestX.snap, posterH));
  }

  // ── Y 轴吸附 ────────────────────────────────────────────────
  let bestY: { dist: number; snap: number; objVal: number } | null = null;

  for (const { val } of yCandidates) {
    const checks = [
      { objVal: mT,  snap: val },
      { objVal: mCY, snap: val },
      { objVal: mB,  snap: val },
    ];
    for (const c of checks) {
      const dist = Math.abs(c.objVal - c.snap);
      if (dist < SNAP_THRESHOLD && (!bestY || dist < bestY.dist)) {
        bestY = { dist, snap: c.snap, objVal: c.objVal };
      }
    }
  }

  if (bestY && !snappedY) {
    dy = bestY.snap - bestY.objVal;
    snappedY = true;
    guides.push(makeGuide(0, bestY.snap, posterW, bestY.snap));
  }

  // 加入辅助线
  guides.forEach((g) => fc.add(g));

  return { dx, dy };
}

// ── 把 TextElementConfig 渲染为 Fabric 对象 ───────────────────────
function addTextElement(fc: Canvas, cfg: TextElementConfig): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataBase = { tag: TEXT_LAYER_TAG, type: cfg.type } as any;

  if (cfg.type === 'promoGroup') {
    const bgRect = new Rect({
      width:  cfg.promoWidth  ?? 160,
      height: cfg.promoHeight ?? 36,
      rx:     (cfg.promoHeight ?? 36) / 2,
      ry:     (cfg.promoHeight ?? 36) / 2,
      fill:   cfg.promoBgColor ?? '#e67e22',
      left:   0,
      top:    0,
    });
    const label = new Textbox(cfg.text, {
      width:      cfg.promoWidth ?? 160,
      fontSize:   cfg.fontSize,
      fontFamily: cfg.fontFamily,
      fontWeight: cfg.fontWeight,
      fill:       cfg.fill,
      textAlign:  cfg.textAlign,
      left:       0,
      top:        ((cfg.promoHeight ?? 36) - cfg.fontSize * 1.2) / 2,
      selectable: false,
      evented:    false,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const group = new Group([bgRect, label], {
      left:       cfg.left,
      top:        cfg.top,
      selectable: cfg.selectable,
    } as any);
    setData(group, dataBase);
    fc.add(group);
    return;
  }

  const tb = new Textbox(cfg.text, {
    left:            cfg.left,
    top:             cfg.top,
    width:           cfg.width,
    fontSize:        cfg.fontSize,
    fontFamily:      cfg.fontFamily,
    fontWeight:      cfg.fontWeight,
    fontStyle:       cfg.fontStyle as 'normal' | 'italic',
    fill:            cfg.fill,
    textAlign:       cfg.textAlign,
    lineHeight:      cfg.lineHeight,
    opacity:         cfg.opacity,
    selectable:      cfg.selectable,
    splitByGrapheme: false,
  });
  setData(tb, dataBase);

  if (cfg.strikethrough) {
    tb.set('overline',    false);
    tb.set('linethrough', true);
  }
  fc.add(tb);
}

// ── 组件 ─────────────────────────────────────────────────────────
const PosterCanvas = forwardRef<PosterCanvasHandle, PosterCanvasProps>(
  function PosterCanvas(
    {
      posterWidth,
      posterHeight,
      backgroundUrl,
      dishUrl,
      brightness  = 0,
      blur        = 0,
      warmth      = 0,
      style       = null,
      copy        = null,
      languageMode = 'bilingual',
    },
    ref,
  ) {
    const wrapperRef  = useRef<HTMLDivElement>(null);
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef   = useRef<Canvas | null>(null);
    const zoomRef     = useRef(1);   // 用于键盘事件的实时 zoom

    const [zoom,    setZoomState] = useState(1);
    const [fitZoom, setFitZoom]   = useState(1);

    // ── 适配缩放 ─────────────────────────────────────────────────
    const calcFitZoom = useCallback(() => {
      if (!wrapperRef.current) return 1;
      const { clientWidth: w, clientHeight: h } = wrapperRef.current;
      const padding = 48;
      return Math.min(
        (w - padding) / posterWidth,
        (h - padding) / posterHeight,
        1,
      );
    }, [posterWidth, posterHeight]);

    // ── 应用 zoom ────────────────────────────────────────────────
    const applyZoom = useCallback((z: number) => {
      const fc = fabricRef.current;
      if (!fc) return;
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
      fc.setZoom(clamped);
      fc.setDimensions({ width: posterWidth * clamped, height: posterHeight * clamped });
      setZoomState(clamped);
      zoomRef.current = clamped;
    }, [posterWidth, posterHeight]);

    // ── 加载背景图（锁定不可选） ─────────────────────────────────
    const loadBackground = useCallback(async (fc: Canvas, url: string) => {
      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
        img.set({
          left:              0,
          top:               0,
          scaleX:            posterWidth  / (img.width  ?? posterWidth),
          scaleY:            posterHeight / (img.height ?? posterHeight),
          selectable:        false,
          evented:           false,
          lockMovementX:     true,
          lockMovementY:     true,
          excludeFromExport: false,
        });

        const imgFilters: InstanceType<typeof FabricFilters.BaseFilter>[] = [];
        if (brightness !== 0) imgFilters.push(new FabricFilters.Brightness({ brightness }));
        if (blur        >  0) imgFilters.push(new FabricFilters.Blur({ blur: blur / 20 }));
        if (warmth      !== 0) {
          const w = warmth * 0.3;
          imgFilters.push(new FabricFilters.ColorMatrix({
            matrix: [
              1 + w, 0, 0, 0, 0,
              0,     1, 0, 0, 0,
              0,     0, 1 - w, 0, 0,
              0,     0, 0, 1, 0,
            ],
          }));
        }
        img.filters = imgFilters;
        img.applyFilters();

        fc.backgroundImage = img;
        fc.requestRenderAll();
      } catch { /* 静默 */ }
    }, [posterWidth, posterHeight, brightness, blur, warmth]);

    // ── 加载菜品图 ───────────────────────────────────────────────
    const loadDishImage = useCallback(async (fc: Canvas, url: string) => {
      fc.getObjects()
        .filter((o) => getData(o)?.key === 'dish')
        .forEach((o) => fc.remove(o));

      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
        const maxW  = posterWidth  * 0.80;
        const maxH  = posterHeight * 0.52;
        const ratio = Math.min(maxW / (img.width ?? 1), maxH / (img.height ?? 1));
        img.scale(ratio);
        img.set({
          left:    posterWidth  / 2,
          top:     posterHeight * 0.35,
          originX: 'center',
          originY: 'center',
          // 选中控制：显示旋转 + 缩放手柄
          hasControls:       true,
          hasBorders:        true,
        });
        setData(img, { key: 'dish' });
        fc.add(img);
        bringTextLayerToFront(fc);
        fc.requestRenderAll();
      } catch { /* 静默 */ }
    }, [posterWidth, posterHeight]);

    // ── 把文字层置顶 ─────────────────────────────────────────────
    function bringTextLayerToFront(fc: Canvas) {
      fc.getObjects()
        .filter((o) => {
          const tag = getData(o)?.tag;
          return tag === TEXT_LAYER_TAG || tag === DIVIDER_TAG;
        })
        .forEach((o) => fc.bringObjectToFront(o));
    }

    // ── 清除文字层 ───────────────────────────────────────────────
    function clearTextLayer(fc: Canvas) {
      fc.getObjects()
        .filter((o) => {
          const tag = getData(o)?.tag;
          return tag === TEXT_LAYER_TAG || tag === DIVIDER_TAG;
        })
        .forEach((o) => fc.remove(o));
    }

    // ── 渲染文字层 ───────────────────────────────────────────────
    const renderTextLayer = useCallback(async (fc: Canvas) => {
      if (!style || !copy) return;
      await ensureGoogleFont(style.fontStyle);
      clearTextLayer(fc);

      // 装饰分隔线
      const divider = new Rect({
        left:       posterWidth * 0.30,
        top:        posterHeight * 0.655,
        width:      posterWidth * 0.40,
        height:     1.5,
        fill:       'rgba(255,255,255,0.35)',
        selectable: false,
        evented:    false,
      });
      setData(divider, { tag: DIVIDER_TAG });
      fc.add(divider);

      const configs = layoutPoster({
        style,
        copy,
        visibility:   DEFAULT_VISIBILITY,
        languageMode,
        canvasWidth:  posterWidth,
        canvasHeight: posterHeight,
      });
      configs.forEach((cfg) => addTextElement(fc, cfg));
      bringTextLayerToFront(fc);
      fc.requestRenderAll();
    }, [style, copy, languageMode, posterWidth, posterHeight]);

    // ── 注册智能对齐 + 键盘事件 ──────────────────────────────────
    const setupInteractions = useCallback((fc: Canvas) => {

      // --- 拖拽时智能对齐 ---
      fc.on('object:moving', ({ target }) => {
        if (!target) return;
        const { dx, dy } = applySnapping(fc, target, posterWidth, posterHeight);
        if (dx !== 0 || dy !== 0) {
          // 在逻辑坐标中修正位置
          const zoom = fc.getZoom();
          target.set({
            left: (target.left ?? 0) + dx * zoom,
            top:  (target.top  ?? 0) + dy * zoom,
          });
        }
        fc.requestRenderAll();
      });

      // --- 拖拽结束：清除辅助线 ---
      fc.on('object:modified', () => {
        clearGuides(fc);
        fc.requestRenderAll();
      });

      // --- 键盘：方向键移动 / Delete / ESC ---
      const onKeyDown = (e: KeyboardEvent) => {
        const target = fc.getActiveObject();

        // ESC → 取消选中
        if (e.key === 'Escape') {
          fc.discardActiveObject();
          fc.requestRenderAll();
          return;
        }

        // Delete / Backspace → 删除（文字编辑中不触发）
        if ((e.key === 'Delete' || e.key === 'Backspace') && target) {
          // 如果是 Textbox 且正在编辑中，不拦截
          if (target instanceof Textbox && (target as Textbox).isEditing) return;
          fc.remove(target);
          fc.discardActiveObject();
          fc.requestRenderAll();
          e.preventDefault();
          return;
        }

        // 方向键移动
        const isArrow = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key);
        if (!isArrow || !target) return;
        if (target instanceof Textbox && (target as Textbox).isEditing) return;

        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const z    = zoomRef.current;
        switch (e.key) {
          case 'ArrowLeft':  target.set('left', (target.left ?? 0) - step * z); break;
          case 'ArrowRight': target.set('left', (target.left ?? 0) + step * z); break;
          case 'ArrowUp':    target.set('top',  (target.top  ?? 0) - step * z); break;
          case 'ArrowDown':  target.set('top',  (target.top  ?? 0) + step * z); break;
        }
        target.setCoords();
        fc.requestRenderAll();
      };

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [posterWidth, posterHeight]);

    // ── 初始化 ───────────────────────────────────────────────────
    useEffect(() => {
      if (!canvasElRef.current || fabricRef.current) return;

      const fz = calcFitZoom();
      setFitZoom(fz);
      setZoomState(fz);
      zoomRef.current = fz;

      const fc = new Canvas(canvasElRef.current, {
        width:  posterWidth  * fz,
        height: posterHeight * fz,
        selection: true,
        preserveObjectStacking: true,
        backgroundColor: '#1a1a1a',
      });
      fc.setZoom(fz);
      fabricRef.current = fc;

      if (backgroundUrl) loadBackground(fc, backgroundUrl);
      if (dishUrl)       loadDishImage(fc, dishUrl);
      if (style && copy) renderTextLayer(fc);

      const cleanup = setupInteractions(fc);

      return () => {
        cleanup();
        fc.dispose();
        fabricRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 背景图变化 ───────────────────────────────────────────────
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc || !backgroundUrl) return;
      loadBackground(fc, backgroundUrl);
    }, [backgroundUrl, loadBackground]);

    // ── 菜品图变化 ───────────────────────────────────────────────
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc || !dishUrl) return;
      loadDishImage(fc, dishUrl);
    }, [dishUrl, loadDishImage]);

    // ── 背景调节参数变化 ─────────────────────────────────────────
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc || !backgroundUrl) return;
      loadBackground(fc, backgroundUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [brightness, blur, warmth]);

    // ── 文案 / 风格变化 ──────────────────────────────────────────
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc) return;
      renderTextLayer(fc);
    }, [renderTextLayer]);

    // ── Window resize ────────────────────────────────────────────
    useEffect(() => {
      const onResize = () => {
        const fz = calcFitZoom();
        setFitZoom(fz);
        applyZoom(fz);
      };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, [calcFitZoom, applyZoom]);

    // ── 滚轮缩放（Ctrl/Cmd + wheel） ─────────────────────────────
    useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        applyZoom(zoomRef.current + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP));
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, [applyZoom]);

    // ── 暴露给父组件 ─────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getCanvas: () => fabricRef.current,
      exportPng: () => {
        const fc = fabricRef.current;
        if (!fc) return '';
        // 导出前清除辅助线
        clearGuides(fc);
        const cz = fc.getZoom();
        fc.setZoom(1);
        fc.setDimensions({ width: posterWidth, height: posterHeight });
        const dataUrl = fc.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
        fc.setZoom(cz);
        fc.setDimensions({ width: posterWidth * cz, height: posterHeight * cz });
        fc.requestRenderAll();
        return dataUrl;
      },
      setZoom: applyZoom,
      refreshTextLayer: async () => {
        const fc = fabricRef.current;
        if (fc) await renderTextLayer(fc);
      },
    }), [applyZoom, posterWidth, posterHeight, renderTextLayer]);

    const zoomPct = Math.round(zoom * 100);

    return (
      <div
        ref={wrapperRef}
        className="relative flex-1 flex items-center justify-center bg-neutral-800 overflow-auto"
        style={{ minHeight: 0 }}
      >
        <div className="shadow-2xl">
          <canvas ref={canvasElRef} />
        </div>

        {/* 缩放控制条 */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 select-none">
          <button
            title="缩小 (Ctrl -)"
            onClick={() => applyZoom(zoomRef.current - ZOOM_STEP)}
            className="text-neutral-300 hover:text-white transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs text-neutral-200 w-12 text-center tabular-nums">
            {zoomPct}%
          </span>

          <button
            title="放大 (Ctrl +)"
            onClick={() => applyZoom(zoomRef.current + ZOOM_STEP)}
            className="text-neutral-300 hover:text-white transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-3 bg-neutral-600 mx-1" />

          <button
            title="适配屏幕"
            onClick={() => applyZoom(fitZoom)}
            className="text-neutral-300 hover:text-white transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  },
);

export default PosterCanvas;
