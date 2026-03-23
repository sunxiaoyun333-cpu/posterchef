'use client';

import {
  useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle,
} from 'react';
import {
  Canvas, FabricImage, Textbox, Rect, Group,
  filters as FabricFilters,
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
  // 排版数据（可选；不传则不渲染文字层）
  style?:         StyleTemplate | null;
  copy?:          CopySet | null;
  languageMode?:  'bilingual' | 'cn_only' | 'en_only';
}

export interface PosterCanvasHandle {
  getCanvas: () => Canvas | null;
  exportPng: () => string;
  setZoom:   (z: number) => void;
  /** 重新渲染文字层（外部文案更新后调用） */
  refreshTextLayer: () => Promise<void>;
}

// ── 常量 ─────────────────────────────────────────────────────────
const MIN_ZOOM  = 0.1;
const MAX_ZOOM  = 3;
const ZOOM_STEP = 0.1;
const TEXT_LAYER_TAG = 'text_layer';
const DIVIDER_TAG    = 'divider';

// ── Google Fonts 加载（每个 fontStyle 只加载一次） ────────────────
const loadedFonts = new Set<string>();

async function ensureGoogleFont(fontStyle: StyleTemplate['fontStyle']): Promise<void> {
  if (loadedFonts.has(fontStyle)) return;
  loadedFonts.add(fontStyle);

  const url = GOOGLE_FONTS_URLS[fontStyle];
  if (!url) return;

  // 注入 <link> 标签
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);

  // 等待字体实际加载完成（最多 3s）
  await Promise.race([
    document.fonts.ready,
    new Promise<void>((r) => setTimeout(r, 3000)),
  ]);
}

