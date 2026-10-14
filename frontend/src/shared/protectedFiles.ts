import { useEffect, useState } from 'react'
import { getToken } from '../api'

export async function fetchProtectedFile(url: string, signal?: AbortSignal): Promise<Blob> {
  if (!/^\/api\/(attachments|project-files)\/\d+\/content$/.test(url)) {
    throw new Error('Ruta de archivo no válida.')
  }
  const headers = new Headers({ Accept: '*/*' })
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const result = await fetch(url, { headers, signal, cache: 'no-store' })
  if (!result.ok) throw new Error(result.status === 403 ? 'No tienes acceso a este archivo.' : 'No se pudo abrir el archivo.')
  return result.blob()
}

export function useProtectedPreview(url: string | null): { src: string | null; error: string | null } {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let localUrl: string | null = null
    const abort = new AbortController()
    setSrc(null)
    setError(null)
    if (url) {
      void fetchProtectedFile(url, abort.signal).then((file) => {
        if (!alive) return
        localUrl = URL.createObjectURL(file)
        setSrc(localUrl)
      }).catch((cause: unknown) => {
        if (alive && !abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo abrir el archivo.')
      })
    }
    return () => {
      alive = false
      abort.abort()
      if (localUrl) URL.revokeObjectURL(localUrl)
    }
  }, [url])

  return { src, error }
}

/** Render old text-based attachments as escaped React text, never as HTML. */
export function useProtectedTextPreview(url: string | null): { text: string | null; error: string | null } {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    setText(null)
    setError(null)
    if (url) {
      void fetchProtectedFile(url, abort.signal).then(async (blob) => {
        if (blob.size > 1024 * 1024) throw new Error('El archivo es demasiado grande para una vista previa de texto.')
        const content = await blob.text()
        if (!abort.signal.aborted) setText(content)
      }).catch((cause: unknown) => {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el texto.')
      })
    }
    return () => { abort.abort() }
  }, [url])

  return { text, error }
}

export async function downloadProtectedFile(url: string, filename: string): Promise<void> {
  const file = await fetchProtectedFile(url)
  const objectUrl = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

export async function openProtectedFile(url: string): Promise<void> {
  // Open synchronously before awaiting the authenticated fetch to avoid popup blockers.
  const tab = window.open('', '_blank')
  try {
    const file = await fetchProtectedFile(url)
    const previewable = [
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].includes(file.type)
    if (!previewable) throw new Error('Este formato solo se puede descargar.')
    const objectUrl = URL.createObjectURL(file)
    if (tab) {
      tab.location.href = objectUrl
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    } else {
      URL.revokeObjectURL(objectUrl)
      throw new Error('El navegador ha bloqueado la pestaña nueva.')
    }
  } catch (error) {
    tab?.close()
    throw error
  }
}
