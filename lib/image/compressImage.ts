/**
 * compressImage.ts — 浏览器端图片压缩
 *
 * 上传前将图片缩放到最大 2048px，质量 0.85，
 * 大幅减少 API 传输量和 base64 payload 大小。
 */

export interface CompressOptions {
  maxWidth?:  number;   // 默认 2048
  maxHeight?: number;   // 默认 2048
  quality?:   number;   // 0-1，默认 0.85
  mimeType?:  string;   // 默认 'image/jpeg'
}

/**
 * 压缩图片 File → base64 data URL
 * 若图片已在限制内，则仅做格式标准化
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<string> {
  const {
    maxWidth  = 2048,
    maxHeight = 2048,
    quality   = 0.85,
    mimeType  = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // 等比缩放
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width  = Math.floor(width  * ratio);
        height = Math.floor(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL(mimeType, quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片加载失败 / Failed to load image'));
    };

    img.src = objectUrl;
  });
}

/**
 * 将 File 转为 ObjectURL，并返回 revoke 函数
 * 用于大图预览，组件卸载时调用 revoke()
 */
export function createObjectUrl(file: File): { url: string; revoke: () => void } {
  const url = URL.createObjectURL(file);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
