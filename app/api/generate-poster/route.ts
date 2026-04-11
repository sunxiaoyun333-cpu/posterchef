import { NextRequest, NextResponse } from 'next/server';
import type { StyleId } from '@/lib/types';

export const maxDuration = 120; // 保证生图不超时

// ── 👑 核心配置 (仅需 OpenAI 钥匙) ─────────────────────────────────────────────
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

    // ── Step 1: GPT-4o 视觉识别 (顶替 Gemini) ──
    console.log('[Step 1] GPT-4o 识菜官正在扫描照片...');
    const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Identify the EXACT dish in this image. Return STRICT JSON: {name_cn, name_en, ingredients: [], spice_level, allergens: [], visual_detail, copySets: [{style_label, main_title, sub_title, description, price, promo_tag}]}. Output JSON ONLY." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!visionRes.ok) {
      const err = await visionRes.text();
      throw new Error(`GPT-4o 识别失败: ${visionRes.status} - ${err}`);
    }

    const visionData = await visionRes.json();
    const result = JSON.parse(visionData.choices[0].message.content);
    console.log('✅ 识菜成功，它是:', result.name_cn);

    // ── Step 2: DALL-E 3 绘图 (保持不变) ──
    console.log('[Step 2] DALL-E 3 皇家画师正在作画...');
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

    if (!dalleRes.ok) {
      const err = await dalleRes.text();
      throw new Error(`DALL-E 3 绘图失败: ${dalleRes.status} - ${err}`);
    }

    const dalleData = await dalleRes.json();
    const posterImageBase64 = dalleData.data[0].b64_json;
    console.log('✅ 全线 OpenAI 流程跑通！');

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
    console.error('❌ 彻底失败:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}