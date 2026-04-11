import { NextRequest, NextResponse } from 'next/server';
import type { StyleId } from '@/lib/types';

export const maxDuration = 120; // 考虑到 DALL-E 3 的精工细作，给足 120 秒

const GOOGLE_KEY = process.env.GOOGLE_GEMINI_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ── 💎 2026 顶级配置：Gemini 3 Flash 识菜 (高精度版) + DALL-E 3 绘图 ──────────────────────
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

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

    if (!GOOGLE_KEY || !OPENAI_KEY) {
      throw new Error("密钥缺失，请检查 Vercel 的 Environment Variables 设置！");
    }

    // ── Step 1: 高精度识菜 (改进提示词，严防幻觉) ──
    console.log('[Step 1] 正在以 100% 专注度识别照片...');
    const geminiRes = await fetch(`${GEMINI_URL}?key=${GOOGLE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: "You are a professional food critic. Look AT THE IMAGE CAREFULLY. Identify the EXACT dish. DO NOT hallucinate. Return a STRICT JSON: {name_cn, name_en, ingredients: [], spice_level, allergens: [], visual_detail, copySets: [{style_label, main_title, sub_title, description, price, promo_tag}]}. Ensure name_cn reflects the actual dish in the picture (e.g., Sushi if it's sushi). Output JSON ONLY." }
          ]
        }]
      }),
    });

    if (!geminiRes.ok) throw new Error(`Gemini 识菜失败: ${geminiRes.status}`);
    const geminiData = await geminiRes.json();
    let rawText = geminiData.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    console.log('✅ 识菜成功，它是:', result.name_cn);

    // ── Step 2: DALL-E 3 皇家画师 ──
    console.log('[Step 2] DALL-E 3 正在根据文案画出海报背景...');
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
      const errDetail = await dalleRes.text();
      console.error('DALL-E 报错:', errDetail);
      throw new Error(`DALL-E 3 绘图失败`);
    }

    const dalleData = await dalleRes.json();
    const posterImageBase64 = dalleData.data[0].b64_json;
    console.log('✅ DALL-E 3 出图成功！');

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
    console.error('❌ 执行失败:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}