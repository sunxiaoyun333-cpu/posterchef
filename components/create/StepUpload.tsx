'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePosterStore } from '@/lib/store/posterStore';
import { compressImage, createObjectUrl } from '@/lib/image/compressImage';
import { toast } from '@/lib/toast';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE_MB = 20;

export default function StepUpload() {
  const { originalImage, originalImageFile, setOriginalImage, clearOriginalImage, nextStep } =
    usePosterStore();

  const [isDragging,   setIsDragging]   = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  // 用 ObjectURL 管理预览图（大图不走 base64）
  const previewRef = useRef<{ url: string; revoke: () => void } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 组件卸载时释放 ObjectURL
  useEffect(() => {
    return () => { previewRef.current?.revoke(); };
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
        const msg = '仅支持 JPG、PNG、WEBP、HEIC 格式 / Only JPG, PNG, WEBP, HEIC supported';
        setError(msg);
        toast.error(msg);
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        const msg = `文件大小不能超过 ${MAX_SIZE_MB}MB / File size must be under ${MAX_SIZE_MB}MB`;
        setError(msg);
        toast.error(msg);
        return;
      }

      // 建立预览 ObjectURL（立即显示，不等压缩）
      previewRef.current?.revoke();
      const obj = createObjectUrl(file);
      previewRef.current = obj;
      setPreviewUrl(obj.url);

      // 大图先压缩再存入 store（减少 API 传输量）
      setIsCompressing(true);
      try {
        const compressed = await compressImage(file, {
          maxWidth:  2048,
          maxHeight: 2048,
          quality:   0.85,
          mimeType:  file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        });
        setOriginalImage(compressed, file);
      } catch {
        toast.error('图片压缩失败，使用原始文件 / Compression failed, using original');
        // 降级：直接用 FileReader
        const reader = new FileReader();
        reader.onload = (e) => setOriginalImage(e.target?.result as string, file);
        reader.readAsDataURL(file);
      } finally {
        setIsCompressing(false);
      }
    },
    [setOriginalImage],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleClear = () => {
    previewRef.current?.revoke();
    previewRef.current = null;
    setPreviewUrl(null);
    clearOriginalImage();
  };

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  const displayUrl = previewUrl || originalImage;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-1">上传菜品照片</h2>
        <p className="text-neutral-400 text-sm">Upload Your Dish Photo</p>
      </div>

      {/* 上传区域 */}
      <div
        className={`relative w-full rounded-2xl border-2 border-dashed transition-all cursor-pointer
          ${isDragging
            ? 'border-orange-400 bg-orange-500/10 scale-[1.01]'
            : displayUrl
            ? 'border-neutral-600 bg-neutral-800/50'
            : 'border-neutral-600 hover:border-orange-400/60 bg-neutral-900'
          }`}
        style={{ minHeight: 340 }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !displayUrl && inputRef.current?.click()}
      >
        {isCompressing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-neutral-300">压缩中… / Compressing…</p>
            </div>
          </div>
        )}

        {displayUrl ? (
          /* 预览状态 */
          <div className="flex flex-col items-center p-4 gap-3">
            <div className="relative w-full flex justify-center" style={{ maxHeight: 280 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayUrl}
                alt="菜品预览"
                className="rounded-xl object-contain max-h-72 max-w-full shadow-lg"
              />
              <button
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {originalImageFile && (
              <div className="text-center">
                <p className="text-sm text-neutral-300 font-medium">{originalImageFile.name}</p>
                <p className="text-xs text-neutral-500">{formatSize(originalImageFile.size)}</p>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="text-xs border-neutral-600 text-neutral-400 hover:text-white"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            >
              重新选择 / Choose another
            </Button>
          </div>
        ) : (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center gap-4 p-12">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              {isDragging
                ? <ImageIcon className="w-8 h-8 text-orange-400" />
                : <Upload className="w-8 h-8 text-orange-400" />
              }
            </div>
            <div className="text-center">
              <p className="text-white font-medium mb-1">
                {isDragging ? '松开以上传 / Release to upload' : '拖拽或点击上传菜品照片'}
              </p>
              <p className="text-neutral-500 text-sm">Drag &amp; drop your dish photo here</p>
            </div>
            <p className="text-xs text-neutral-600">支持 JPG、PNG、HEIC 格式，最大 {MAX_SIZE_MB}MB</p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic"
        className="hidden"
        onChange={onFileChange}
      />

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <Button
        size="lg"
        disabled={!originalImage || isCompressing}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40"
        onClick={nextStep}
      >
        {isCompressing ? '处理中… / Processing…' : '下一步：AI 识别菜品 →'}
      </Button>
    </div>
  );
}
