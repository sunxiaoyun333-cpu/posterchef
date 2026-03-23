// ============================================================
// lib/templates/layoutEngine.ts
// 排版引擎：根据风格模板 + 文案内容 → Fabric 对象配置数组
// ============================================================

import type { StyleTemplate, CopySet } from '@/lib/types';

// ── 对外暴露的类型 ────────────────────────────────────────────────

export type LanguageMode = 'bilingual' | 'cn_only' | 'en_only';

export interface CopyVisibility {
  headline:    boolean;
  subheadline: boolean;
  tagline:     boolean;
  price:       boolean;
  promoTag:    boolean;
  spiceLevel:  boolean;
}

export const DEFAULT_VISIBILITY: CopyVisibility = {
  headline:    true,
  subheadline: true,
  tagline:     true,
  price:       true,
  promoTag:    true,
  spiceLevel:  true,
};

// 每个文字元素的配置，交给 PosterCanvas 创建 Fabric 对象
export type TextElementType =
  | 'mainTitle'
  | 'subTitle'
  | 'tagline'
  | 'price'
  | 'priceOriginal'   // 原价（删除线）
  | 'promoTag'        // 促销标签文字（放在 promoGroup 内）
  | 'promoGroup'      // 促销标签整体（Rect + Text）
  | 'spiceLevel';

export interface TextElementConfig {
  type:        TextElementType;
  text:        string;
  left:        number;   // 逻辑像素
  top:         number;   // 逻辑像素
  width:       number;   // Textbox 的 width
  fontSize:    number;
  fontFamily:  string;
  fontWeight:  string;
  fontStyle:   string;
  fill:        string;
  textAlign:   'left' | 'center' | 'right';
  lineHeight:  number;
  opacity:     number;
  selectable:  boolean;
  // 仅 price / promoTag 时用
  strikethrough?: boolean;
  // 促销背景色
  promoBgColor?:  string;
  promoWidth?:    number;
  promoHeight?:   number;
}

// ── 字体映射 ─────────────────────────────────────────────────────

const FONT_MAP: Record<StyleTemplate['fontStyle'], { cn: string; en: string }> = {
  serif:   { cn: 'Noto Serif SC',      en: 'Playfair Display' },
  sans:    { cn: 'Noto Sans SC',       en: 'Inter'            },
  display: { cn: 'ZCOOL KuaiLe',       en: 'Bebas Neue'       },
};

// Google Fonts URL（在 PosterCanvas 里加载）
export const GOOGLE_FONTS_URLS: Record<StyleTemplate['fontStyle'], string> = {
  serif:   'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap',
  sans:    'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Inter:wght@400;600;700&display=swap',
  display: 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Bebas+Neue&display=swap',
};

// ── 排版区域常量（基于 800×1000 逻辑画布） ────────────────────────
// 图片区：顶部 0 ~ 64%，文字区：65% ~ 98%
const TEXT_ZONE_TOP   = 0.655;  // 文字区起始 y 比例
const TEXT_ZONE_LEFT  = 0.06;   // 左边距比例
const TEXT_ZONE_RIGHT = 0.94;   // 右边距比例（即 width = 0.88 * W）

// ── 辅助：解析文案内容 ────────────────────────────────────────────

function resolveText(
  cn: string,
  en: string,
  mode: LanguageMode,
): string {
  if (mode === 'cn_only') return cn;
  if (mode === 'en_only') return en;
  // bilingual: 中英双行
  return en ? `${cn}\n${en}` : cn;
}

// ── 主函数 ────────────────────────────────────────────────────────

