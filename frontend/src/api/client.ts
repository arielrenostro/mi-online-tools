const BASE_URL            = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const DEFAULT_TIMEOUT_MS  = 30_000
const UPLOAD_TIMEOUT_MS   = 120_000

export { UPLOAD_TIMEOUT_MS }

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly raw?: unknown,
  ) {
    super(`API ${status}: ${detail}`)
    this.name = 'ApiError'
  }
}

export class NetworkError extends Error {
  constructor(public readonly cause?: unknown) {
    super('Sem conexão com o servidor')
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Requisição expirou após ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options
  const url        = `${BASE_URL}${path}`
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const detail = typeof body?.detail === 'string'
        ? body.detail
        : JSON.stringify(body.detail ?? res.statusText)
      throw new ApiError(res.status, detail, body)
    }

    return (await res.json()) as T
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof ApiError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') throw new TimeoutError(timeoutMs)
    throw new NetworkError(err)
  }
}

export async function computeHash(file: File): Promise<string> {
  const buffer     = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer)
  const hex        = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `sha1:${hex}`
}
