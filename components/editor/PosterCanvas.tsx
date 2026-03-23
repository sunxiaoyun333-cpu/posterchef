'use client';

import {
  useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle,
} from 'react';
import { Canvas, FabricImage, filters as FabricFilters } from 'fabric';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// ── 类型 ─────────────────────────────────────────────────────────
export interface PosterCanvasProps {
  /** 逻辑海报宽度（px） */
  posterWidth: number;
  /** 逻辑海报高度（px） */
  posterHeight: number;
  /** 背景图 URL（base64 / blob / http） */
  backgroundUrl?: string | null;
  /** 菜品图 URL（抠图后透明 PNG） */
  dishUrl?: string | null;
  /** 背景亮度 -1 ~ 1，默认 0 */
  brightness?: number;
  /** 背景模糊 0 ~ 20，默认 0 */
  blur?: number;
  /** 背景暖色调 -1 ~ 1，默认 0（>0 暖，<0 冷） */
  warmth?: number;
}

export interface PosterCanvasHandle {
  /** 返回当前 Fabric Canvas 实例（供父组件操作对象） */
  getCanvas: () => Canvas | null;
  /** 导出为 PNG data URL（缩放回原始尺寸） */
  exportPng: () => string;
  /** 设置画布缩放比例 */
  setZoom: (z: number) => void;
}

// ── 常量 ─────────────────────────────────────────────────────────
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

