import { useEffect } from 'react'
import { api, type Profile } from '../../api'
import { BellIcon, ProfileUserIcon, SettingsIcon } from '../../shared/ui'
import { CloseIcon } from '../cards/CardDetail'
import styles from './AccountModal.module.css'
import { NotificationsSection } from './NotificationsSection'
import { ProfileSection } from './ProfileSection'
import { SettingsSection } from './SettingsSection'

export type AccountSection = 'profile' | 'settings' | 'notifications'
type Props = { section: AccountSection; profile: Profile; notes: { id: number; body: string }[]; workspaceId: number | null; onSection: (section: AccountSection) => void; onProfile: (value: Profile) => void; onNotes: (value: { id: number; body: string }[]) => void; onClose: () => void; onAvatar: (file: File) => Promise<void> }
export function AccountModal({ section, profile, notes, workspaceId, onSection, onProfile, onNotes, onClose, onAvatar }: Props) {
  useEffect(() => {
    if (section !== 'notifications') return
    let cancelled = false
    void (async () => { const items = await api<{ id: number; body: string }[]>('/notifications'); if (cancelled) return; onNotes(items); if (profile.unread > 0) { await api('/notifications/read', { method: 'POST' }); if (!cancelled) onProfile({ ...profile, unread: 0 }) } })()
    return () => { cancelled = true }
  }, [section])
  const titles = { profile: 'Mi perfil', settings: 'Configuración', notifications: 'Notificaciones' } as const
  return <div className="modal-back" onClick={onClose}><div className={`modal ${styles.modal}`} onClick={(event) => event.stopPropagation()}>
    <div className={styles.nav}>
      <button type="button" className={section === 'profile' ? styles.active : undefined} onClick={() => onSection('profile')}><ProfileUserIcon /> Mi perfil</button>
      <button type="button" className={section === 'settings' ? styles.active : undefined} onClick={() => onSection('settings')}><SettingsIcon /> Configuración</button>
      <button type="button" className={section === 'notifications' ? styles.active : undefined} onClick={() => onSection('notifications')}><BellIcon /> Notificaciones {profile.unread > 0 && <i className="account-badge">{profile.unread}</i>}</button>
    </div>
    <div className={styles.main}><div className={`row ${styles.head}`}><h2>{titles[section]}</h2><button className="icon-close" type="button" aria-label="Cerrar" onClick={onClose}><CloseIcon /></button></div>
      {section === 'profile' && <ProfileSection profile={profile} workspaceId={workspaceId} onProfile={onProfile} onAvatar={onAvatar} />}
      {section === 'settings' && <SettingsSection profile={profile} workspaceId={workspaceId} onProfile={onProfile} />}
      {section === 'notifications' && <NotificationsSection notes={notes} />}
    </div>
  </div></div>
}
