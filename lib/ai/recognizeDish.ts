import type { DishInfo } from '@/lib/types';

async function tryRecognize(imageBase64: string, mimeType: string): Promise<DishInfo> {
  const res = await fetch('/api/recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || '识别失败');
  }

  return json.data.dish as DishInfo;
}

/** 调用 /api/recognize，自动重试 3 次 */
export async function recognizeDish(imageBase64: string, mimeType = 'image/jpeg'): Promise<DishInfo> {
  const MAX_RETRIES = 3;
  let lastError: Error = new Error('识别失败');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await tryRecognize(imageBase64, mimeType);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('识别失败');
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError;
}
