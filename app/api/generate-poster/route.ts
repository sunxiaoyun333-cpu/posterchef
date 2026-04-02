import { NextRequest, NextResponse } from 'next/server';
import type { StyleId } from '@/lib/types';

export const maxDuration = 120;

// ── 👑 谷歌官方原生配置 ──────────────────────────────────────────────────────
// 👑 谷歌官方原生配置
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// 💡 永远使用环境变量，不要把真正的 Key 写在这里！
const GOOGLE_KEY = process.env.GOOGLE_GEMINI_KEY;

const STYLE_CONFIGS: Record<StyleId, { label: string; prompt: string; textColor: string }> = {
  'modern-minimalist': { label: 'Modern Minimalist', prompt: 'ultra-clean white minimalist, soft shadow, premium food photography, no text', textColor: '#1a1a1a' },
  'rustic-farmhouse': { label: 'Rustic Farmhouse', prompt: 'rustic dark wood table, warm lighting, cozy farmhouse aesthetic, no text', textColor: '#fff8e7' },
  'elegant-fine-dining': { label: 'Elegant Fine Dining', prompt: 'dramatic dark fine dining, luxury Michelin star aesthetic, moody lighting, no text', textColor: '#f5e6c8' },
  'bright-cafe': { label: 'Bright & Fresh Cafe', prompt: 'bright airy cafe, white marble surface, fresh and clean, no text', textColor: '#2d2d2d' },
  'vintage-chalkboard': { label: 'Vintage Bistro', prompt: 'vintage chalkboard texture, hand-drawn chalk decorative border, cozy bistro, no text', textColor: '#f0ead6' },
  'bold-pop': { label: 'Bold Pop', prompt: 'bold vibrant pop art, graphic design style, bright complementary colors, no text', textColor: '#ffffff' },
};

// 🛡️ 官方原生调用函数
async function callGoogleGemini(model: string, payload: any) {
  const url = `${BASE_URL}/models/${model}:generateContent?key=${GOOGLE_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google API 报错: ${response.status} - ${err}`);
  }
  return response.json();
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg', styleId } = await req.json();

    // ── Step 1: 官方 Gemini 3.1 Flash 识菜 ──
    console.log('[Step 1] 官方画师正在识菜...');
    const textData = await callGoogleGemini("gemini-3.1-flash", { // 官方免费额度最稳的是 1.5-flash
      contents: [{
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: "你是北美餐饮营销专家。分析图片并返回JSON: {name_cn, name_en, ingredients: [], spice_level, allergens: [], visual_detail, copySets: [{style_label, main_title, sub_title, description, price, promo_tag}]}" }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" } // 官方强制 JSON 模式，绝不报错
    });

    const result = JSON.parse(textData.candidates[0].content.parts[0].text);
    console.log('✅ 官方文案生成成功');

    // ── Step 2: 官方 Gemini 3.1 生图 ──
    console.log('[Step 2] 召唤官方皇家画师...');
    const stylePrompt = STYLE_CONFIGS[styleId as StyleId]?.prompt || '';
    const imagePrompt = `Professional food photography: ${result.visual_detail}. ${stylePrompt}. 4K, realistic, no text.`;
    
    let posterImageBase64: string | null = null;
    try {
      // 注意：官方生图模型名字可能是 imagen-3 或最新的 gemini-3-pro-image-preview
      const imageData = await callGoogleGemini("gemini-3.1-pro", { // 或者你的 Key 权限内的生图模型
        contents: [{ parts: [{ text: imagePrompt }] }]
      });
      
      const imagePart = imageData.candidates[0].content.parts.find((p: any) => p.inlineData);
      posterImageBase64 = imagePart?.inlineData?.data || null;
      if (posterImageBase64) console.log('✅ 官方出图成功！');
    } catch (e: any) {
      console.error('⚠️ 官方生图由于配额或网络波动跳过:', e.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        posterImageBase64,
        usedFallback: !posterImageBase64,
        styleLabel: STYLE_CONFIGS[styleId as StyleId]?.label,
        textColor: STYLE_CONFIGS[styleId as StyleId]?.textColor,
      },
    });

  } catch (err: any) {
    console.error('❌ 执行失败:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}