import { GoogleGenerativeAI } from '@google/generative-ai';

function getGenAI(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY 未配置');
  }
  return new GoogleGenerativeAI(key);
}

/** 菜品识别 + 文案生成（多模态视觉 + 文本） */
export function getFlashModel() {
  return getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash' });
}

/** 背景图像生成（Imagen 3） */
export function getImagenModel() {
  return getGenAI().getGenerativeModel({ model: 'imagen-3.0-generate-002' });
}

/** Gemini Flash 原生图像生成（Imagen 3 降级方案） */
export function getFlashImageModel() {
  return getGenAI().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      // @ts-expect-error — responseModalities 是图像生成专用参数
      responseModalities: ['image', 'text'],
    },
  });
}
