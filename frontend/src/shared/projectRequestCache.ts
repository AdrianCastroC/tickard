// Short-lived GET cache for project views, shared by remounts and StrictMode.
// Subscribers can cancel independently; abandoned underlying requests are aborted.
type CacheEntry = {
  value?: unknown
  expiresAt: number
  pending?: Promise<unknown>
  controller?: AbortController
  subscribers: number
  abortTimer?: ReturnType<typeof setTimeout>
}

const TTL_MS = 20_000
const MAX_ENTRIES = 80
const cache = new Map<string, CacheEntry>()

function aborted(): DOMException {
  return new DOMException('Petición cancelada', 'AbortError')
}

export function clearProjectRequestCache() {
  cache.clear()
}

export function invalidateProjectRequestCache(key: string) {
  cache.delete(key)
}

export function cachedProjectRequest<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(aborted())

  let entry = cache.get(key)
  if (entry && !entry.pending && entry.expiresAt > Date.now()) {
    return Promise.resolve(entry.value as T)
  }
  if (!entry?.pending) {
    const controller = new AbortController()
    const request: CacheEntry = { expiresAt: 0, controller, subscribers: 0 }
    cache.set(key, request)
    // Defer execution to allow React StrictMode's cleanup/remount to reuse it.
    request.pending = Promise.resolve().then(() => loader(controller.signal)).then(
      (result) => {
        request.pending = undefined
        request.controller = undefined
        if (cache.get(key) === request) {
          request.value = result
          request.expiresAt = Date.now() + TTL_MS
          const now = Date.now()
          for (const [cachedKey, cached] of cache) {
            if (!cached.pending && cached.expiresAt <= now) cache.delete(cachedKey)
          }
          if (cache.size > MAX_ENTRIES) {
            for (const [cachedKey, cached] of cache) {
              if (cache.size <= MAX_ENTRIES) break
              if (!cached.pending) cache.delete(cachedKey)
            }
          }
        }
        return result
      },
      (error: unknown) => {
        request.pending = undefined
        request.controller = undefined
        if (cache.get(key) === request) cache.delete(key)
        throw error
      },
    )
    entry = request
  }

  const active = entry
  if (active.abortTimer !== undefined) {
    clearTimeout(active.abortTimer)
    active.abortTimer = undefined
  }
  active.subscribers++
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const release = () => {
      if (settled) return false
      settled = true
      signal?.removeEventListener('abort', onAbort)
      active.subscribers--
      return true
    }
    const onAbort = () => {
      if (!release()) return
      reject(aborted())
      if (active.subscribers === 0 && active.pending) {
        // Keep the request reusable for an immediate StrictMode remount.
        active.abortTimer = setTimeout(() => {
          active.abortTimer = undefined
          if (active.subscribers !== 0 || !active.pending) return
          if (cache.get(key) === active) cache.delete(key)
          active.controller?.abort()
        }, 0)
      }
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    active.pending!.then(
      (result) => { if (release()) resolve(result as T) },
      (error: unknown) => { if (release()) reject(error) },
    )
  })
}
