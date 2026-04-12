import { NextRequest, NextResponse } from 'next/server';
import type { DishInfo, PosterData, PosterScheme, MarketingCopy, StyleId } from '@/lib/types';

export const maxDuration = 120;

const OPENAI_KEY = process.env.OPENAI_API_KEY;

function ensureMarketingCopy(v: unknown): MarketingCopy {
  if (v && typeof v === 'object' && 'cn' in v && 'en' in v) {
    const o = v as { cn?: unknown; en?: unknown };
    return { cn: String(o.cn ?? ''), en: String(o.en ?? '') };
  }
  return { cn: '', en: '' };
}

function ensureScheme(v: unknown): PosterScheme {
  if (!v || typeof v !== 'object') {
    return {
      main_title: { cn: '', en: '' },
      sub_title: { cn: '', en: '' },
      extra_text: { cn: '', en: '' },
    };
  }
  const o = v as Record<string, unknown>;
  return {
    main_title: ensureMarketingCopy(o.main_title),
    sub_title: ensureMarketingCopy(o.sub_title),
    extra_text: ensureMarketingCopy(o.extra_text ?? { cn: '', en: '' }),
  };
}

function normalizePosterData(raw: unknown): PosterData | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const schemes = o.schemes as Record<string, unknown> | undefined;
  if (!schemes || typeof schemes !== 'object') return null;
  const name_cn = String(o.name_cn ?? '').trim();
  const name_en = String(o.name_en ?? '').trim();
  const visual_prompt = String(o.visual_prompt ?? o.visual_detail ?? '').trim();
  if (!name_cn || !name_en || !visual_prompt) return null;
  return {
    name_cn,
    name_en,
    visual_prompt,
    schemes: {
      social: ensureScheme(schemes.social),
      offline: ensureScheme(schemes.offline),
    },
  };
}