export function layoutPoster(params: {
  style:        StyleTemplate;
  copy:         CopySet;
  visibility:   CopyVisibility;
  languageMode: LanguageMode;
  canvasWidth:  number;
  canvasHeight: number;
}): TextElementConfig[] {
  const { style, copy, visibility, languageMode, canvasWidth, canvasHeight } = params;

  const fonts  = FONT_MAP[style.fontStyle];
  const W      = canvasWidth;
  const H      = canvasHeight;
  const LEFT   = W * TEXT_ZONE_LEFT;
  const ZONE_W = W * (TEXT_ZONE_RIGHT - TEXT_ZONE_LEFT);
  const CENTER = W / 2;

  const elements: TextElementConfig[] = [];

  // ── 当前 y 游标（从文字区顶部向下排） ──────────────────────────
  let y = H * TEXT_ZONE_TOP;

  // ── 装饰分隔线区域（不是文字，由 PosterCanvas 单独画 Rect） ────
  // 留出 30px 的分隔线空间
  y += 30;

  // ── ① 主标题 ────────────────────────────────────────────────
  if (visibility.headline) {
    const isBilingual = languageMode === 'bilingual';
    const cnText  = copy.headline;
    const enText  = copy.headlineEn;
    const cnSize  = 52;
    const enSize  = 26;

    if (languageMode !== 'en_only') {
      elements.push({
        type:       'mainTitle',
        text:       cnText,
        left:       LEFT,
        top:        y,
        width:      ZONE_W,
        fontSize:   cnSize,
        fontFamily: fonts.cn,
        fontWeight: 'bold',
        fontStyle:  'normal',
        fill:       '#ffffff',
        textAlign:  'center',
        lineHeight: 1.2,
        opacity:    1,
        selectable: true,
      });
      y += cnSize * 1.2 + 6;
    }

    if (isBilingual || languageMode === 'en_only') {
      elements.push({
        type:       languageMode === 'en_only' ? 'mainTitle' : 'subTitle',
        text:       enText,
        left:       LEFT,
        top:        y,
        width:      ZONE_W,
        fontSize:   enSize,
        fontFamily: fonts.en,
        fontWeight: languageMode === 'en_only' ? 'bold' : '400',
        fontStyle:  languageMode === 'bilingual' ? 'italic' : 'normal',
        fill:       languageMode === 'en_only' ? '#ffffff' : 'rgba(255,255,255,0.75)',
        textAlign:  'center',
        lineHeight: 1.2,
        opacity:    1,
        selectable: true,
      });
      y += enSize * 1.2 + 10;
    }
  }

  // ── ② 副标题 ────────────────────────────────────────────────
  if (visibility.subheadline && copy.subheadline) {
    const text = resolveText(copy.subheadline, copy.subheadlineEn ?? '', languageMode);
    const size = 18;
    elements.push({
      type:       'subTitle',
      text,
      left:       LEFT,
      top:        y,
      width:      ZONE_W,
      fontSize:   size,
      fontFamily: fonts.cn,
      fontWeight: '400',
      fontStyle:  'normal',
      fill:       'rgba(255,255,255,0.65)',
      textAlign:  'center',
      lineHeight: 1.4,
      opacity:    1,
      selectable: true,
    });
    y += size * 1.4 * (text.includes('\n') ? 2 : 1) + 10;
  }

  // ── ③ Tagline / slogan ──────────────────────────────────────
  if (visibility.tagline && copy.tagline) {
    const text = resolveText(copy.tagline, copy.taglineEn ?? '', languageMode);
    const size = 15;
    elements.push({
      type:       'tagline',
      text,
      left:       LEFT,
      top:        y,
      width:      ZONE_W,
      fontSize:   size,
      fontFamily: style.fontStyle === 'display' ? fonts.en : fonts.cn,
      fontWeight: '400',
      fontStyle:  style.fontStyle === 'serif' ? 'italic' : 'normal',
      fill:       'rgba(255,255,255,0.50)',
      textAlign:  'center',
      lineHeight: 1.5,
      opacity:    1,
      selectable: true,
    });
    y += size * 1.5 * (text.includes('\n') ? 2 : 1) + 12;
  }

  // ── ④ 价格 ──────────────────────────────────────────────────
  if (visibility.price && copy.price) {
    // 解析原价 / 折扣价格式: "$12.99" 或 "$12.99 → $9.99"
    const priceStr  = copy.price;
    const arrowIdx  = priceStr.indexOf('→');
    const hasDiscount = arrowIdx !== -1;

    if (hasDiscount) {
      // 原价（删除线）
      const originalPrice = priceStr.slice(0, arrowIdx).trim();
      elements.push({
        type:          'priceOriginal',
        text:          originalPrice,
        left:          CENTER - 90,
        top:           y,
        width:         160,
        fontSize:      22,
        fontFamily:    fonts.en,
        fontWeight:    '400',
        fontStyle:     'normal',
        fill:          'rgba(255,255,255,0.4)',
        textAlign:     'right',
        lineHeight:    1,
        opacity:       1,
        selectable:    true,
        strikethrough: true,
      });
      // 折扣价
      const discountPrice = priceStr.slice(arrowIdx + 1).trim();
      elements.push({
        type:       'price',
        text:       discountPrice,
        left:       CENTER,
        top:        y - 4,
        width:      160,
        fontSize:   34,
        fontFamily: fonts.en,
        fontWeight: 'bold',
        fontStyle:  'normal',
        fill:       style.accentColor,
        textAlign:  'left',
        lineHeight: 1,
        opacity:    1,
        selectable: true,
      });
    } else {
      elements.push({
        type:       'price',
        text:       priceStr,
        left:       LEFT,
        top:        y,
        width:      ZONE_W,
        fontSize:   34,
        fontFamily: fonts.en,
        fontWeight: 'bold',
        fontStyle:  'normal',
        fill:       style.accentColor,
        textAlign:  'center',
        lineHeight: 1,
        opacity:    1,
        selectable: true,
      });
    }
    y += 44;
  }

  // ── ⑤ 促销标签 ──────────────────────────────────────────────
  if (visibility.promoTag) {
    // 从 copy 里取 promo_tag（GeneratedCopy 格式）或 tagline 末尾
    const promoText = (copy as unknown as Record<string, string>).promo_tag
      ?? (copy as unknown as Record<string, string>).promoTagEn
      ?? '';

    if (promoText) {
      const pW = Math.min(200, promoText.length * 13 + 32);
      const pH = 36;
      elements.push({
        type:         'promoGroup',
        text:         promoText,
        left:         CENTER - pW / 2,
        top:          y,
        width:        pW,
        fontSize:     14,
        fontFamily:   fonts.en,
        fontWeight:   'bold',
        fontStyle:    'normal',
        fill:         '#ffffff',
        textAlign:    'center',
        lineHeight:   1,
        opacity:      1,
        selectable:   true,
        promoBgColor: style.primaryColor,
        promoWidth:   pW,
        promoHeight:  pH,
      });
      y += pH + 10;
    }
  }

  // ── ⑥ 辣度 ──────────────────────────────────────────────────
  if (visibility.spiceLevel) {
    const spice = (copy as unknown as Record<string, string>).spice_level ?? '';
    if (spice) {
      elements.push({
        type:       'spiceLevel',
        text:       spice,
        left:       LEFT,
        top:        y,
        width:      ZONE_W,
        fontSize:   20,
        fontFamily: 'Arial',
        fontWeight: '400',
        fontStyle:  'normal',
        fill:       'rgba(255,255,255,0.6)',
        textAlign:  'center',
        lineHeight: 1,
        opacity:    1,
        selectable: false,
      });
    }
  }

  return elements;
}
