import { NextRequest, NextResponse } from 'next/server';
import { getFlashModel } from '@/lib/ai/geminiClient';

export const maxDuration = 60; // Vercel Pro: 60s for Gemini multimodal
import { MOCK_DISH_INFO } from '@/lib/mock/mockDishInfo';
import type { RawDishApiResponse } from '@/lib/types';

const RECOGNIZE_PROMPT = `你是一个专业的菜品识别专家，专注于中餐和亚洲菜品，同时也熟悉美式餐厅菜品。
请仔细分析这张菜品照片，返回以下JSON格式信息。要求准确识别菜品名称（中英文），分析菜品主要颜色（3个hex值），判断照片光线方向和拍摄角度。

返回纯JSON格式（不要markdown代码块）：
{
  "name_cn": "菜品中文名",
  "name_en": "English Dish Name",
  "cuisine": "菜系（如Sichuan, Cantonese, Hunan, Japanese, Korean, Thai, Vietnamese, American, Italian, Mexican）",
  "description_cn": "一句话中文描述这道菜的特点和口感，不超过25字",
  "description_en": "One sentence English description of flavor and texture",
  "main_colors": ["#hex1", "#hex2", "#hex3"],
  "ingredients": ["ingredient1", "ingredient2", "ingredient3", "ingredient4"],
  "lighting_direction": "left或right或top或front或ambient",
  "shooting_angle": "overhead或45deg或side或front",
  "serving_vessel": "简短描述盛器，如white round plate, black stone bowl",
  "confidence": 0.95
}`;

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ success: false, error: '缺少图片数据' }, { status: 400 });
    }

    // 无 API Key 时返回 mock 数据
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ success: true, data: { dish: MOCK_DISH_INFO } });
    }

    const model = getFlashModel();

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType as string,
          data: imageBase64,
        },
      },
      RECOGNIZE_PROMPT,
    ]);

    const text = result.response.text().trim();

    // 清理可能的 markdown 代码块包裹
    const jsonText = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let raw: RawDishApiResponse;
    try {
      raw = JSON.parse(jsonText);
    } catch {
      console.error('JSON 解析失败:', jsonText);
      return NextResponse.json({ success: false, error: 'AI 返回格式无法解析，请重试' }, { status: 500 });
    }

    // 验证必要字段
    if (!raw.name_cn || !raw.name_en) {
      return NextResponse.json({ success: false, error: '识别结果不完整，请重试' }, { status: 500 });
    }

    // snake_case → camelCase
    const dish = {
      name:             raw.name_cn,
      nameEn:           raw.name_en,
      cuisine:          raw.cuisine || '',
      description:      raw.description_cn || '',
      descriptionEn:    raw.description_en || '',
      mainColors:       raw.main_colors || [],
      ingredients:      raw.ingredients || [],
      lightingDirection: raw.lighting_direction || 'ambient',
      shootingAngle:    raw.shooting_angle || '45deg',
      servingVessel:    raw.serving_vessel || '',
      confidence:       raw.confidence || 0.8,
      tags:             [],
    };

    return NextResponse.json({ success: true, data: { dish } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误';
    console.error('识别 API 错误:', message);
    return NextResponse.json({ success: false, error: `识别失败: ${message}` }, { status: 500 });
  }
}
