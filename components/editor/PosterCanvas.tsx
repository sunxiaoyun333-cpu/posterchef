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
  /** 文字内容编辑完成后回调，返回 {type, text} */
  onTextEdited?:  (type: string, text: string) => void;
}

export interface PosterCanvasHandle {
  getCanvas:        () => Canvas | null;
  /** multiplier: 1 = 屏幕分辨率, 2 = 2x, 3 = 3x (印刷级) */
  exportPng:        (multiplier?: number) => string;
  exportJpg:        (multiplier?: number, quality?: number) => string;
  setZoom:          (z: number) => void;
  refreshTextLayer: () => Promise<void>;
}

// ── 常量 ─────────────────────────────────────────────────────────
const MIN_ZOOM       = 0.1;
const MAX_ZOOM       = 3;
const ZOOM_STEP      = 0.1;
const SNAP_THRESHOLD = 5;
const TEXT_LAYER_TAG = 'text_layer';
const DIVIDER_TAG    = 'divider';
const GUIDE_TAG      = '__guide__';

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

// ── 辅助：读写 data 属性（Fabric 6 无类型） ───────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getData = (o: FabricObject): any => (o as any).data;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setData = (o: FabricObject, v: any) => { (o as any).data = v; };

// ── 辅助线 ───────────────────────────────────────────────────────
function makeGuide(x1: number, y1: number, x2: number, y2: number): Line {
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

function clearGuides(fc: Canvas) {
  fc.getObjects()
    .filter((o) => getData(o)?.tag === GUIDE_TAG)
    .forEach((o) => fc.remove(o));
}

// ── 智能对齐 ─────────────────────────────────────────────────────
interface SnapResult { dx: number; dy: number }

function applySnapping(fc: Canvas, moving: FabricObject, posterW: number, posterH: number): SnapResult {
  clearGuides(fc);

  const mBound = moving.getBoundingRect();
  const zoom   = fc.getZoom();

  const mL  = mBound.left   / zoom;
  const mT  = mBound.top    / zoom;
  const mR  = mL + mBound.width  / zoom;
  const mB  = mT + mBound.height / zoom;
  const mCX = (mL + mR) / 2;
  const mCY = (mT + mB) / 2;

  const cCX = posterW / 2;
  const cCY = posterH / 2;

  const others = fc.getObjects().filter((o) => {
    if (o === moving) return false;
    if (!o.selectable) return false;
    return getData(o)?.tag !== GUIDE_TAG;
  });

  const guides: Line[] = [];
  let dx = 0, dy = 0;
  let snappedX = false, snappedY = false;

  const xCandidates: { val: number }[] = [
    { val: 0 }, { val: cCX }, { val: posterW },
  ];
  others.forEach((o) => {
    const b  = o.getBoundingRect();
    const oL = b.left / zoom;
    const oR = oL + b.width / zoom;
    xCandidates.push({ val: oL }, { val: oR }, { val: (oL + oR) / 2 });
  });

  const yCandidates: { val: number }[] = [
    { val: 0 }, { val: cCY }, { val: posterH },
  ];
  others.forEach((o) => {
    const b  = o.getBoundingRect();
    const oT = b.top / zoom;
    const oB = oT + b.height / zoom;
    yCandidates.push({ val: oT }, { val: oB }, { val: (oT + oB) / 2 });
  });

  let bestX: { dist: number; snap: number; objVal: number } | null = null;
  for (const { val } of xCandidates) {
    for (const objVal of [mL, mCX, mR]) {
      const dist = Math.abs(objVal - val);
      if (dist < SNAP_THRESHOLD && (!bestX || dist < bestX.dist)) {
        bestX = { dist, snap: val, objVal };
      }
    }
  }
  if (bestX && !snappedX) {
    dx = bestX.snap - bestX.objVal;
    snappedX = true;
    guides.push(makeGuide(bestX.snap, 0, bestX.snap, posterH));
  }

  let bestY: { dist: number; snap: number; objVal: number } | null = null;
  for (const { val } of yCandidates) {
    for (const objVal of [mT, mCY, mB]) {
      const dist = Math.abs(objVal - val);
      if (dist < SNAP_THRESHOLD && (!bestY || dist < bestY.dist)) {
        bestY = { dist, snap: val, objVal };
      }
    }
  }
  if (bestY && !snappedY) {
    dy = bestY.snap - bestY.objVal;
    snappedY = true;
    guides.push(makeGuide(0, bestY.snap, posterW, bestY.snap));
  }

  guides.forEach((g) => fc.add(g));
  return { dx, dy };
}

// ── 把 TextElementConfig 渲染为 Fabric 对象 ──────────────────────
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
    // 双击可进入编辑模式
    editable:        true,
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
      onTextEdited,
    },
    ref,
  ) {
    const wrapperRef  = useRef<HTMLDivElement>(null);
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef   = useRef<Canvas | null>(null);
    const zoomRef     = useRef(1);

    // 用 ref 持有最新的回调，避免 stale closure
    const onTextEditedRef = useRef(onTextEdited);
    useEffect(() => { onTextEditedRef.current = onTextEdited; }, [onTextEdited]);

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

    // ── 加载背景图 ───────────────────────────────────────────────
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
          left:        posterWidth  / 2,
          top:         posterHeight * 0.35,
          originX:     'center',
          originY:     'center',
          hasControls: true,
          hasBorders:  true,
        });
        setData(img, { key: 'dish' });
        fc.add(img);
        bringTextLayerToFront(fc);
        fc.requestRenderAll();
      } catch { /* 静默 */ }
    }, [posterWidth, posterHeight]);

    // ── 文字层工具 ───────────────────────────────────────────────
    function bringTextLayerToFront(fc: Canvas) {
      fc.getObjects()
        .filter((o) => {
          const tag = getData(o)?.tag;
          return tag === TEXT_LAYER_TAG || tag === DIVIDER_TAG;
        })
        .forEach((o) => fc.bringObjectToFront(o));
    }

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

    // ── 注册交互事件 ─────────────────────────────────────────────
    const setupInteractions = useCallback((fc: Canvas) => {

      // --- 拖拽吸附 ---
      fc.on('object:moving', ({ target }) => {
        if (!target) return;
        const { dx, dy } = applySnapping(fc, target, posterWidth, posterHeight);
        if (dx !== 0 || dy !== 0) {
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

      // --- 双击 → 进入文字编辑模式 ---
      fc.on('mouse:dblclick', ({ target }) => {
        if (!target) return;
        if (target instanceof Textbox && target.selectable) {
          fc.setActiveObject(target);
          target.enterEditing();
          target.selectAll();
          fc.requestRenderAll();
        }
      });

      // --- 文字编辑结束：触发回调 ---
      fc.on('text:editing:exited', ({ target }) => {
        if (!target) return;
        const tb   = target as Textbox;
        const data = getData(tb as unknown as FabricObject);
        const type = data?.type ?? '';
        const text = (tb.text as string) ?? '';
        if (type && onTextEditedRef.current) {
          onTextEditedRef.current(type, text);
        }
        // 同时确保 PropertyPanel 也能感知到（触发 object:modified）
        fc.fire('object:modified', { target: tb as unknown as FabricObject });
      });

      // --- ESC 退出文字编辑（Fabric 已内置，这里补 canvas-level ESC） ---
      const onKeyDown = (e: KeyboardEvent) => {
        const target = fc.getActiveObject();

        if (e.key === 'Escape') {
          // 如果正在编辑文字，先退出编辑，再取消选中
          if (target instanceof Textbox && (target as Textbox).isEditing) {
            (target as Textbox).exitEditing();
            fc.requestRenderAll();
          } else {
            fc.discardActiveObject();
            fc.requestRenderAll();
          }
          return;
        }

        if ((e.key === 'Delete' || e.key === 'Backspace') && target) {
          if (target instanceof Textbox && (target as Textbox).isEditing) return;
          fc.remove(target);
          fc.discardActiveObject();
          fc.requestRenderAll();
          e.preventDefault();
          return;
        }

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

    // ── 滚轮缩放 ─────────────────────────────────────────────────
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
      exportPng: (multiplier = 1) => {
        const fc = fabricRef.current;
        if (!fc) return '';
        clearGuides(fc);
        const cz = fc.getZoom();
        fc.setZoom(1);
        fc.setDimensions({ width: posterWidth, height: posterHeight });
        const dataUrl = fc.toDataURL({ format: 'png', quality: 1, multiplier });
        fc.setZoom(cz);
        fc.setDimensions({ width: posterWidth * cz, height: posterHeight * cz });
        fc.requestRenderAll();
        return dataUrl;
      },
      exportJpg: (multiplier = 1, quality = 0.92) => {
        const fc = fabricRef.current;
        if (!fc) return '';
        clearGuides(fc);
        const cz = fc.getZoom();
        fc.setZoom(1);
        fc.setDimensions({ width: posterWidth, height: posterHeight });
        const dataUrl = fc.toDataURL({ format: 'jpeg', quality, multiplier });
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
