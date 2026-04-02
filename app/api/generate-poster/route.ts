import { NextRequest, NextResponse } from 'next/server';
import type { StyleId } from '@/lib/types';

export const maxDuration = 120;

// ── 👑 谷歌官方原生配置 (极致稳定版) ──────────────────────────────────────────────
const GOOGLE_KEY = process.env.GOOGLE_GEMINI_KEY;
// 💡 必须用 v1beta，否则 JSON 模式会报 400 错误
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const STYLE_CONFIGS: Record<StyleId, { label: string; prompt: string; textColor: string }> = {
  'modern-minimalist': { label: 'Modern Minimalist', prompt: 'ultra-clean white minimalist, soft shadow, premium food photography, no text', textColor: '#1a1a1a' },
  'rustic-farmhouse': { label: 'Rustic Farmhouse', prompt: 'rustic dark wood table, warm lighting, cozy farmhouse aesthetic, no text', textColor: '#fff8e7' },
  'elegant-fine-dining': { label: 'Elegant Fine Dining', prompt: 'dramatic dark fine dining, luxury Michelin star aesthetic, moody lighting, no text', textColor: '#f5e6c8' },
  'bright-cafe': { label: 'Bright & Fresh Cafe', prompt: 'bright airy cafe, white marble surface, fresh and clean, no text', textColor: '#2d2d2d' },
  'vintage-chalkboard': { label: 'Vintage Bistro', prompt: 'vintage chalkboard texture, hand-drawn chalk decorative border, cozy bistro, no text', textColor: '#f0ead6' },
  'bold-pop': { label: 'Bold Pop', prompt: 'bold vibrant pop art, graphic design style, bright complementary colors, no text', textColor: '#ffffff' },
};

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

    // ── Step 1: 识菜 (使用 2026 最稳金牌模型) ──
    console.log('[Step 1] 正在召唤金牌识菜官 gemini-1.5-flash...');
    const textData = await callGoogleGemini("gemini-1.5-flash", { 
      contents: [{
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: "你是北美餐饮营销专家。分析图片并返回严格 JSON。格式：{name_cn, name_en, ingredients: [], spice_level, allergens: [], visual_detail, copySets: [{style_label, main_title, sub_title, description, price, promo_tag}]}" }
        ]
      }],
      generationConfig: { 
        responseMimeType: "application/json" // 💡 v1beta 完美支持此参数
      }
    });

    const result = JSON.parse(textData.candidates[0].content.parts[0].text);
    console.log('✅ 文案生成成功:', result.name_cn);

    // ── Step 2: 生图 (Imagen 3 皇家画师) ──
    console.log('[Step 2] 正在召唤皇家画师...');
    const stylePrompt = STYLE_CONFIGS[styleId as StyleId]?.prompt || '';
    const imagePrompt = `Professional food photography: ${result.visual_detail}. ${stylePrompt}. 4K, realistic, no text.`;
    
    let posterImageBase64: string | null = null;
    try {
      // 💡 在官方 API 中，生图通常调用 gemini-1.5-pro 或者独立的 imagen 模型
      const imageData = await callGoogleGemini("gemini-1.5-pro", { 
        contents: [{ parts: [{ text: imagePrompt }] }]
      });
      
      const imagePart = imageData.candidates[0].content.parts.find((p: any) => p.inlineData);
      posterImageBase64 = imagePart?.inlineData?.data || null;
      if (posterImageBase64) console.log('✅ 出图成功！');
    } catch (e: any) {
      console.warn('⚠️ 生图步骤由于配额限制暂时跳过，已为您保留文案。');
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