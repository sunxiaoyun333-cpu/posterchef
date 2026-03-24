'use client';

/**
 * toast.ts — 轻量 Toast 通知系统
 *
 * 使用方式：
 *   import { toast } from '@/lib/toast';
 *   toast.success('操作成功');
 *   toast.error('网络错误，请重试 / Network error, please retry');
 *   toast.warn('API 限流，稍后重试 / Rate limited, retry later');
 *   toast.info('提示信息');
 */

export type ToastType = 'success' | 'error' | 'warn' | 'info';

export interface ToastItem {
  id:       string;
  type:     ToastType;
  message:  string;
  duration: number;
}

type Listener = (items: ToastItem[]) => void;

class ToastStore {
  private items: ToastItem[] = [];
  private listeners: Listener[] = [];

  subscribe(fn: Listener) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  private notify() {
    this.listeners.forEach((fn) => fn([...this.items]));
  }

  add(type: ToastType, message: string, duration = 4000) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.items = [...this.items, { id, type, message, duration }];
    this.notify();
    setTimeout(() => this.remove(id), duration);
    return id;
  }

  remove(id: string) {
    this.items = this.items.filter((t) => t.id !== id);
    this.notify();
  }

  success(msg: string, duration?: number) { return this.add('success', msg, duration); }
  error(msg: string, duration?: number)   { return this.add('error',   msg, duration ?? 6000); }
  warn(msg: string, duration?: number)    { return this.add('warn',    msg, duration ?? 5000); }
  info(msg: string, duration?: number)    { return this.add('info',    msg, duration); }
}

export const toast = new ToastStore();
