'use client';

import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { usePosterStore } from '@/lib/store/posterStore';
import StepUpload from '@/components/create/StepUpload';
import StepRecognize from '@/components/create/StepRecognize';
import StepGenerate from '@/components/create/StepGenerate';

const STEP_LABELS = [
  '上传照片',
  'AI 识别',
  '智能抠图',
  '选择风格',
  '生成文案',
  '编辑海报',
  '导出',
];

export default function CreatePage() {
  const { currentStep } = usePosterStore();

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* 顶部导航 */}
      <nav className="border-b border-white/10 px-6 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
          <ChefHat className="w-5 h-5 text-orange-400" />
          <span className="text-sm font-medium">PosterChef</span>
        </Link>

        {/* 步骤指示器 */}
        <div className="flex items-center gap-1 ml-4 overflow-x-auto">
          {STEP_LABELS.map((label, i) => {
            const step = i + 1;
            const isActive = step === currentStep;
            const isDone = step < currentStep;
            return (
              <div key={step} className="flex items-center gap-1 shrink-0">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                    ${isActive ? 'bg-orange-500 text-white' : isDone ? 'bg-neutral-700 text-neutral-300' : 'text-neutral-600'}`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px]
                    ${isActive ? 'bg-white/20' : isDone ? 'bg-green-500' : 'bg-neutral-800'}`}
                  >
                    {isDone ? '✓' : step}
                  </span>
                  {label}
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`w-4 h-px ${isDone ? 'bg-neutral-600' : 'bg-neutral-800'}`} />
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* 主体内容 */}
      <main className="flex-1 flex items-start justify-center px-6 py-10">
        {currentStep === 1 && <StepUpload />}
        {currentStep === 2 && <StepRecognize />}
        {currentStep >= 3 && <StepGenerate />}
      </main>
    </div>
  );
}
