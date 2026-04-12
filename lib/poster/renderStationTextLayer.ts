/**
 * 分拣站预览：在 Fabric Canvas 上按「中 / 英 / 双语」拆分为独立 IText，切换时整层重绘以实现增删与重排。
 */
import { IText, Rect } from 'fabric';
import type { Canvas } from 'fabric';
import type {
  ContentLabelId,
  ContentStationState,
  LabelEditorState,
} from '@/components/ContentSelectionStation';

/** 与 PosterCanvas bring-to-front 联动 */
export const STATION_LINE_TAG = 'station_text';

function alphaFromHex(hex: string, a: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return `rgba(255,255,255,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function clearStationLayer(fc: Canvas): void {
  [...fc.getObjects()].forEach((o) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (o as any).data as { stationBg?: boolean; tag?: string } | undefined;
    if (d?.stationBg || d?.tag === STATION_LINE_TAG) {
      fc.remove(o);
    }
  });
}

function row(state: ContentStationState, id: ContentLabelId): LabelEditorState | undefined {
  return state.labels[id];
}

/** 双语时两行间距（逻辑像素） */
function lineGap(lw: number): number {
  return Math.max(10, Math.round(lw * 0.028));
}

interface LineSpec {
  text: string;
  top: number;
  fontSize: number;
  fontWeight?: string | number;
  fill?: string;
  fontFamily: string;
  fontStyle?: string;
  textAlign: 'left' | 'center' | 'right';
  originX: 'left' | 'center';
  originY: 'top' | 'center';
  left: number;
  labelId: ContentLabelId;
  lang: 'cn' | 'en';
}

function collectLines(
  state: ContentStationState,
  lw: number,
  lh: number,
  textColor: string,
  fontCn: string,
  fontEn: string,
): LineSpec[] {
  const alpha = (a: number) => alphaFromHex(textColor, a);
  const gap = lineGap(lw);
  const specs: LineSpec[] = [];
  const scene = state.activeScene;

  const pushDual = (
    id: ContentLabelId,
    base: Omit<LineSpec, 'text' | 'lang' | 'fontFamily' | 'fill' | 'labelId'> & {
      fontSize: number;
      top: number;
      fontWeight?: string | number;
      fill?: string;
    },
  ) => {
    const r = row(state, id);
    if (!r?.visible) return;
    if (r.language === 'cn') {
      const t = r.cn.trim();
      if (!t) return;
      specs.push({
        ...base,
        text: t,
        lang: 'cn',
        fontFamily: fontCn,
        fill: base.fill ?? textColor,
        labelId: id,
      });
      return;
    }
    if (r.language === 'en') {
      const t = r.en.trim();
      if (!t) return;
      specs.push({
        ...base,
        text: t,
        lang: 'en',
        fontFamily: fontEn,
        fill: base.fill ?? textColor,
        labelId: id,
      });
      return;
    }
    /* both */
    const cn = r.cn.trim();
    const en = r.en.trim();
    let y = base.top;
    if (cn) {
      specs.push({
        ...base,
        top: y,
        text: cn,
        lang: 'cn',
        fontFamily: fontCn,
        fill: base.fill ?? textColor,
        labelId: id,
      });
      y += base.fontSize * 1.15 + gap * 0.35;
    }
    if (en) {
      specs.push({
        ...base,
        top: y,
        text: en,
        lang: 'en',
        fontFamily: fontEn,
        fill: base.fill ?? alpha(0.88),
        fontStyle: 'italic',
        labelId: id,
      });
    }
  };

  if (scene === 'offline') {
    const c = (id: ContentLabelId, top: number, fs: number, fw?: string | number, fill?: string) =>
      pushDual(id, {
        left: lw / 2,
        top,
        fontSize: fs,
        fontWeight: fw,
        fill,
        textAlign: 'center',
        originX: 'center',
        originY: 'top',
      });
    c('main_title', lh * 0.26, Math.round(lw * 0.078), 'bold');
    c('sub_title', lh * 0.38, Math.round(lw * 0.038));
    c('extra_text', lh * 0.5, Math.round(lw * 0.028), undefined, alpha(0.92));
    c('store_name', lh * 0.62, Math.round(lw * 0.032), 'bold');
    c('address', lh * 0.69, Math.round(lw * 0.024), undefined, alpha(0.85));
  } else {
    const pad = lw * 0.06;
    const L = (id: ContentLabelId, top: number, fs: number, fw?: string | number, fill?: string) =>
      pushDual(id, {
        left: pad,
        top,
        fontSize: fs,
        fontWeight: fw,
        fill,
        textAlign: 'left',
        originX: 'left',
        originY: 'top',
      });
    L('store_name', lh * 0.58, Math.round(lw * 0.028), 'bold', alpha(0.95));
    L('main_title', lh * 0.615, Math.round(lw * 0.056), 'bold');
    L('sub_title', lh * 0.7, Math.round(lw * 0.034), undefined, alpha(0.92));
    L('extra_text', lh * 0.77, Math.round(lw * 0.026), undefined, alpha(0.78));
    L('address', lh * 0.845, Math.round(lw * 0.022), undefined, alpha(0.7));
  }

  /* QR：仅 DIY 槽位；语言模式同样拆行 */
  const rQr = row(state, 'qr_content');
  if (scene !== 'offline' && rQr?.visible) {
    const pad = lw * 0.06;
    const box = Math.round(lw * 0.14);
    const left = lw - pad - box;
    const top = lh - pad - box - lh * 0.04;
    /* 外框由调用方在 render 末尾画，这里只收集文字行 — 简化为框内单行或双行 */
    if (rQr.language === 'cn' && rQr.cn.trim()) {
      specs.push({
        left: left + box / 2,
        top: top + box / 2,
        fontSize: Math.max(10, Math.round(box * 0.11)),
        text: rQr.cn.trim(),
        lang: 'cn',
        fontFamily: fontCn,
        fill: '#333',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        labelId: 'qr_content',
      });
    } else if (rQr.language === 'en' && rQr.en.trim()) {
      specs.push({
        left: left + box / 2,
        top: top + box / 2,
        fontSize: Math.max(10, Math.round(box * 0.11)),
        text: rQr.en.trim(),
        lang: 'en',
        fontFamily: fontEn,
        fill: '#333',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        labelId: 'qr_content',
      });
    } else if (rQr.language === 'both') {
      const cn = rQr.cn.trim();
      const en = rQr.en.trim();
      let ty = top + box * 0.32;
      if (cn) {
        specs.push({
          left: left + box / 2,
          top: ty,
          fontSize: Math.max(9, Math.round(box * 0.09)),
          text: cn,
          lang: 'cn',
          fontFamily: fontCn,
          fill: '#333',
          textAlign: 'center',
          originX: 'center',
          originY: 'top',
          labelId: 'qr_content',
        });
        ty += Math.max(9, Math.round(box * 0.09)) * 1.1;
      }
      if (en) {
        specs.push({
          left: left + box / 2,
          top: ty,
          fontSize: Math.max(8, Math.round(box * 0.075)),
          text: en,
          lang: 'en',
          fontFamily: fontEn,
          fill: '#555',
          fontStyle: 'italic',
          textAlign: 'center',
          originX: 'center',
          originY: 'top',
          labelId: 'qr_content',
        });
      }
    }
  }

  return specs;
}

export function renderStationTextLayer(
  fc: Canvas,
  options: {
    state: ContentStationState;
    lw: number;
    lh: number;
    textColor: string;
    fontFamilyCn: string;
    fontFamilyEn: string;
  },
): void {
  const { state, lw, lh, textColor, fontFamilyCn, fontFamilyEn } = options;
  clearStationLayer(fc);

  if (state.activeScene === 'clean') {
    fc.requestRenderAll();
    return;
  }

  const alpha = (a: number) => alphaFromHex(textColor, a);

  if (state.activeScene === 'offline') {
    fc.add(
      new Rect({
        left: 0,
        top: lh * 0.52,
        width: lw,
        height: lh * 0.48,
        fill: 'rgba(0,0,0,0.35)',
        selectable: false,
        evented: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { stationBg: true } as any,
      }),
    );
  } else {
    fc.add(
      new Rect({
        left: 0,
        top: lh * 0.55,
        width: lw,
        height: lh * 0.45,
        fill: 'rgba(0,0,0,0.42)',
        selectable: false,
        evented: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { stationBg: true } as any,
      }),
    );
  }

  const lines = collectLines(state, lw, lh, textColor, fontFamilyCn, fontFamilyEn);

  const rQr = row(state, 'qr_content');
  if (state.activeScene !== 'offline' && rQr?.visible) {
    const pad = lw * 0.06;
    const box = Math.round(lw * 0.14);
    const left = lw - pad - box;
    const top = lh - pad - box - lh * 0.04;
    fc.add(
      new Rect({
        left,
        top,
        width: box,
        height: box,
        fill: '#ffffff',
        stroke: alphaFromHex('#888888', 0.5),
        strokeWidth: 1,
        rx: 8,
        ry: 8,
        selectable: false,
        evented: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { stationBg: true, qrFrame: true } as any,
      }),
    );
  }

  for (const s of lines) {
    fc.add(
      new IText(s.text, {
        left: s.left,
        top: s.top,
        originX: s.originX,
        originY: s.originY,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        fontStyle: (s.fontStyle as 'normal' | 'italic') ?? 'normal',
        fill: s.fill ?? textColor,
        fontFamily: s.fontFamily,
        textAlign: s.textAlign,
        selectable: true,
        editable: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          tag: STATION_LINE_TAG,
          type: 'station',
          stationLabel: s.labelId,
          stationLang: s.lang,
        } as any,
      }),
    );
  }

  fc.requestRenderAll();
}

export function clearStationPreview(fc: Canvas): void {
  clearStationLayer(fc);
  fc.requestRenderAll();
}
