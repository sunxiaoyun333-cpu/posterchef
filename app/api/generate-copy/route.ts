import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { DishInfo } from '@/lib/types';

const SYSTEM_PROMPT = `你是一位精通美国餐厅营销的专业文案撰写人，特别擅长中餐和亚洲餐厅的菜品推广文案。你深谙美国消费者的口味偏好和营销心理。请根据提供的菜品信息，生成3套不同风格（高端正式、活泼亲切、简洁促销）的中英双语营销文案，返回指定的 JSON 数组格式（包含 main_title, sub_title, description, price, promo_tag, spice_level, allergens）。只返回纯 JSON 数组，不要 markdown。`;

export interface GeneratedCopy {
  style: 'formal' | 'casual' | 'promo';
  style_label: string;
  main_title: string;
  main_title_en: string;
  sub_title: string;
  sub_title_en: string;
  description: string;
  description_en: string;
  price: string;
  promo_tag: string;
  promo_tag_en: string;
  spice_level: string;
  allergens: string;
}

export async function POST(req: NextRequest) {
  try {
    const { dishInfo }: { dishInfo: DishInfo } = await req.json();

    if (!dishInfo) {
      return NextResponse.json({ success: false, error: '缺少菜品信息' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: '未配置 GEMINI_API_KEY' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const userPrompt = `
菜品信息：
- 中文名：${dishInfo.name}
- 英文名：${dishInfo.nameEn}
- 菜系：${dishInfo.cuisine}
- 中文描述：${dishInfo.description}
- 英文描述：${dishInfo.descriptionEn}
- 主要食材：${dishInfo.ingredients.join('、')}
- 菜品标签：${dishInfo.tags?.join('、') ?? ''}

请生成3套营销文案，严格按以下 JSON 数组格式返回，不要任何 markdown 或额外说明：
[
  {
    "style": "formal",
    "style_label": "高端正式",
    "main_title": "中文主标题",
    "main_title_en": "English Main Title",
    "sub_title": "中文副标题",
    "sub_title_en": "English Subtitle",
    "description": "中文描述文案（20字以内）",
    "description_en": "English description (under 20 words)",
    "price": "$ XX.XX",
    "promo_tag": "中文促销标签",
    "promo_tag_en": "Promo Tag",
    "spice_level": "🌶️🌶️",
    "allergens": "Contains: gluten, soy"
  },
  { "style": "casual", "style_label": "活泼亲切", ... },
  { "style": "promo", "style_label": "简洁促销", ... }
]`;

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userPrompt },
    ]);

    const raw = result.response.text().trim();

    // 清理可能残留的 markdown 代码块标记
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let copySets: GeneratedCopy[];
    try {
      copySets = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { success: false, error: `AI 返回格式无效: ${cleaned.slice(0, 200)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { copySets } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
