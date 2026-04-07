import { NextRequest, NextResponse } from 'next/server';
import type { StyleId } from '@/lib/types';

// Vercel 部署环境允许的最长运行时间（DALL-E 3 画图比较慢，需要给足时间）
export const maxDuration = 120; 

// ── 👑 核心配置 ─────────────────────────────────────────────────────────────
const GOOGLE_KEY = process.env.GOOGLE_GEMINI_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// 使用 Gemini 1.5 Flash 作为“识菜官”，速度最快且稳定
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";

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
      throw new Error("密钥缺失，请检查 Vercel 环境变量配置");
    }

    // ── Step 1: 召唤 Gemini 识菜 (文案生成) ──
    console.log('[Step 1] Gemini 正在扫描照片...');
    const geminiRes = await fetch(`${GEMINI_URL}?key=${GOOGLE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: "你是北美餐饮营销专家。分析图片并返回严格JSON: {name_cn, name_en, ingredients: [], spice_level, allergens: [], visual_detail, copySets: [{style_label, main_title, sub_title, description, price, promo_tag}]}. 请直接开始输出JSON。" }
          ]
        }]
      }),
    });

    if (!geminiRes.ok) throw new Error(`Gemini 报错: ${geminiRes.status}`);
    const geminiData = await geminiRes.json();
    let rawText = geminiData.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    console.log('✅ 文案生成成功:', result.name_cn);

    // ── Step 2: 召唤 DALL-E 3 皇家画师 (生图) ──
    console.log('[Step 2] DALL-E 3 正在为你作画...');
    const stylePrompt = STYLE_CONFIGS[styleId as StyleId]?.prompt || '';
    // 指令：专业摄影，描述食物，加上风格，强调不要文字
    const dallePrompt = `Professional food photography of ${result.visual_detail}. ${stylePrompt}. High resolution, appetizing, no text, no letters, no typography.`;

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
      const errorBody = await dalleRes.text();
      console.error('DALL-E 报错详情:', errorBody);
      throw new Error(`DALL-E 3 绘图失败: ${dalleRes.status}`);
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