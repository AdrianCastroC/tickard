import { useEffect, useEffectEvent, useState } from 'react'
import { api, setToken, type Profile } from '../../api'
import { BellIcon, CloseIcon, LogoutIcon, ProfileUserIcon, SettingsIcon, StorageIcon } from '../../shared/icons'
import styles from './AccountModal.module.css'
import { NotificationsSection } from './NotificationsSection'
import { ProfileSection } from './ProfileSection'
import { SettingsSection } from './SettingsSection'
import { AccountStorageSection } from './AccountStorageSection'

export type AccountSection = 'profile' | 'settings' | 'notifications' | 'storage'
type Props = { section: AccountSection; profile: Profile; notes: { id: number; body: string }[]; workspaceId: number | null; onSection: (section: AccountSection) => void; onProfile: (value: Profile) => void; onNotes: (value: { id: number; body: string }[]) => void; onClose: () => void; onAvatar: (file: File) => Promise<void> }
export function AccountModal({ section, profile, notes, workspaceId, onSection, onProfile, onNotes, onClose, onAvatar }: Props) {
  const receiveNotes = useEffectEvent((items: { id: number; body: string }[]) => onNotes(items))
  useEffect(() => {
    if (section !== 'notifications') return
    let cancelled = false
    void api<{ id: number; body: string }[]>('/notifications')
      .then(items => { if (!cancelled) receiveNotes(items) })
    return () => { cancelled = true }
  }, [section])
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  async function logout() {
    if (signingOut) return
    setSigningOut(true)
    setLogoutError('')
    try {
      await api('/logout', { method: 'POST' })
      setToken(null)
      window.location.assign('/login')
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : 'No se pudo cerrar la sesión.')
      setSigningOut(false)
    }
  }
  const titles = { profile: 'Mi perfil', settings: 'Configuración', notifications: 'Notificaciones', storage: 'Almacenamiento' } as const
  return <div className="modal-back" onClick={onClose}>
    <div className={`modal ${styles.modal}`} role="dialog" aria-modal="true"
      aria-label="Mi cuenta" onClick={(event) => event.stopPropagation()}>
    <div className={styles.nav}>
      <button type="button" className={section === 'profile' ? styles.active : undefined} onClick={() => onSection('profile')}><ProfileUserIcon /> Mi perfil</button>
      <button type="button" className={section === 'settings' ? styles.active : undefined} onClick={() => onSection('settings')}><SettingsIcon /> Configuración</button>
      <button type="button" className={section === 'storage' ? styles.active : undefined} onClick={() => onSection('storage')}><StorageIcon /> Almacenamiento</button>
      <button type="button" className={section === 'notifications' ? styles.active : undefined} onClick={() => onSection('notifications')}><BellIcon /> Notificaciones {profile.unread > 0 && <i className="account-badge">{profile.unread}</i>}</button>
      <div className={styles.navLogout}>
        {logoutError && <p role="alert">{logoutError}</p>}
        <button type="button" onClick={() => void logout()} disabled={signingOut}>
          <LogoutIcon /> {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
    <div className={styles.main}><div className={`row ${styles.head}`}><h2>{titles[section]}</h2><button className="icon-close" type="button" aria-label="Cerrar" onClick={onClose}><CloseIcon /></button></div>
      {section === 'profile' && <ProfileSection profile={profile} workspaceId={workspaceId} onProfile={onProfile} onAvatar={onAvatar} />}
      {section === 'settings' && <SettingsSection profile={profile} workspaceId={workspaceId} onProfile={onProfile} />}
      {section === 'notifications' && <NotificationsSection notes={notes} />}
      {section === 'storage' && <AccountStorageSection />}
    </div>
  </div></div>
}
