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
      throw new Error("密钥缺失，请检查 Vercel 环境变量 OPENAI_API_KEY。");
    }

    // ── Step 1: GPT-4o-mini 严谨识菜 ──
    console.log('[Step 1] GPT-4o-mini 正在进行证据链识菜...');
    const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a strict culinary analyst. Your goal is to identify dishes based ONLY on visual evidence. Do not guess traditional Chinese dishes if the image shows Western or fusion health food."
          },
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: `Task: 
                1. List all visible ingredients.
                2. Based on the ingredients, name the dish accurately (e.g., 'Salad Bowl', 'Healthy Grain Bowl', 'Sushi'). 
                3. If it looks like a healthy bowl with mixed veggies/fruits/grains, do NOT call it Kung Pao Chicken.
                
                Return ONLY a JSON object: {
                  "name_cn": "准确的中文名称",
                  "name_en": "Accurate English Name",
                  "ingredients": ["ingredient1", "ingredient2"],
                  "spice_level": 0,
                  "allergens": [],
                  "visual_detail": "precise visual description for image generation",
                  "copySets": [{ "style_label": "Healthy/Fresh", "main_title": "Fresh & Nutritious", "sub_title": "Energy Bowl", "description": "Taste the freshness of nature.", "price": "", "promo_tag": "New" }]
                }` 
              },
              { 
                type: "image_url", 
                image_url: { url: `data:${mimeType};base64,${imageBase64}` } 
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0 // 降到 0，彻底封杀“瞎想”的空间
      }),
    });

    const visionData = await visionRes.json();
    if (!visionRes.ok) throw new Error(visionData.error?.message || "识菜失败");

    const result = JSON.parse(visionData.choices[0].message.content);
    console.log('✅ 识菜完成（证据确凿）:', result.name_cn);

    // ── Step 2: DALL-E 3 绘图 (基于准确的描述) ──
    console.log('[Step 2] DALL-E 3 皇家画师出场...');
    const stylePrompt = STYLE_CONFIGS[styleId as StyleId]?.prompt || '';
    const dallePrompt = `Professional food photography of ${result.visual_detail}. ${stylePrompt}. High resolution, appetizing, no text.`;

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
    if (!dalleRes.ok) throw new Error(dalleData.error?.message || "绘图失败");

    const posterImageBase64 = dalleData.data[0].b64_json;

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        posterImageBase64,
        styleLabel: STYLE_CONFIGS[styleId as StyleId]?.label,
        textColor: STYLE_CONFIGS[styleId as StyleId]?.textColor,
      },
    });

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}