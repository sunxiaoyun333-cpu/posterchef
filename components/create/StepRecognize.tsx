'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle, RefreshCw, AlertCircle, Camera,
  Scissors, Sparkles, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { usePosterStore } from '@/lib/store/posterStore';
import { recognizeDish } from '@/lib/ai/recognizeDish';
import { removeBackgroundWithTimeout } from '@/lib/image/removeBackground';
import type { DishInfo } from '@/lib/types';

// ----------------------------------------------------------------
// Phase 3 的三个子阶段
// ----------------------------------------------------------------
type SubPhase = 'recognizing' | 'confirm' | 'processing' | 'done';

export default function StepRecognize() {
  const {
    originalImage,
    dishInfo,
    isRecognizing,
    removedBgImage,
    enhancedImage,
    processedImage,
    isProcessing,
    removeBgProgress,
    enhanceProgress,
    useRemovedBg,
    setDishInfo,
    setIsRecognizing,
    setRemovedBgImage,
    setEnhancedImage,
    setProcessedImage,
    setIsProcessing,
    setRemoveBgProgress,
    setEnhanceProgress,
    setUseRemovedBg,
    nextStep,
    prevStep,
    setError,
  } = usePosterStore();

  const [localError, setLocalError] = useState<string | null>(null);
  const [editedDish, setEditedDish] = useState<DishInfo | null>(dishInfo);

  // 当前子阶段
  const subPhase: SubPhase = (() => {
    if (processedImage) return 'done';
    if (isProcessing || removedBgImage) return 'processing';
    if (dishInfo && !isRecognizing) return 'confirm';
    return 'recognizing';
  })();

  // ── 阶段一：AI 识别 ──────────────────────────────────────────
  const runRecognize = useCallback(async () => {
    if (!originalImage) return;
    setLocalError(null);
    setIsRecognizing(true);
    try {
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
  }, [originalImage, setDishInfo, setError, setIsRecognizing]);

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

  // ── 阶段二：确认后触发处理 ───────────────────────────────────
  async function handleConfirmAndProcess() {
    if (!editedDish || !originalImage) return;
    setDishInfo(editedDish);   // 保存用户编辑结果
    await runProcessing();
  }

  // ── 阶段三：抠图 + 增强 ──────────────────────────────────────
  const runProcessing = useCallback(async () => {
    if (!originalImage) return;
    setLocalError(null);
    setIsProcessing(true);
    setRemoveBgProgress(0);
    setEnhanceProgress(0);

    try {
      // --- 3a: 浏览器端抠图 ---
      const removedUrl = await removeBackgroundWithTimeout(
        originalImage,
        (p) => setRemoveBgProgress(p),
      );
      setRemovedBgImage(removedUrl);

      // --- 3b: 服务端图片增强 ---
      const [header, base64] = originalImage.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

      // 模拟增强进度（服务端无法流式回调，用定时器补位）
      const fakeProgress = setInterval(() => {
        setEnhanceProgress((prev: number) => Math.min(prev + 15, 90));
      }, 200);

      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      clearInterval(fakeProgress);
      setEnhanceProgress(100);

      if (!res.ok) throw new Error('图片增强失败');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '图片增强失败');

      const enhancedDataUrl = `data:${json.data.mimeType};base64,${json.data.imageBase64}`;
      setEnhancedImage(enhancedDataUrl);

      // --- 决定最终使用哪张图 ---
      setProcessedImage(useRemovedBg ? removedUrl : enhancedDataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '处理失败，请重试';
      setLocalError(msg);
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  }, [
    originalImage, useRemovedBg,
    setEnhancedImage, setEnhanceProgress, setError,
    setIsProcessing, setProcessedImage,
    setRemoveBgProgress, setRemovedBgImage,
  ]);

  // 切换抠图/原图时同步更新 processedImage
  function handleToggleUseRemovedBg(val: boolean) {
    setUseRemovedBg(val);
    if (val && removedBgImage) setProcessedImage(removedBgImage);
    if (!val && enhancedImage) setProcessedImage(enhancedImage);
  }

  // ── UI ───────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* 标题 */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">AI 菜品识别 & 图片处理</h2>
        <p className="text-neutral-400 text-sm">Dish Recognition · Background Removal · Enhancement</p>
      </div>

      {/* 进度步骤条 */}
      <StepIndicator subPhase={subPhase} />

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {/* 左侧：图片预览 */}
        <ImagePreview
          originalImage={originalImage}
          removedBgImage={removedBgImage}
          processedImage={processedImage}
          subPhase={subPhase}
          useRemovedBg={useRemovedBg}
          onToggle={handleToggleUseRemovedBg}
        />

        {/* 右侧：内容区 */}
        <div className="flex flex-col gap-3">
          {/* 阶段一：识别中 */}
          {subPhase === 'recognizing' && (
            <RecognizingPanel localError={localError} isRecognizing={isRecognizing} onRetry={runRecognize} />
          )}

          {/* 阶段二：确认识别结果 */}
          {subPhase === 'confirm' && editedDish && (
            <DishInfoCard dish={editedDish} onChange={setEditedDish} />
          )}

          {/* 阶段三：处理中 */}
          {subPhase === 'processing' && (
            <ProcessingPanel
              removeBgProgress={removeBgProgress}
              enhanceProgress={enhanceProgress}
              localError={localError}
              onRetry={runProcessing}
            />
          )}

          {/* 阶段四：完成 */}
          {subPhase === 'done' && (
            <DonePanel localError={localError} />
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

        {subPhase === 'confirm' && (
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            disabled={!editedDish}
            onClick={handleConfirmAndProcess}
          >
            <Scissors className="w-4 h-4 mr-1" />
            确认并开始处理
          </Button>
        )}

        {subPhase === 'done' && (
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            onClick={nextStep}
          >
            <ChevronRight className="w-4 h-4 mr-1" />
            下一步：选择风格
          </Button>
        )}
      </div>
    </div>
  );
}

// ================================================================
// 子组件
// ================================================================

function StepIndicator({ subPhase }: { subPhase: SubPhase }) {
  const steps = [
    { key: 'recognizing', label: 'AI 识别', icon: '🤖' },
    { key: 'confirm',     label: '确认结果', icon: '✏️' },
    { key: 'processing',  label: '图片处理', icon: '✂️' },
    { key: 'done',        label: '处理完成', icon: '✅' },
  ] as const;

  const order: SubPhase[] = ['recognizing', 'confirm', 'processing', 'done'];
  const currentIdx = order.indexOf(subPhase);

  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              active  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' :
              done    ? 'bg-neutral-800 text-neutral-400 border border-neutral-700' :
                        'bg-neutral-900 text-neutral-600 border border-neutral-800'
            }`}>
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-px mx-1 ${done ? 'bg-orange-500/50' : 'bg-neutral-800'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImagePreview({
  originalImage, removedBgImage, processedImage, subPhase, useRemovedBg, onToggle,
}: {
  originalImage: string | null;
  removedBgImage: string | null;
  processedImage: string | null;
  subPhase: SubPhase;
  useRemovedBg: boolean;
  onToggle: (v: boolean) => void;
}) {
  const showToggle = subPhase === 'done' && removedBgImage;
  const displaySrc = subPhase === 'done' && processedImage ? processedImage : originalImage;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500 uppercase tracking-wider">
          {subPhase === 'done' ? '最终图片' : '原始照片'}
        </p>
        {showToggle && (
          <div className="flex gap-1 bg-neutral-800 rounded-lg p-0.5">
            <button
              className={`px-2 py-0.5 text-xs rounded-md transition-colors ${useRemovedBg ? 'bg-orange-500 text-white' : 'text-neutral-400'}`}
              onClick={() => onToggle(true)}
            >
              抠图
            </button>
            <button
              className={`px-2 py-0.5 text-xs rounded-md transition-colors ${!useRemovedBg ? 'bg-orange-500 text-white' : 'text-neutral-400'}`}
              onClick={() => onToggle(false)}
            >
              原图增强
            </button>
          </div>
        )}
      </div>

      <div className={`rounded-2xl overflow-hidden border ${
        subPhase === 'recognizing' ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.2)] animate-pulse' :
        subPhase === 'processing'  ? 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)]' :
        subPhase === 'done'        ? 'border-green-500/40' :
                                     'border-neutral-700'
      } ${subPhase === 'done' && useRemovedBg ? 'bg-[repeating-conic-gradient(#2a2a2a_0%_25%,#1a1a1a_0%_50%)] bg-[length:16px_16px]' : ''}`}>
        {displaySrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displaySrc} alt="菜品照片" className="w-full object-contain max-h-80" />
        )}
      </div>
    </div>
  );
}

function RecognizingPanel({
  localError, isRecognizing, onRetry,
}: {
  localError: string | null;
  isRecognizing: boolean;
  onRetry: () => void;
}) {
  if (isRecognizing) {
    return (
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
    );
  }

  if (localError) {
    return (
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
          onClick={onRetry}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          重试
        </Button>
      </div>
    );
  }

  return null;
}

function DishInfoCard({
  dish, onChange,
}: {
  dish: DishInfo;
  onChange: (d: DishInfo) => void;
}) {
  return (
    <div className="bg-neutral-900 rounded-2xl border border-neutral-700 p-5 flex flex-col gap-4">
      {/* 菜品名称（可编辑） */}
      <div>
        <Input
          value={dish.name}
          onChange={(e) => onChange({ ...dish, name: e.target.value })}
          className="text-xl font-bold bg-transparent border-0 border-b border-neutral-700 rounded-none px-0 text-white focus-visible:ring-0 focus-visible:border-orange-500 mb-1"
        />
        <Input
          value={dish.nameEn}
          onChange={(e) => onChange({ ...dish, nameEn: e.target.value })}
          className="text-sm bg-transparent border-0 border-b border-neutral-800 rounded-none px-0 text-neutral-400 focus-visible:ring-0 focus-visible:border-orange-500"
        />
      </div>

      {/* 菜系标签 */}
      {dish.cuisine && (
        <Badge variant="secondary" className="self-start bg-orange-500/20 text-orange-300 border-orange-500/30">
          {dish.cuisine}
        </Badge>
      )}

      {/* 描述 */}
      <div className="flex flex-col gap-1">
        <Input
          value={dish.description}
          onChange={(e) => onChange({ ...dish, description: e.target.value })}
          className="text-sm bg-neutral-800/50 border-neutral-700 text-neutral-300"
          placeholder="中文描述"
        />
        <Input
          value={dish.descriptionEn}
          onChange={(e) => onChange({ ...dish, descriptionEn: e.target.value })}
          className="text-sm bg-neutral-800/50 border-neutral-700 text-neutral-400"
          placeholder="English description"
        />
      </div>

      {/* 食材 */}
      {dish.ingredients.length > 0 && (
        <div>
          <p className="text-xs text-neutral-500 mb-2">主要食材</p>
          <div className="flex flex-wrap gap-1.5">
            {dish.ingredients.map((ing) => (
              <Badge key={ing} variant="outline" className="text-xs border-neutral-700 text-neutral-400">
                {ing}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 拍摄信息（只读） */}
      <div className="flex gap-3 text-xs text-neutral-600">
        <span>光线：{dish.lightingDirection}</span>
        <span>角度：{dish.shootingAngle}</span>
      </div>

      {/* 置信度 */}
      <div>
        <div className="flex justify-between text-xs text-neutral-500 mb-1">
          <span>识别置信度</span>
          <span>{Math.round(dish.confidence * 100)}%</span>
        </div>
        <Progress value={dish.confidence * 100} className="h-2 bg-neutral-800" />
      </div>
    </div>
  );
}

function ProcessingPanel({
  removeBgProgress, enhanceProgress, localError, onRetry,
}: {
  removeBgProgress: number;
  enhanceProgress: number;
  localError: string | null;
  onRetry: () => void;
}) {
  if (localError) {
    return (
      <div className="bg-red-950/30 border border-red-800 rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">处理失败</span>
        </div>
        <p className="text-red-300 text-sm">{localError}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-red-800 text-red-400 hover:text-red-300 self-start"
          onClick={onRetry}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 rounded-2xl border border-neutral-700 p-5 flex flex-col gap-5">
      {/* 抠图进度 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-blue-400">
            <Scissors className="w-4 h-4" />
            <span>AI 智能抠图</span>
          </div>
          <span className="text-neutral-500 text-xs">{removeBgProgress}%</span>
        </div>
        <Progress value={removeBgProgress} className="h-2 bg-neutral-800" />
        {removeBgProgress === 100 && (
          <p className="text-xs text-green-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> 抠图完成
          </p>
        )}
      </div>

      {/* 增强进度 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <div className={`flex items-center gap-2 ${removeBgProgress === 100 ? 'text-purple-400' : 'text-neutral-600'}`}>
            <Sparkles className="w-4 h-4" />
            <span>图片增强</span>
          </div>
          <span className="text-neutral-500 text-xs">{enhanceProgress}%</span>
        </div>
        <Progress value={enhanceProgress} className="h-2 bg-neutral-800" />
        {enhanceProgress === 100 && (
          <p className="text-xs text-green-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> 增强完成
          </p>
        )}
      </div>

      <p className="text-xs text-neutral-600">首次运行需下载 AI 模型（约 20MB），请耐心等待…</p>
    </div>
  );
}

function DonePanel({ localError }: { localError: string | null }) {
  if (localError) return null;
  return (
    <div className="bg-green-950/30 border border-green-800/50 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-green-400">
        <CheckCircle className="w-5 h-5" />
        <span className="font-medium">图片处理完成！</span>
      </div>
      <p className="text-neutral-400 text-sm">
        抠图和增强均已完成，可在左侧切换查看效果，然后继续下一步选择海报风格。
      </p>
    </div>
  );
}
