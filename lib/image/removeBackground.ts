'use client';

type ProgressCallback = (progress: number) => void;

/**
 * 浏览器端抠图（@imgly/background-removal）
 * 返回透明背景 PNG 的 data URL
 */
export async function removeBackground(
  imageUrl: string,
  onProgress?: ProgressCallback
): Promise<string> {
  // 动态 import，避免 SSR 报错
  const { removeBackground: imglyRemoveBg } = await import('@imgly/background-removal');

  const blob = await imglyRemoveBg(imageUrl, {
    // 使用 jsDelivr CDN（国内访问更快）
    publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/',
    progress: (_key: string, current: number, total: number) => {
      if (onProgress && total > 0) {
        onProgress(Math.min(99, Math.round((current / total) * 100)));
      }
    },
    model: 'medium',     // medium 在速度和质量之间平衡
  } as Parameters<typeof imglyRemoveBg>[1]);

  onProgress?.(100);

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('转换 blob 失败'));
    reader.readAsDataURL(blob as Blob);
  });
}

/** 超时包装：120秒后自动抛错 */
export async function removeBackgroundWithTimeout(
  imageUrl: string,
  onProgress?: ProgressCallback
): Promise<string> {
  return Promise.race([
    removeBackground(imageUrl, onProgress),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('抠图超时（120s），请重试')), 120_000)
    ),
  ]);
}
