import { NextRequest, NextResponse } from 'next/server';
import type { StyleId } from '@/lib/types';

export const maxDuration = 120;

// ── 👑 谷歌官方原生配置 (极致稳定版) ──────────────────────────────────────────────
const GOOGLE_KEY = process.env.GOOGLE_GEMINI_KEY;
// 💡 关键：使用 v1 正式版房间，绝不报 404
const BASE_URL = "[https://generativelanguage.googleapis.com/v1](https://generativelanguage.googleapis.com/v1)";

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

    // ── Step 1: 识菜 (使用最稳的 gemini-1.5-flash) ──
    console.log('[Step 1] 召唤金牌识菜官...');
    const textData = await callGoogleGemini("gemini-1.5-flash", { 
      contents: [{
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: "你是北美餐饮营销专家。分析图片并返回JSON。格式必须严格遵守：{ \"name_cn\": \"\", \"name_en\": \"\", \"ingredients\": [], \"spice_level\": 0, \"allergens\": [], \"visual_detail\": \"\", \"copySets\": [] }. 请直接开始输出JSON内容。" }
        ]
      }]
      // 💡 注意：这里删掉了报错的 generationConfig，改用提示词引导
    });

    // ── 🛠️ 暴力解析逻辑 ──
    let rawText = textData.candidates[0].content.parts[0].text;
    // 自动剥离 Markdown 的 ```json 标签
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    console.log('✅ 文案解析成功:', result.name_cn);

    // ── Step 2: 尝试出图 (如果失败则跳过) ──
    let posterImageBase64: string | null = null;
    try {
      const stylePrompt = STYLE_CONFIGS[styleId as StyleId]?.prompt || '';
      const imagePrompt = `Professional food photography: ${result.visual_detail}. ${stylePrompt}. 4K, realistic, no text.`;
      
      const imageData = await callGoogleGemini("gemini-1.5-flash", { 
        contents: [{ parts: [{ text: imagePrompt }] }]
      });
      
      const imagePart = imageData.candidates[0].content.parts.find((p: any) => p.inlineData);
      posterImageBase64 = imagePart?.inlineData?.data || null;
    } catch (e) {
      console.warn('⚠️ 生图步骤跳过，仅生成文案');
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