// ── 组件 ─────────────────────────────────────────────────────────
const PosterCanvas = forwardRef<PosterCanvasHandle, PosterCanvasProps>(
  function PosterCanvas(
    {
      posterWidth,
      posterHeight,
      backgroundUrl,
      dishUrl,
      brightness = 0,
      blur = 0,
      warmth = 0,
    },
    ref,
  ) {
    const wrapperRef   = useRef<HTMLDivElement>(null);   // 外层容器（灰色背景）
    const canvasElRef  = useRef<HTMLCanvasElement>(null);
    const fabricRef    = useRef<Canvas | null>(null);

    const [zoom,    setZoomState] = useState(1);          // 当前缩放倍率
    const [fitZoom, setFitZoom]   = useState(1);          // 适配容器时的 zoom

    // ── 计算适配缩放 ─────────────────────────────────────────────
    const calcFitZoom = useCallback(() => {
      if (!wrapperRef.current) return 1;
      const { clientWidth: w, clientHeight: h } = wrapperRef.current;
      const padding = 48; // 留边
      return Math.min(
        (w - padding) / posterWidth,
        (h - padding) / posterHeight,
        1,
      );
    }, [posterWidth, posterHeight]);

    // ── 应用 zoom 到 Fabric Canvas ────────────────────────────────
    const applyZoom = useCallback((z: number) => {
      const fc = fabricRef.current;
      if (!fc) return;
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
      fc.setZoom(clamped);
      fc.setDimensions({
        width:  posterWidth  * clamped,
        height: posterHeight * clamped,
      });
      setZoomState(clamped);
    }, [posterWidth, posterHeight]);

    // ── 加载背景图 ───────────────────────────────────────────────
    const loadBackground = useCallback(async (fc: Canvas, url: string) => {
      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });

        // 拉伸填满海报
        img.set({
          left: 0,
          top:  0,
          scaleX: posterWidth  / (img.width  ?? posterWidth),
          scaleY: posterHeight / (img.height ?? posterHeight),
          selectable: false,
          evented:    false,
          excludeFromExport: false,
        });

        // 应用 Fabric filters
        const imgFilters: InstanceType<typeof FabricFilters.BaseFilter>[] = [];

        if (brightness !== 0) {
          imgFilters.push(new FabricFilters.Brightness({ brightness }));
        }
        if (blur > 0) {
          imgFilters.push(new FabricFilters.Blur({ blur: blur / 20 })); // Fabric blur 0-1
        }
        if (warmth !== 0) {
          // 用 ColorMatrix 模拟暖/冷色调：暖=提红降蓝，冷=反之
          const w = warmth * 0.3;
          imgFilters.push(
            new FabricFilters.ColorMatrix({
              matrix: [
                1 + w, 0, 0, 0, 0,
                0,     1, 0, 0, 0,
                0,     0, 1 - w, 0, 0,
                0,     0, 0, 1, 0,
              ],
            }),
          );
        }

        img.filters = imgFilters;
        img.applyFilters();

        fc.backgroundImage = img;
        fc.requestRenderAll();
      } catch {
        // 背景图加载失败时静默跳过
      }
    }, [posterWidth, posterHeight, brightness, blur, warmth]);

    // ── 加载菜品图 ───────────────────────────────────────────────
    const loadDishImage = useCallback(async (fc: Canvas, url: string) => {
      // 先移除旧的菜品图（data.key === 'dish'）
      fc.getObjects().forEach((obj) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((obj as any).data?.key === 'dish') fc.remove(obj);
      });

      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
        const maxW = posterWidth  * 0.75;
        const maxH = posterHeight * 0.55;
        const ratio = Math.min(maxW / (img.width ?? 1), maxH / (img.height ?? 1));

        img.scale(ratio);
        img.set({
          left:    posterWidth  / 2,
          top:     posterHeight * 0.38,
          originX: 'center',
          originY: 'center',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { key: 'dish' } as any,
        });

        fc.add(img);
        fc.requestRenderAll();
      } catch {
        // 菜品图加载失败时静默跳过
      }
    }, [posterWidth, posterHeight]);

    // ── 初始化 Fabric Canvas ─────────────────────────────────────
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

      // 加载初始图层
      if (backgroundUrl) loadBackground(fc, backgroundUrl);
      if (dishUrl)        loadDishImage(fc, dishUrl);

      return () => {
        fc.dispose();
        fabricRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 背景图变化时重新加载 ─────────────────────────────────────
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc || !backgroundUrl) return;
      loadBackground(fc, backgroundUrl);
    }, [backgroundUrl, loadBackground]);

    // ── 菜品图变化时重新加载 ─────────────────────────────────────
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc || !dishUrl) return;
      loadDishImage(fc, dishUrl);
    }, [dishUrl, loadDishImage]);

    // ── 背景调节参数变化时重新应用 ───────────────────────────────
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc || !backgroundUrl) return;
      loadBackground(fc, backgroundUrl);
    // brightness / blur / warmth 变化触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [brightness, blur, warmth]);

    // ── 窗口 resize → 重新适配 ───────────────────────────────────
    useEffect(() => {
      const onResize = () => {
        const fz = calcFitZoom();
        setFitZoom(fz);
        applyZoom(fz);
      };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, [calcFitZoom, applyZoom]);

    // ── 鼠标滚轮缩放 ────────────────────────────────────────────
    useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;

      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return; // 仅 Ctrl/Cmd + 滚轮触发
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        applyZoom(zoom + delta);
      };

      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, [zoom, applyZoom]);

    // ── 暴露给父组件的方法 ───────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getCanvas: () => fabricRef.current,
      exportPng: () => {
        const fc = fabricRef.current;
        if (!fc) return '';
        const currentZoom = fc.getZoom();
        fc.setZoom(1);
        fc.setDimensions({ width: posterWidth, height: posterHeight });
        const dataUrl = fc.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
        fc.setZoom(currentZoom);
        fc.setDimensions({ width: posterWidth * currentZoom, height: posterHeight * currentZoom });
        fc.requestRenderAll();
        return dataUrl;
      },
      setZoom: applyZoom,
    }), [applyZoom, posterWidth, posterHeight]);

    const zoomPct = Math.round(zoom * 100);

    return (
      <div
        ref={wrapperRef}
        className="relative flex-1 flex items-center justify-center bg-neutral-800 overflow-auto"
        style={{ minHeight: 0 }}
      >
        {/* 画布本体 */}
        <div className="shadow-2xl">
          <canvas ref={canvasElRef} />
        </div>

        {/* 缩放比例角标 */}
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
