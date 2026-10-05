import { useCallback, useEffect, useRef, useState } from 'react'
import { api, setToken, type Profile } from '../../api'
import { resolveTheme } from '../account/theme'

type Session = { id: number | null; profile: Profile }
const profilePath = (id?: number | null) => id ? `/me?workspace_id=${id}` : '/me'

function persistWorkspace(id: number | null) {
  try {
    if (id) localStorage.setItem('tickard:active-workspace', String(id))
    else localStorage.removeItem('tickard:active-workspace')
  } catch { /* Storage may be unavailable. */ }
}

export function useWorkspace() {
  const [session, setSession] = useState<Session | null>(null)
  const requests = useRef({ version: 0 })

  useEffect(() => {
    const lifetime = requests.current
    const version = ++lifetime.version
    void (async () => {
      let stored: number | null = null
      try {
        const value = Number(localStorage.getItem('tickard:active-workspace'))
        if (Number.isSafeInteger(value) && value > 0) stored = value
      } catch { /* Storage may be unavailable. */ }
      // Validate membership before using a possibly obsolete persisted workspace.
      let profile = await api<Profile>('/me')
      const id = profile.workspaces.some((workspace) => workspace.id === stored)
        ? stored : profile.workspaces[0]?.id ?? null
      if (id) profile = await api<Profile>(profilePath(id))
      if (version !== lifetime.version) return
      persistWorkspace(id)
      setSession({ id, profile })
    })().catch(() => {
      if (version !== lifetime.version) return
      setToken(null)
      window.location.href = '/login'
    })
    return () => { lifetime.version++ }
  }, [])

  const activeWorkspaceId = session?.id ?? null
  const refreshProfile = useCallback(async (id: number | null = activeWorkspaceId) => {
    const version = requests.current.version
    const profile = await api<Profile>(profilePath(id))
    if (version === requests.current.version) {
      setSession((current) => current?.id === id ? { ...current, profile } : current)
    }
    return profile
  }, [activeWorkspaceId])

  async function changeWorkspace(id: number) {
    if (id === activeWorkspaceId) { await refreshProfile(id); return }
    const version = ++requests.current.version
    const profile = await api<Profile>(profilePath(id))
    if (version !== requests.current.version) return
    persistWorkspace(id)
    setSession({ id, profile })
  }

  const updateProfile = useCallback((profile: Profile) => {
    setSession((current) => current?.id === activeWorkspaceId ? { ...current, profile } : current)
  }, [activeWorkspaceId])

  const theme = session?.profile.user.theme
  useEffect(() => {
    if (!theme) return
    const sync = () => { document.documentElement.dataset.theme = resolveTheme(theme) }
    sync()
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [theme])

  return { profile: session?.profile ?? null, activeWorkspaceId, refreshProfile, updateProfile, changeWorkspace }
}