function toDishInfo(
  posterData: PosterData,
  extras: Record<string, unknown>,
): DishInfo {
  const tags = extras.tags;
  return {
    name: posterData.name_cn,
    nameEn: posterData.name_en,
    cuisine: String(extras.cuisine ?? ''),
    description: String(extras.description_cn ?? extras.description ?? ''),
    descriptionEn: String(extras.description_en ?? ''),
    mainColors: Array.isArray(extras.main_colors)
      ? (extras.main_colors as unknown[]).map((c) => String(c))
      : [],
    ingredients: Array.isArray(extras.ingredients)
      ? (extras.ingredients as unknown[]).map((c) => String(c))
      : [],
    lightingDirection: String(extras.lighting_direction ?? 'ambient'),
    shootingAngle: String(extras.shooting_angle ?? '45deg'),
    servingVessel: String(extras.serving_vessel ?? ''),
    confidence: typeof extras.confidence === 'number' ? extras.confidence : 0.9,
    tags: Array.isArray(tags) ? (tags as unknown[]).map((t) => String(t)) : [],
  };
}

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
    const body = await req.json();
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      styleId,
      phase = 'full',
      visualPrompt: bodyVisualPrompt,
    } = body as {
      imageBase64?: string;
      mimeType?: string;
      styleId?: StyleId;
      phase?: 'full' | 'analyze' | 'render';
      visualPrompt?: string;
    };

    if (!OPENAI_KEY) {
      throw new Error("密钥缺失，请检查 Vercel 环境变量 OPENAI_API_KEY。");
    }

    /* ── 仅 DALL·E：分拣站确认后生成背景（无再次识图）────────────────── */
    if (phase === 'render') {
      const vp = String(bodyVisualPrompt ?? '').trim();
      if (!vp) throw new Error('缺少 visualPrompt，无法生成背景图');
      if (!styleId) throw new Error('缺少 styleId');
      const stylePrompt = STYLE_CONFIGS[styleId as StyleId]?.prompt || '';
      const dallePrompt = `Professional food photography of ${vp}. ${stylePrompt}. High resolution, appetizing, no text.`;
      const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: dallePrompt,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json',
        }),
      });
      const dalleData = await dalleRes.json();
      if (!dalleRes.ok) throw new Error(dalleData.error?.message || '绘图失败');
      const posterImageBase64 = dalleData.data[0].b64_json;
      return NextResponse.json({
        success: true,
        data: {
          posterImageBase64,
          styleLabel: STYLE_CONFIGS[styleId as StyleId]?.label,
          textColor: STYLE_CONFIGS[styleId as StyleId]?.textColor,
        },
      });
    }

    if (!imageBase64) {
      throw new Error('识图阶段需要上传 imageBase64');
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
                text: `You are analyzing ONE food photo for a North American restaurant marketing SaaS.

STRICT RULES (anti-hallucination):
1. List ONLY ingredients and components clearly visible in the image. If unsure, omit rather than guess.
2. Name the dish ONLY from visible evidence (e.g. grain bowl, sushi, burger). Never assign a famous Chinese dish name unless the plate clearly matches it.
3. "visual_prompt" must describe the actual plate, ingredients, colors, and plating for image generation — no invented items.

OUTPUT: Return ONLY one JSON object (no markdown) with this exact shape:
{
  "name_cn": "准确中文菜名",
  "name_en": "Accurate English dish name",
  "cuisine": "short cuisine label e.g. Sichuan, Japanese, American",
  "description_cn": "≤25 Chinese characters, taste/texture from visible food only",
  "description_en": "one English sentence, same constraints",
  "main_colors": ["#hex1","#hex2","#hex3"],
  "ingredients": ["only visible items"],
  "lighting_direction": "left|right|top|front|ambient",
  "shooting_angle": "overhead|45deg|side|front",
  "serving_vessel": "brief English",
  "confidence": 0.0-1.0,
  "tags": ["short tags like spicy, vegan if justified by image"],
  "visual_prompt": "English-only, photorealistic food description for background image, no text in scene",
  "schemes": {
    "social": {
      "main_title": { "cn": "感性主标题中文", "en": "Instagram-style emotional main title EN" },
      "sub_title": { "cn": "副标题中文", "en": "supporting line EN" },
      "extra_text": { "cn": "心情/Vibe短句中文", "en": "short vibe / mood line EN" }
    },
    "offline": {
      "main_title": { "cn": "硬核营销大标题中文", "en": "bold promo headline EN" },
      "sub_title": { "cn": "卖点副标中文", "en": "value prop EN" },
      "extra_text": { "cn": "核心亮点中文(可含简短分点用顿号)", "en": "key highlights EN" }
    }
  }
}

Tone: social = emotional, shareable, light; offline = punchy, promotional, suitable for print flyer.` 
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

    const result = JSON.parse(visionData.choices[0].message.content) as Record<string, unknown>;
    const posterData = normalizePosterData(result);
    if (!posterData) {
      throw new Error('AI 返回的海报数据结构不完整（需包含 name_cn、name_en、visual_prompt 与 schemes）');
    }
    const dishInfo = toDishInfo(posterData, result);
    console.log('✅ 识菜与双场景文案完成:', posterData.name_cn);

    if (phase === 'analyze') {
      const sid = (styleId as StyleId) || 'modern-minimalist';
      return NextResponse.json({
        success: true,
        data: {
          posterData,
          dishInfo,
          styleLabel: STYLE_CONFIGS[sid]?.label,
          textColor: STYLE_CONFIGS[sid]?.textColor,
        },
      });
    }

    // ── Step 2: DALL-E 3 绘图 (基于准确的描述) ──
    console.log('[Step 2] DALL-E 3 皇家画师出场...');
    const stylePrompt = STYLE_CONFIGS[styleId as StyleId]?.prompt || '';
    const dallePrompt = `Professional food photography of ${posterData.visual_prompt}. ${stylePrompt}. High resolution, appetizing, no text.`;

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
        posterImageBase64,
        posterData,
        dishInfo,
        styleLabel: STYLE_CONFIGS[styleId as StyleId]?.label,
        textColor: STYLE_CONFIGS[styleId as StyleId]?.textColor,
      },
    });

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}