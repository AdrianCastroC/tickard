import { useState } from 'react'
import { api, type Profile } from '../../api'
import { ComputerIcon, MoonIcon, SunIcon } from '../../shared/ui'
import styles from './AccountModal.module.css'
import { setTheme, type UserTheme } from './theme'

type Props = { profile: Profile; workspaceId: number | null; onProfile: (value: Profile) => void }
export function SettingsSection({ profile, workspaceId, onProfile }: Props) {
  const [error, setError] = useState('')
  const mePath = workspaceId ? `/me?workspace_id=${workspaceId}` : '/me'
  async function saveNotify(field: 'notify_in_app' | 'notify_email', value: boolean) {
    setError('')
    try { onProfile(await api<Profile>(mePath, { method: 'PATCH', body: JSON.stringify({ [field]: value }) })) }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar la configuración.') }
  }
  function themeButton(theme: UserTheme, label: string, Icon: typeof ComputerIcon) {
    return <button type="button" className={profile.user.theme === theme ? 'on' : undefined} aria-label={label} title={label} aria-pressed={profile.user.theme === theme} onClick={() => void setTheme(onProfile, theme, workspaceId)}><Icon /></button>
  }
  return <div className={styles.modalBody}>
    <p className={styles.panelKicker}>Tema</p><div className={styles.themeSwitch} role="group" aria-label="Tema">{themeButton('system', 'Ordenador', ComputerIcon)}{themeButton('light', 'Claro', SunIcon)}{themeButton('dark', 'Oscuro', MoonIcon)}</div>
    <p className={styles.panelKicker}>Avisos</p>
    <label className={styles.toggle}><span><strong>Avisos en la app</strong><small>Asignaciones y comentarios dentro de tickard</small></span><input type="checkbox" checked={profile.user.notify_in_app} onChange={(event) => void saveNotify('notify_in_app', event.target.checked)} /></label>
    <label className={styles.toggle}><span><strong>Avisos por correo</strong><small>Asignaciones y comentarios de cliente</small></span><input type="checkbox" checked={profile.user.notify_email} onChange={(event) => void saveNotify('notify_email', event.target.checked)} /></label>
    {error && <p className="error">{error}</p>}
  </div>
}