// ── 把单个 TextElementConfig 渲染为 Fabric 对象并加到 canvas ──────
function addTextElement(fc: Canvas, cfg: TextElementConfig): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataBase = { tag: TEXT_LAYER_TAG, type: cfg.type } as any;

  if (cfg.type === 'promoGroup') {
    // 促销标签 = Rect 背景 + Textbox，打成 Group
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
      width:      cfg.promoWidth  ?? 160,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any).data = dataBase;
    fc.add(group);
    return;
  }

  // 普通文字（Textbox，支持双击编辑、自动换行）
  const tb = new Textbox(cfg.text, {
    left:        cfg.left,
    top:         cfg.top,
    width:       cfg.width,
    fontSize:    cfg.fontSize,
    fontFamily:  cfg.fontFamily,
    fontWeight:  cfg.fontWeight,
    fontStyle:   cfg.fontStyle as 'normal' | 'italic',
    fill:        cfg.fill,
    textAlign:   cfg.textAlign,
    lineHeight:  cfg.lineHeight,
    opacity:     cfg.opacity,
    selectable:  cfg.selectable,
    splitByGrapheme: false,
    data:        dataBase,
  });

  // 删除线（原价）
  if (cfg.strikethrough) {
    tb.set('overline', false);
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
      brightness = 0,
      blur       = 0,
      warmth     = 0,
      style      = null,
      copy       = null,
      languageMode = 'bilingual',
    },
    ref,
  ) {
    const wrapperRef  = useRef<HTMLDivElement>(null);
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef   = useRef<Canvas | null>(null);

    const [zoom,    setZoomState] = useState(1);
    const [fitZoom, setFitZoom]   = useState(1);

    // ── 计算适配缩放 ─────────────────────────────────────────────
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
    }, [posterWidth, posterHeight]);

    // ── 加载背景图 ───────────────────────────────────────────────
    const loadBackground = useCallback(async (fc: Canvas, url: string) => {
      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
        img.set({
          left:     0,
          top:      0,
          scaleX:   posterWidth  / (img.width  ?? posterWidth),
          scaleY:   posterHeight / (img.height ?? posterHeight),
          selectable:        false,
          evented:           false,
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
      } catch { /* 静默失败 */ }
    }, [posterWidth, posterHeight, brightness, blur, warmth]);

    // ── 加载菜品图 ───────────────────────────────────────────────
    const loadDishImage = useCallback(async (fc: Canvas, url: string) => {
      // 移除旧菜品图
      fc.getObjects().forEach((obj) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((obj as any).data?.key === 'dish') fc.remove(obj);
      });

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { key: 'dish' } as any,
        });
        fc.add(img);

        // 菜品图始终在文字层下方
        bringTextLayerToFront(fc);
        fc.requestRenderAll();
      } catch { /* 静默失败 */ }
    }, [posterWidth, posterHeight]);

    // ── 把文字层移到顶部 ─────────────────────────────────────────
    function bringTextLayerToFront(fc: Canvas) {
      const objs = fc.getObjects();
      // 先找分隔线，再找文字对象，统一移到顶部
      objs
        .filter((o) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = (o as any).data;
          return d?.tag === TEXT_LAYER_TAG || d?.tag === DIVIDER_TAG;
        })
        .forEach((o) => fc.bringObjectToFront(o));
    }

    // ── 清除文字层 ───────────────────────────────────────────────
    function clearTextLayer(fc: Canvas) {
      const toRemove = fc.getObjects().filter((o) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = (o as any).data;
        return d?.tag === TEXT_LAYER_TAG || d?.tag === DIVIDER_TAG;
      });
      toRemove.forEach((o) => fc.remove(o));
    }

    // ── 渲染文字层 ───────────────────────────────────────────────
    const renderTextLayer = useCallback(async (fc: Canvas) => {
      if (!style || !copy) return;

      // 1. 加载 Google Fonts
      await ensureGoogleFont(style.fontStyle);

      // 2. 清除旧文字层
      clearTextLayer(fc);

      // 3. 分隔线（装饰用 Rect）
      const divider = new Rect({
        left:       posterWidth * 0.30,
        top:        posterHeight * 0.655,
        width:      posterWidth * 0.40,
        height:     1.5,
        fill:       'rgba(255,255,255,0.35)',
        selectable: false,
        evented:    false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data:       { tag: DIVIDER_TAG } as any,
      });
      fc.add(divider);

      // 4. 排版引擎 → 配置数组
      const configs = layoutPoster({
        style,
        copy,
        visibility:   DEFAULT_VISIBILITY,
        languageMode,
        canvasWidth:  posterWidth,
        canvasHeight: posterHeight,
      });

      // 5. 逐一创建 Fabric 对象
      configs.forEach((cfg) => addTextElement(fc, cfg));

      // 6. 文字层置顶
      bringTextLayerToFront(fc);
      fc.requestRenderAll();
    }, [style, copy, languageMode, posterWidth, posterHeight]);

    // ── 初始化 ───────────────────────────────────────────────────
    useEffect(() => {
      if (!canvasElRef.current || fabricRef.current) return;

      const fz = calcFitZoom();
      setFitZoom(fz);
      setZoomState(fz);

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

      return () => { fc.dispose(); fabricRef.current = null; };
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

    // ── 文案 / 风格变化 → 重建文字层 ────────────────────────────
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc) return;
      renderTextLayer(fc);
    }, [renderTextLayer]);

    // ── resize ────────────────────────────────────────────────────
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
        applyZoom(zoom + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP));
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, [zoom, applyZoom]);

    // ── 暴露给父组件 ─────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getCanvas: () => fabricRef.current,
      exportPng: () => {
        const fc = fabricRef.current;
        if (!fc) return '';
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
            title="缩小"
            onClick={() => applyZoom(zoom - ZOOM_STEP)}
            className="text-neutral-300 hover:text-white transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs text-neutral-200 w-12 text-center tabular-nums">
            {zoomPct}%
          </span>

          <button
            title="放大"
            onClick={() => applyZoom(zoom + ZOOM_STEP)}
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
