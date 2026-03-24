'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

/**
 * useNetworkStatus — 监听网络断开 / 恢复事件，显示 Toast 提示
 * 在 app 根层组件中调用一次即可
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOffline = () => {
      setIsOnline(false);
      toast.error('网络已断开，请检查网络连接 / Network disconnected', 8000);
    };
    const onOnline = () => {
      setIsOnline(true);
      toast.success('网络已恢复 / Network restored');
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online',  onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online',  onOnline);
    };
  }, []);

  return isOnline;
}
