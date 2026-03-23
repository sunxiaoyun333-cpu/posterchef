'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePosterStore } from '@/lib/store/posterStore';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE_MB = 20;

export default function StepUpload() {
  const { originalImage, originalImageFile, setOriginalImage, clearOriginalImage, nextStep } =
    usePosterStore();

  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
        setError('仅支持 JPG、PNG、WEBP、HEIC 格式');
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`文件大小不能超过 ${MAX_SIZE_MB}MB`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setOriginalImage(dataUrl, file);
      };
      reader.readAsDataURL(file);
    },
    [setOriginalImage]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

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
            : originalImage
            ? 'border-neutral-600 bg-neutral-800/50'
            : 'border-neutral-600 hover:border-orange-400/60 bg-neutral-900'
          }`}
        style={{ minHeight: 340 }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !originalImage && inputRef.current?.click()}
      >
        {originalImage ? (
          /* 预览状态 */
          <div className="flex flex-col items-center p-4 gap-3">
            <div className="relative w-full flex justify-center" style={{ maxHeight: 280 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalImage}
                alt="菜品预览"
                className="rounded-xl object-contain max-h-72 max-w-full shadow-lg"
              />
              <button
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                onClick={(e) => { e.stopPropagation(); clearOriginalImage(); }}
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
              重新选择
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
                {isDragging ? '松开以上传' : '拖拽或点击上传菜品照片'}
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
        disabled={!originalImage}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40"
        onClick={nextStep}
      >
        下一步：AI 识别菜品 →
      </Button>
    </div>
  );
}
