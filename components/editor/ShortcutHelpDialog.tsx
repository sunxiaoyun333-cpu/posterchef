'use client';

import { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { key: '?',             desc: '显示快捷键帮助 / Show shortcuts' },
  { key: 'Delete / Backspace', desc: '删除选中对象 / Delete selected' },
  { key: 'ESC',           desc: '退出编辑 / 取消选中 / Deselect' },
  { key: '↑ ↓ ← →',      desc: '微移 1px / Nudge 1px' },
  { key: 'Shift + 方向键', desc: '微移 10px / Nudge 10px' },
  { key: 'Ctrl + 滚轮',   desc: '缩放画布 / Zoom canvas' },
  { key: '双击文字',       desc: '进入文字编辑 / Edit text' },
  { key: '拖拽元素',       desc: '移动 + 自动吸附 / Move + snap' },
];

export default function ShortcutHelpDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 文字输入中不触发
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === '?') setOpen((v) => !v);
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="快捷键帮助 (按 ?)"
        className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-neutral-500 hover:text-white hover:border-white/20 transition-colors text-xs"
      >
        <Keyboard className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">?</span>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-6 w-[380px] max-w-[90vw]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-orange-400" />
            <span className="font-semibold text-white text-sm">编辑器快捷键</span>
            <span className="text-neutral-500 text-xs">/ Keyboard Shortcuts</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-1.5 border-b border-neutral-800 last:border-0">
              <kbd className="text-xs text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded font-mono whitespace-nowrap">
                {key}
              </kbd>
              <span className="text-xs text-neutral-400 text-right">{desc}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-neutral-600 text-center mt-4">按 ESC 或点击外部关闭 / Press ESC or click outside</p>
      </div>
    </div>
  );
}
