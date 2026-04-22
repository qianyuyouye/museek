'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * 全局错误提示监听：页面可注册一个简单 toast 回调，
 * apiCall/ useApi 非 200 时自动广播 message。
 * 注册方式：在布局 Provider 里 window.__globalToast = (msg) => showToast(msg)
 */
function broadcastError(message: string | undefined) {
  if (!message || typeof window === 'undefined') return
  const fn = (window as unknown as { __globalToast?: (m: string) => void }).__globalToast
  try { fn?.(message) } catch { /* ignore */ }
}

/** 通用 GET 数据 hook */
export function useApi<T>(url: string | null, deps: unknown[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!url) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url, { credentials: 'include' })
      const json = await res.json()
      if (json.code === 200) {
        setData(json.data)
      } else {
        setError(json.message || '请求失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

/** POST/PUT/DELETE 请求 */
export async function apiCall<T = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  body?: unknown,
  opts: { silent?: boolean } = {},
): Promise<{ ok: boolean; data?: T; message?: string }> {
  try {
    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    if (json.code === 200) {
      return { ok: true, data: json.data }
    }
    const message = json.message || '操作失败'
    if (!opts.silent) broadcastError(message)
    return { ok: false, message }
  } catch {
    const message = '网络错误'
    if (!opts.silent) broadcastError(message)
    return { ok: false, message }
  }
}
