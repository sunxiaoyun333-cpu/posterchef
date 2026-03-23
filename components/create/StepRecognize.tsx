'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, RefreshCw, AlertCircle, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { usePosterStore } from '@/lib/store/posterStore';
import { recognizeDish } from '@/lib/ai/recognizeDish';
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

  // 首次进入自动识别
  useEffect(() => {
    if (!dishInfo && !isRecognizing && originalImage) {
      runRecognize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dishInfo 更新后同步到编辑状态
  useEffect(() => {
    if (dishInfo) setEditedDish(dishInfo);
  }, [dishInfo]);

  async function runRecognize() {
    if (!originalImage) return;
    setLocalError(null);
    setIsRecognizing(true);

    try {
      // 从 data URL 提取 base64 和 mimeType
      const [header, base64] = originalImage.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const result = await recognizeDish(base64, mimeType);
      setDishInfo(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '识别失败，请重试';
      setLocalError(msg);
      setError(msg);
    } finally {
      setIsRecognizing(false);
    }
  }

  function handleConfirm() {
    if (editedDish) {
      setDishInfo(editedDish);
      nextStep();
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">AI 菜品识别</h2>
        <p className="text-neutral-400 text-sm">AI Dish Recognition</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 左侧：原图 */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">原始照片</p>
          <div className={`rounded-2xl overflow-hidden border ${isRecognizing ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.2)] animate-pulse' : 'border-neutral-700'}`}>
            {originalImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={originalImage}
                alt="菜品照片"
                className="w-full object-contain max-h-80"
              />
            )}
          </div>
        </div>

        {/* 右侧：识别结果 */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">识别结果</p>

          {/* Loading 骨架屏 */}
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

          {/* 错误状态 */}
          {!isRecognizing && localError && (
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

          {/* 识别结果卡片 */}
          {!isRecognizing && editedDish && !localError && (
            <div className="bg-neutral-900 rounded-2xl border border-neutral-700 p-5 flex flex-col gap-4">
              {/* 菜品名称（可编辑） */}
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

              {/* 菜系标签 */}
              {editedDish.cuisine && (
                <Badge variant="secondary" className="self-start bg-orange-500/20 text-orange-300 border-orange-500/30">
                  {editedDish.cuisine}
                </Badge>
              )}

              {/* 描述（可编辑） */}
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

              {/* 主要食材 */}
              {editedDish.ingredients.length > 0 && (
                <div>
                  <p className="text-xs text-neutral-500 mb-2">主要食材</p>
                  <div className="flex flex-wrap gap-1.5">
                    {editedDish.ingredients.map((ing) => (
                      <Badge key={ing} variant="outline" className="text-xs border-neutral-700 text-neutral-400">
                        {ing}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 拍摄信息（只读） */}
              <div className="flex gap-3 text-xs text-neutral-600">
                <span>光线：{editedDish.lightingDirection}</span>
                <span>角度：{editedDish.shootingAngle}</span>
              </div>

              {/* 置信度 */}
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
        <Button
          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
          disabled={!editedDish || isRecognizing}
          onClick={handleConfirm}
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          确认并继续
        </Button>
      </div>
    </div>
  );
}
