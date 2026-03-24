import { NextRequest, NextResponse } from 'next/server';
import { compositeImages } from '@/lib/image/compositeEngine';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';

export const maxDuration = 30;

/**
 * POST /api/composite
 *
 * 请求体：
 * {
 *   backgroundBase64: string,   // 背景图 base64
 *   dishBase64:       string,   // 菜品图 base64（推荐透明 PNG）
 *   lightingDirection?: string, // 'left'|'right'|'top'|'front'|'ambient'
 *   canvasWidth?:  number,
 *   canvasHeight?: number,
 * }
 *
 * 响应：{ success: true, data: { imageBase64: string, mimeType: 'image/png' } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      backgroundBase64,
      dishBase64,
      lightingDirection = 'ambient',
      canvasWidth  = CANVAS_WIDTH,
      canvasHeight = CANVAS_HEIGHT,
    } = body as {
      backgroundBase64:   string;
      dishBase64:         string;
      lightingDirection?: string;
      canvasWidth?:       number;
      canvasHeight?:      number;
    };

    if (!backgroundBase64 || !dishBase64) {
      return NextResponse.json(
        { success: false, error: '缺少 backgroundBase64 或 dishBase64' },
        { status: 400 },
      );
    }

    const result = await compositeImages({
      backgroundBase64,
      dishBase64,
      lightingDirection: lightingDirection as 'left' | 'right' | 'top' | 'front' | 'ambient',
      canvasWidth,
      canvasHeight,
    });

    return NextResponse.json({
      success: true,
      data: {
        imageBase64: result.buffer.toString('base64'),
        mimeType:    result.mimeType,
        width:       result.width,
        height:      result.height,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '合成失败';
    console.error('[composite] error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
