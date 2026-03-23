import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

/**
 * 图片增强 API
 * 微妙增强：对比度、饱和度、锐化——让食物更有食欲感
 */
export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await request.json();
    if (!imageBase64) {
      return NextResponse.json({ success: false, error: '缺少图片数据' }, { status: 400 });
    }

    const buffer = Buffer.from(imageBase64, 'base64');

    const enhanced = await sharp(buffer)
      // 轻微提亮 + 增加对比度
      .modulate({ brightness: 1.05, saturation: 1.15 })
      // 温和锐化：让食材纹理更清晰
      .sharpen({ sigma: 1.5, m1: 0.5, m2: 0.5 })
      // 输出格式
      .toFormat(mimeType === 'image/png' ? 'png' : 'jpeg', { quality: 92 })
      .toBuffer();

    return NextResponse.json({
      success: true,
      data: {
        imageBase64: enhanced.toString('base64'),
        mimeType: mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '增强失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
