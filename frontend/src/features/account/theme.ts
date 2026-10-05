import { api, type Profile } from '../../api'

export type UserTheme = Profile['user']['theme']

export function resolveTheme(theme: UserTheme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export async function setTheme(onProfile: (value: Profile) => void, theme: UserTheme, workspaceId: number | null) {
  document.documentElement.dataset.theme = resolveTheme(theme)
  const path = workspaceId ? `/me?workspace_id=${workspaceId}` : '/me'
  const next = await api<Profile>(path, { method: 'PATCH', body: JSON.stringify({ theme }) })
  onProfile(next)
}
