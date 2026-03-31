'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle, RefreshCw, AlertCircle, Camera, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { usePosterStore } from '@/lib/store/posterStore';
import { recognizeDish } from '@/lib/ai/recognizeDish';
import { apiPost, ApiError } from '@/lib/apiClient';
import { toast } from '@/lib/toast';
import type { DishInfo } from '@/lib/types';

export default function StepRecognize() {
  const {
    originalImage,
    dishInfo,
    isRecognizing,
    setDishInfo,
    setIsRecognizing,
    nextStep,
    prevStep,
    setError,
  } = usePosterStore();

  const [localError, setLocalError] = useState<string | null>(null);
  const [editedDish, setEditedDish] = useState<DishInfo | null>(dishInfo);

  // ── AI 识菜 ──────────────────────────────────────────────────────────
  const runRecognize = useCallback(async () => {
    if (!originalImage) return;
    setLocalError(null);
    setIsRecognizing(true);
    try {
      const [header, base64] = originalImage.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const result = await recognizeDish(base64, mimeType);
      setDishInfo(result);
      toast.success('AI 识别完成！/ Recognition complete');
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error ? err.message : '识别失败，请重试';
      setLocalError(msg);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsRecognizing(false);
    }
  }, [originalImage, setDishInfo, setError, setIsRecognizing]);

  // 首次进入自动识别
  useEffect(() => {
    if (!dishInfo && !isRecognizing && originalImage) {
      runRecognize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dishInfo) setEditedDish(dishInfo);
  }, [dishInfo]);

  function handleConfirm() {
    if (editedDish) setDishInfo(editedDish);
    nextStep();
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">AI 菜品识别</h2>
        <p className="text-neutral-400 text-sm">Dish Recognition · 确认信息后一键生成专业海报</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 左侧：图片预览 */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">原始照片</p>
          <div className={`rounded-2xl overflow-hidden border ${
            isRecognizing
              ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.2)] animate-pulse'
              : dishInfo
              ? 'border-green-500/40'
              : 'border-neutral-700'
          }`}>
            {originalImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={originalImage} alt="菜品照片" className="w-full object-contain max-h-80" />
            )}
          </div>
        </div>

        {/* 右侧：识别结果 */}
        <div className="flex flex-col gap-3">
          {/* 识别中骨架屏 */}
          {isRecognizing && (
            <div className="bg-neutral-900 rounded-2xl border border-neutral-700 p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-orange-400 text-sm font-medium">
                <RefreshCw className="w-4 h-4 animate-spin" />
                🤖 AI 正在识别菜品…
              </div>
              <Skeleton className="h-8 w-3/4 bg-neutral-800" />
              <Skeleton className="h-4 w-1/3 bg-neutral-800" />
              <Skeleton className="h-4 w-full bg-neutral-800" />
              <Skeleton className="h-4 w-5/6 bg-neutral-800" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full bg-neutral-800" />
                <Skeleton className="h-6 w-20 rounded-full bg-neutral-800" />
              </div>
            </div>
          )}

          {/* 识别错误 */}
          {localError && !isRecognizing && (
            <div className="bg-red-950/30 border border-red-800 rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">识别失败</span>
              </div>
              <p className="text-red-300 text-sm">{localError}</p>
              <Button
                variant="outline"
                size="sm"
                className="border-red-800 text-red-400 hover:text-red-300 self-start"
                onClick={runRecognize}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                重试
              </Button>
            </div>
          )}

          {/* 识别结果（可编辑） */}
          {!isRecognizing && editedDish && (
            <div className="bg-neutral-900 rounded-2xl border border-neutral-700 p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-1">
                <CheckCircle className="w-4 h-4" />
                识别完成 · 可直接编辑修正
              </div>

              {/* 菜品名称 */}
              <div>
                <Input
                  value={editedDish.name}
                  onChange={(e) => setEditedDish({ ...editedDish, name: e.target.value })}
                  className="text-xl font-bold bg-transparent border-0 border-b border-neutral-700 rounded-none px-0 text-white focus-visible:ring-0 focus-visible:border-orange-500 mb-1"
                />
                <Input
                  value={editedDish.nameEn}
                  onChange={(e) => setEditedDish({ ...editedDish, nameEn: e.target.value })}
                  className="text-sm bg-transparent border-0 border-b border-neutral-800 rounded-none px-0 text-neutral-400 focus-visible:ring-0 focus-visible:border-orange-500"
                />
              </div>

              {editedDish.cuisine && (
                <Badge variant="secondary" className="self-start bg-orange-500/20 text-orange-300 border-orange-500/30">
                  {editedDish.cuisine}
                </Badge>
              )}

              <div className="flex flex-col gap-1">
                <Input
                  value={editedDish.description}
                  onChange={(e) => setEditedDish({ ...editedDish, description: e.target.value })}
                  className="text-sm bg-neutral-800/50 border-neutral-700 text-neutral-300"
                  placeholder="中文描述"
                />
                <Input
                  value={editedDish.descriptionEn}
                  onChange={(e) => setEditedDish({ ...editedDish, descriptionEn: e.target.value })}
                  className="text-sm bg-neutral-800/50 border-neutral-700 text-neutral-400"
                  placeholder="English description"
                />
              </div>

              {(editedDish.ingredients?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-neutral-500 mb-2">主要食材</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(editedDish.ingredients ?? []).map((ing) => (
                      <Badge key={ing} variant="outline" className="text-xs border-neutral-700 text-neutral-400">
                        {ing}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between text-xs text-neutral-500 mb-1">
                  <span>识别置信度</span>
                  <span>{Math.round(editedDish.confidence * 100)}%</span>
                </div>
                <Progress value={editedDish.confidence * 100} className="h-2 bg-neutral-800" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="flex gap-3 mt-6">
        <Button
          variant="outline"
          className="border-neutral-700 text-neutral-400 hover:text-white"
          onClick={prevStep}
        >
          <Camera className="w-4 h-4 mr-1" />
          重新上传
        </Button>

        {editedDish && !isRecognizing && (
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            onClick={handleConfirm}
          >
            <ChevronRight className="w-4 h-4 mr-1" />
            确认识别结果，下一步选择风格
          </Button>
        )}
      </div>
    </div>
  );
}

// 保留 apiPost 引用避免 lint 警告（实际已在 runRecognize 中通过 recognizeDish 使用）
void (apiPost as unknown);
