/**
 * compositeEngine.ts — 服务端 Sharp 精细合成引擎
 *
 * 职责：
 *   1. 将背景图 resize 到目标画布尺寸
 *   2. 将菜品图（透明 PNG）居中放置
 *   3. 根据 lightingDirection 为菜品添加方向性投影阴影
 *   4. 返回合成后的 Buffer（PNG）
 *
 * 仅在服务端（Node.js）运行，不可 import 到客户端组件。
 */

import sharp from 'sharp';

// ── 类型 ──────────────────────────────────────────────────────────────

export interface CompositeParams {
  /** 背景图 base64（jpeg / png / webp 均可） */
  backgroundBase64:    string;
  /** 菜品图 base64（推荐透明背景 PNG） */
  dishBase64:          string;
  /** 光线方向，来自 DishInfo.lightingDirection */
  lightingDirection?:  'left' | 'right' | 'top' | 'front' | 'ambient';
  /** 目标画布宽度（px） */
  canvasWidth?:        number;
  /** 目标画布高度（px） */
  canvasHeight?:       number;
  /**
   * 菜品图在画布中的最大尺寸比例（0-1）
   * 默认 0.75（宽/高各不超过画布的 75%）
   */
  dishMaxRatio?:       number;
  /**
   * 菜品垂直中心位置（0 = 顶, 1 = 底），默认 0.45（略偏上）
   */
  dishCenterY?:        number;
}

export interface CompositeResult {
  buffer:   Buffer;
  mimeType: 'image/png';
  width:    number;
  height:   number;
}

// ── 阴影偏移映射 ──────────────────────────────────────────────────────

const SHADOW_OFFSET: Record<
  NonNullable<CompositeParams['lightingDirection']>,
  { dx: number; dy: number }
> = {
  left:    { dx:  14, dy:  8 },   // 光从左，阴影偏右下
  right:   { dx: -14, dy:  8 },   // 光从右，阴影偏左下
  top:     { dx:   0, dy: 14 },   // 光从上，阴影正下
  front:   { dx:   0, dy:  6 },   // 正面光，阴影浅
  ambient: { dx:   4, dy: 10 },   // 漫射光，右下微偏
};

const SHADOW_BLUR   = 18;   // px，阴影模糊半径
const SHADOW_OPACITY = 0.30; // 阴影不透明度

// ── 核心函数 ──────────────────────────────────────────────────────────

/**
 * 将菜品合成到背景上，附带方向性投影阴影。
 */
export async function compositeImages(
  params: CompositeParams,
): Promise<CompositeResult> {
  const {
    backgroundBase64,
    dishBase64,
    lightingDirection  = 'ambient',
    canvasWidth        = 800,
    canvasHeight       = 1000,
    dishMaxRatio       = 0.75,
    dishCenterY        = 0.45,
  } = params;

  // ── Step 1: 背景 resize 到画布尺寸 ──────────────────────────────
  const bgBuffer = Buffer.from(backgroundBase64, 'base64');
  const bgResized = await sharp(bgBuffer)
    .resize(canvasWidth, canvasHeight, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  // ── Step 2: 菜品图 resize（等比例，限制在 dishMaxRatio 内） ──────
  const dishBuffer = Buffer.from(dishBase64, 'base64');
  const dishMeta   = await sharp(dishBuffer).metadata();

  const maxW  = Math.floor(canvasWidth  * dishMaxRatio);
  const maxH  = Math.floor(canvasHeight * dishMaxRatio);
  const ratio = Math.min(
    maxW / (dishMeta.width  ?? maxW),
    maxH / (dishMeta.height ?? maxH),
  );
  const dishW = Math.max(1, Math.floor((dishMeta.width  ?? maxW)  * ratio));
  const dishH = Math.max(1, Math.floor((dishMeta.height ?? maxH) * ratio));

  const dishResized = await sharp(dishBuffer)
    .resize(dishW, dishH, { fit: 'inside' })
    .png()
    .toBuffer();

  // ── Step 3: 计算菜品居中位置 ────────────────────────────────────
  const dishLeft = Math.floor((canvasWidth  - dishW) / 2);
  const dishTop  = Math.floor(canvasHeight * dishCenterY - dishH / 2);

  // ── Step 4: 生成投影阴影层 ──────────────────────────────────────
  const { dx, dy } = SHADOW_OFFSET[lightingDirection];

  // 创建纯黑色副本（保留 alpha 通道形状），然后模糊
  const shadowBuffer = await sharp(dishResized)
    // 将 RGB 通道全部归零（变黑），alpha 保留
    .recomb([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ])
    .blur(SHADOW_BLUR / 2)   // sharp blur 参数是 sigma，约为半径的一半
    .toBuffer();

  // 用 raw 像素操作把阴影的 alpha 通道乘以 SHADOW_OPACITY
  const shadowMeta = await sharp(shadowBuffer).metadata();
  const shadowRaw  = await sharp(shadowBuffer).ensureAlpha().raw().toBuffer();
  const shadowChannels = 4; // RGBA
  for (let i = 3; i < shadowRaw.length; i += shadowChannels) {
    shadowRaw[i] = Math.round(shadowRaw[i] * SHADOW_OPACITY);
  }
  const shadowFinal = await sharp(shadowRaw, {
    raw: {
      width:    shadowMeta.width  ?? dishW,
      height:   shadowMeta.height ?? dishH,
      channels: shadowChannels,
    },
  })
    .png()
    .toBuffer();

  // 阴影在画布上的位置 = 菜品位置 + 偏移
  const shadowLeft = dishLeft + dx;
  const shadowTop  = dishTop  + dy;

  // ── Step 5: 合成 ─────────────────────────────────────────────────
  // 层次顺序（从底到顶）：背景 → 阴影 → 菜品
  const composed = await sharp(bgResized)
    .composite([
      {
        input:  shadowFinal,
        left:   clampLeft(shadowLeft, shadowMeta.width  ?? dishW, canvasWidth),
        top:    clampTop (shadowTop,  shadowMeta.height ?? dishH, canvasHeight),
        blend:  'multiply',
      },
      {
        input: dishResized,
        left:  clampLeft(dishLeft, dishW, canvasWidth),
        top:   clampTop (dishTop,  dishH, canvasHeight),
        blend: 'over',
      },
    ])
    .png()
    .toBuffer();

  return {
    buffer:   composed,
    mimeType: 'image/png',
    width:    canvasWidth,
    height:   canvasHeight,
  };
}

// ── 工具：边界 clamp ──────────────────────────────────────────────────

function clampLeft(left: number, objW: number, canvasW: number): number {
  return Math.max(-(objW - 1), Math.min(left, canvasW - 1));
}

function clampTop(top: number, objH: number, canvasH: number): number {
  return Math.max(-(objH - 1), Math.min(top, canvasH - 1));
}
