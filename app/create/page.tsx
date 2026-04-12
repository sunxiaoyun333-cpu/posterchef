'use client';

import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePosterStore } from '@/lib/store/posterStore';
import { useNetworkStatus } from '@/lib/hooks/useNetworkStatus';
import StepUpload    from '@/components/create/StepUpload';
import StepRecognize from '@/components/create/StepRecognize';
import StepGenerate  from '@/components/create/StepGenerate';
import StepEditor    from '@/components/create/StepEditor';
import StepExport    from '@/components/create/StepExport';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

const STEP_LABELS = [
  '上传照片',
  'AI 识别',
  '生成海报',
  '精细编辑',
  '导出',
];

const FULLSCREEN_STEPS: number[] = [4, 5];

const fadeVariants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.25, ease: 'easeOut' as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' as const } },
};

export default function CreatePage() {
  const { currentStep } = usePosterStore();
  useNetworkStatus();
  const isFullscreen = FULLSCREEN_STEPS.includes(currentStep);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* 顶部导航 */}
      <nav className="shrink-0 border-b border-white/10 px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
          <ChefHat className="w-5 h-5 text-orange-400" />
          <span className="text-sm font-medium">PosterChef</span>
        </Link>

        {/* 步骤指示器 */}
        <div className="flex items-center gap-1 ml-4 overflow-x-auto">
          {STEP_LABELS.map((label, i) => {
            const step     = i + 1;
            const isActive = step === currentStep;
            const isDone   = step < currentStep;
            return (
              <div key={step} className="flex items-center gap-1 shrink-0">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                  ${isActive ? 'bg-orange-500 text-white' : isDone ? 'bg-neutral-700 text-neutral-300' : 'text-neutral-600'}`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px]
                    ${isActive ? 'bg-white/20' : isDone ? 'bg-green-500' : 'bg-neutral-800'}`}
                  >
                    {isDone ? '✓' : step}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
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
      <main className={`flex-1 flex ${
        isFullscreen ? 'overflow-hidden' : 'items-start justify-center px-4 sm:px-6 py-10'
      }`}>
        <ErrorBoundary>
          {isFullscreen ? (
            <>
              {currentStep === 4 && <StepEditor />}
              {currentStep === 5 && <StepExport />}
            </>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                variants={fadeVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full"
              >
                {currentStep === 1 && <StepUpload />}
                {currentStep === 2 && <StepRecognize />}
                {currentStep === 3 && <StepGenerate />}
              </motion.div>
            </AnimatePresence>
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
