import type { DishInfo } from '@/lib/types';
import { apiPost, ApiError } from '@/lib/apiClient';

async function tryRecognize(imageBase64: string, mimeType: string): Promise<DishInfo> {
  const json = await apiPost<{ success: boolean; data: { dish: DishInfo }; error?: string }>(
    '/api/recognize',
    { imageBase64, mimeType },
    { timeoutMs: 45_000 },  // Gemini 多模态可能较慢
  );

  if (!json.success) {
    throw new ApiError(json.error || '识别失败 / Recognition failed', 'server');
  }

  return json.data.dish;
}

/** 调用 /api/recognize，自动重试 3 次（限流时不重试）*/
export async function recognizeDish(imageBase64: string, mimeType = 'image/jpeg'): Promise<DishInfo> {
  const MAX_RETRIES = 3;
  let lastError: Error = new Error('识别失败');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await tryRecognize(imageBase64, mimeType);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('识别失败');
      // 限流错误不重试
      if (err instanceof ApiError && err.code === 'rate_limit') break;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError;
}
