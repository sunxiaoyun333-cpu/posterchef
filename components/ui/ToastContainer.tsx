'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { toast as toastStore, type ToastItem } from '@/lib/toast';

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  warn:    AlertTriangle,
  info:    Info,
};

const STYLES = {
  success: 'border-green-500/40  bg-green-950/80  text-green-200',
  error:   'border-red-500/40    bg-red-950/80    text-red-200',
  warn:    'border-yellow-500/40 bg-yellow-950/80 text-yellow-200',
  info:    'border-blue-500/40   bg-blue-950/80   text-blue-200',
};

const ICON_STYLES = {
  success: 'text-green-400',
  error:   'text-red-400',
  warn:    'text-yellow-400',
  info:    'text-blue-400',
};

function ToastCard({ item }: { item: ToastItem }) {
  const [visible, setVisible] = useState(false);
  const Icon = ICONS[item.type];

  useEffect(() => {
    // 进入动画
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-xl
        max-w-sm w-full text-sm leading-snug
        transition-all duration-300
        ${STYLES[item.type]}
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ICON_STYLES[item.type]}`} />
      <span className="flex-1">{item.message}</span>
      <button
        onClick={() => toastStore.remove(item.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toastStore.subscribe(setItems);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastCard item={item} />
        </div>
      ))}
    </div>
  );
}
