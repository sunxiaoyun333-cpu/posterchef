'use client';

import { IS_MOCK_MODE } from '@/lib/constants';

/**
 * Mock Mode 标签 — 仅在 NEXT_PUBLIC_MOCK_MODE=true 时显示
 */
export default function MockModeBadge() {
  if (!IS_MOCK_MODE) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9998] pointer-events-none">
      <div className="flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-500/40 backdrop-blur-sm rounded-full px-3 py-1 text-yellow-300 text-[11px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        Mock Mode — AI 功能使用模拟数据
      </div>
    </div>
  );
}
