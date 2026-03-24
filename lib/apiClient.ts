/**
 * apiClient.ts — 带超时的统一 API 调用封装
 *
 * 所有 fetch 请求统一经过此层：
 *  - AbortController 超时（默认 30s）
 *  - 友好的错误映射（中英双语）
 *  - Gemini 限流 / 超时特殊处理
 *  - 网络断开检测
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: 'timeout' | 'rate_limit' | 'network' | 'server' | 'client',
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface FetchOptions extends RequestInit {
  /** 超时毫秒数，默认 30000 */
  timeoutMs?: number;
}

/**
 * 友好错误消息映射（中英双语）
 */
function buildErrorMessage(status: number, rawMessage?: string): string {
  if (rawMessage?.toLowerCase().includes('quota') || rawMessage?.toLowerCase().includes('rate')) {
    return 'AI 服务繁忙，请稍后重试 / AI service is busy, please retry later';
  }
  if (status === 429) {
    return 'AI 接口限流，请等待 30 秒后重试 / Rate limited, please wait 30s and retry';
  }
  if (status === 503 || status === 502) {
    return 'AI 服务暂时不可用，请稍后重试 / AI service unavailable, please try again';
  }
  if (status >= 500) {
    return '服务器内部错误，请刷新页面重试 / Server error, please refresh and retry';
  }
  if (status === 413) {
    return '图片文件过大，请压缩后上传 / Image too large, please compress before uploading';
  }
  return rawMessage || '请求失败，请重试 / Request failed, please retry';
}

/**
 * 带超时的 fetch 封装
 */
export async function apiFetch(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { timeoutMs = 30_000, signal: externalSignal, ...rest } = options;

  // 网络连接检查
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ApiError(
      '网络已断开，请检查网络连接 / No network connection',
      'network',
    );
  }

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort('timeout'), timeoutMs);

  // 合并外部 signal
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    clearTimeout(timerId);

    if (!res.ok) {
      let rawMessage: string | undefined;
      try {
        const json = await res.clone().json();
        rawMessage = json?.error;
      } catch {/* ignore */}

      const msg = buildErrorMessage(res.status, rawMessage);
      const code = res.status === 429 ? 'rate_limit' : res.status >= 500 ? 'server' : 'client';
      throw new ApiError(msg, code, res.status);
    }

    return res;
  } catch (err) {
    clearTimeout(timerId);

    if (err instanceof ApiError) throw err;

    if (err instanceof DOMException && err.name === 'AbortError') {
      const reason = (err as DOMException).message;
      if (reason === 'timeout') {
        throw new ApiError(
          'AI 响应超时，请重试 / AI response timed out, please retry',
          'timeout',
        );
      }
      throw new ApiError('请求已取消 / Request cancelled', 'client');
    }

    if (!navigator.onLine) {
      throw new ApiError(
        '网络已断开，请检查网络连接 / Network disconnected',
        'network',
      );
    }

    throw new ApiError(
      (err as Error)?.message || '未知错误 / Unknown error',
      'server',
    );
  }
}

/**
 * 便捷的 JSON POST
 */
export async function apiPost<T>(
  url: string,
  body: unknown,
  options: Omit<FetchOptions, 'method' | 'body' | 'headers'> = {},
): Promise<T> {
  const res = await apiFetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    ...options,
  });
  return res.json() as Promise<T>;
}
