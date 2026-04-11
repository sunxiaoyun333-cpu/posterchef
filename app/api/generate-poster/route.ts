import { NextRequest, NextResponse } from 'next/server';
import type { StyleId } from '@/lib/types';

export const maxDuration = 120;

const OPENAI_KEY = process.env.OPENAI_API_KEY;

const STYLE_CONFIGS: Record<StyleId, { label: string; prompt: string; textColor: string }> = {
  'modern-minimalist': { label: 'Modern Minimalist', prompt: 'ultra-clean white minimalist, soft shadow, premium food photography, 4k', textColor: '#1a1a1a' },
  'rustic-farmhouse': { label: 'Rustic Farmhouse', prompt: 'rustic dark wood table, warm lighting, cozy farmhouse aesthetic, 4k', textColor: '#fff8e7' },
  'elegant-fine-dining': { label: 'Elegant Fine Dining', prompt: 'dramatic dark fine dining, luxury Michelin star aesthetic, moody lighting, 4k', textColor: '#f5e6c8' },
  'bright-cafe': { label: 'Bright & Fresh Cafe', prompt: 'bright airy cafe, white marble surface, fresh and clean, 4k', textColor: '#2d2d2d' },
  'vintage-chalkboard': { label: 'Vintage Bistro', prompt: 'vintage chalkboard texture, hand-drawn chalk decorative border, cozy bistro, 4k', textColor: '#f0ead6' },
  'bold-pop': { label: 'Bold Pop', prompt: 'bold vibrant pop art, graphic design style, bright complementary colors, 4k', textColor: '#ffffff' },
};

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg', styleId } = await req.json();

    if (!OPENAI_KEY) {
      throw new Error("密钥缺失，请检查 Vercel 环境变量 OPENAI_API_KEY");
    }

    // ── Step 1: GPT-4o-mini 视觉识别 (更稳、更快、更便宜) ──
    console.log('[Step 1] GPT-4o-mini 正在扫描照片...');
    const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // 使用 mini 版提高成功率
        messages: [
          {
            role: "system",
            content: "You are a specialized food recognition assistant. You must always return a valid JSON object."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify the dish in this image. Return a STRICT JSON object with these keys: name_cn, name_en, ingredients (array), spice_level (0-5), allergens (array), visual_detail (for DALL-E 3), copySets (array of 3 objects with style_label, main_title, sub_title, description, price, promo_tag). If you cannot identify it, return a best guess. Output JSON ONLY." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const visionData = await visionRes.json();

    if (!visionRes.ok) {
      console.error('OpenAI API Error:', visionData);
      throw new Error(`GPT 报错: ${visionData.error?.message || visionRes.status}`);
    }

    // 处理拒答或空内容
    const rawContent = visionData.choices?.[0]?.message?.content;
    const refusal = visionData.choices?.[0]?.refusal;

    if (refusal) {
      throw new Error(`AI 拒绝识别这张照片: ${refusal}`);
    }

    if (!rawContent || rawContent === "null") {
      throw new Error("AI 无法解析这张照片的内容，请换个角度或更清晰的照片重试。");
    }

    const result = JSON.parse(rawContent);
    console.log('✅ 识菜成功:', result.name_cn);

    // ── Step 2: DALL-E 3 绘图 ──
    console.log('[Step 2] DALL-E 3 正在作画...');
    const stylePrompt = STYLE_CONFIGS[styleId as StyleId]?.prompt || '';
    const dallePrompt = `Professional food photography of ${result.visual_detail}. ${stylePrompt}. High resolution, appetizing, NO TEXT, NO LETTERS.`;

    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: dallePrompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      }),
    });

    const dalleData = await dalleRes.json();
    
    if (!dalleRes.ok) {
      throw new Error(`DALL-E 3 绘图失败: ${dalleData.error?.message || '未知错误'}`);
    }

    const posterImageBase64 = dalleData.data[0].b64_json;

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        posterImageBase64,
        usedFallback: false,
        styleLabel: STYLE_CONFIGS[styleId as StyleId]?.label,
        textColor: STYLE_CONFIGS[styleId as StyleId]?.textColor,
      },
    });

  } catch (err: any) {
    console.error('❌ 执行失败详情:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}