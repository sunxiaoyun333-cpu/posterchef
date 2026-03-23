import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

/**
 * 服务端抠图降级方案（基于 Sharp 边缘检测 + 颜色阈值）
 * 质量低于浏览器端 AI 抠图，仅作兜底
 */
export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json();
    if (!imageBase64) {
      return NextResponse.json({ success: false, error: '缺少图片数据' }, { status: 400 });
    }

    const buffer = Buffer.from(imageBase64, 'base64');

    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const pixels = new Uint8ClampedArray(data);

    // 采样四个角落（各 5%）作为背景色参考
    const sampleSize = Math.floor(Math.min(width, height) * 0.05);
    let bgR = 0, bgG = 0, bgB = 0, count = 0;
    for (let y = 0; y < sampleSize; y++) {
      for (let x = 0; x < sampleSize; x++) {
        const idx = (y * width + x) * channels;
        bgR += pixels[idx]; bgG += pixels[idx + 1]; bgB += pixels[idx + 2];
        count++;
      }
    }
    bgR = Math.round(bgR / count);
    bgG = Math.round(bgG / count);
    bgB = Math.round(bgB / count);

    // 对每个像素：与背景色差异小的设为透明
    const THRESHOLD = 40;
    for (let i = 0; i < pixels.length; i += channels) {
      const dr = Math.abs(pixels[i] - bgR);
      const dg = Math.abs(pixels[i + 1] - bgG);
      const db = Math.abs(pixels[i + 2] - bgB);
      if (dr + dg + db < THRESHOLD * 3) {
        pixels[i + 3] = 0; // 透明
      }
    }

    const resultBuffer = await sharp(Buffer.from(pixels), {
      raw: { width, height, channels },
    })
      .png()
      .toBuffer();

    return NextResponse.json({
      success: true,
      data: { imageBase64: resultBuffer.toString('base64') },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '处理失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
