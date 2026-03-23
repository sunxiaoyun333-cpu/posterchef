import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';

/**
 * POST /api/export
 *
 * 接收前端 Canvas 截图（或已合成的图片），用 Sharp 做高分辨率输出，
 * 支持 PNG / JPG / PDF（PDF 以二进制流返回）。
 *
 * 请求体：
 * {
 *   imageBase64: string,         // canvas toDataURL 的 base64（含 data:image/... 前缀也可）
 *   format?:     'png'|'jpg'|'pdf',  // 默认 'png'
 *   multiplier?: 1|2|3,          // 输出倍率，默认 2
 *   quality?:    number,         // JPG 质量 1-100，默认 90
 *   dishNameEn?: string,         // 用于文件名
 * }
 *
 * 响应：
 *   - PNG/JPG：{ success: true, data: { imageBase64, mimeType, fileName } }
 *   - PDF：    application/pdf 二进制流（Content-Disposition: attachment）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      imageBase64: rawBase64,
      format       = 'png',
      multiplier   = 2,
      quality      = 90,
      dishNameEn   = 'poster',
    } = body as {
      imageBase64:  string;
      format?:      'png' | 'jpg' | 'pdf';
      multiplier?:  number;
      quality?:     number;
      dishNameEn?:  string;
    };

    if (!rawBase64) {
      return NextResponse.json({ success: false, error: '缺少 imageBase64' }, { status: 400 });
    }

    // 去掉 data URL 前缀（如果有）
    const base64Data = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
    const srcBuffer  = Buffer.from(base64Data, 'base64');

    // 目标尺寸
    const targetW = Math.round(CANVAS_WIDTH  * multiplier);
    const targetH = Math.round(CANVAS_HEIGHT * multiplier);

    // 文件名（无空格）
    const safeName = dishNameEn.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') || 'poster';
    const timestamp = Date.now();
    const fileName  = `PosterChef_${safeName}_${timestamp}`;

    // ── PNG ──────────────────────────────────────────────────────────
    if (format === 'png') {
      const outBuffer = await sharp(srcBuffer)
        .resize(targetW, targetH, { fit: 'fill' })
        .png({ compressionLevel: 8 })
        .toBuffer();

      return NextResponse.json({
        success: true,
        data: {
          imageBase64: outBuffer.toString('base64'),
          mimeType:    'image/png',
          fileName:    `${fileName}.png`,
        },
      });
    }

    // ── JPG ──────────────────────────────────────────────────────────
    if (format === 'jpg') {
      const outBuffer = await sharp(srcBuffer)
        .resize(targetW, targetH, { fit: 'fill' })
        .flatten({ background: '#ffffff' })   // 透明通道 → 白色背景
        .jpeg({ quality: Math.min(100, Math.max(1, quality)), mozjpeg: true })
        .toBuffer();

      return NextResponse.json({
        success: true,
        data: {
          imageBase64: outBuffer.toString('base64'),
          mimeType:    'image/jpeg',
          fileName:    `${fileName}.jpg`,
        },
      });
    }

    // ── PDF ──────────────────────────────────────────────────────────
    if (format === 'pdf') {
      // Sharp 生成高清 PNG，再用 jsPDF 打包成 PDF
      const pngBuffer = await sharp(srcBuffer)
        .resize(targetW, targetH, { fit: 'fill' })
        .png({ compressionLevel: 6 })
        .toBuffer();

      const pngBase64 = pngBuffer.toString('base64');
      const pngDataUrl = `data:image/png;base64,${pngBase64}`;

      // jsPDF（动态 require 避免边缘 ESM 问题）
      const { jsPDF } = await import('jspdf');

      // 1 px = 0.264583 mm（72 dpi 基准，此处按实际输出尺寸）
      const mmW = targetW * 0.264583;
      const mmH = targetH * 0.264583;

      const doc = new jsPDF({
        orientation: mmH >= mmW ? 'portrait' : 'landscape',
        unit:        'mm',
        format:      [mmW, mmH],
        compress:    true,
      });

      doc.addImage(pngDataUrl, 'PNG', 0, 0, mmW, mmH, undefined, 'FAST');

      const pdfArrayBuffer = doc.output('arraybuffer');
      const pdfBuffer      = Buffer.from(pdfArrayBuffer);

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type':        'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
          'Content-Length':      String(pdfBuffer.length),
        },
      });
    }

    return NextResponse.json({ success: false, error: '不支持的格式' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '导出失败';
    console.error('[export] error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
