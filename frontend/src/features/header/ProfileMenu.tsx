import { useEffect, useRef, useState } from 'react'
import { api, setToken, type Profile } from '../../api'
import { Avatar, BellIcon, GlobeIcon, HelpCircleIcon, LogoutIcon, PencilIcon, ProfileUserIcon, SettingsIcon, SparklesIcon } from '../../shared/ui'
import styles from './Header.module.css'

type ProfileMenuProps = {
  profile: Profile
  onOpenProfile: () => void
  onOpenSettings: () => void
  onOpenNotifications: () => void
  onNotesChange: (notes: { id: number; body: string }[]) => void
  onAvatarChange: (file: File) => void | Promise<void>
}

export function ProfileMenu({ profile, onOpenProfile, onOpenSettings, onOpenNotifications, onNotesChange, onAvatarChange }: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function openAccount() {
    setOpen(true)
    const items = await api<{ id: number; body: string }[]>('/notifications')
    onNotesChange(items)
  }

  function openSection(section: () => void) {
    setOpen(false)
    section()
  }

  async function logout() {
    await api('/logout', { method: 'POST' })
    setToken(null)
    window.location.href = '/login'
  }

  return (
    <div className={styles.account} ref={accountRef}>
      <button
        className={`${styles.avatarButton}${open ? ` ${styles.avatarButtonOn}` : ''}`}
        type="button"
        aria-expanded={open}
        aria-label="Cuenta"
        onClick={() => (open ? setOpen(false) : void openAccount())}
      >
        <Avatar id={profile.user.id} name={profile.user.name} size={80} className="avatar" src={profile.user.avatar_url} />
        {profile.unread > 0 && <i className={styles.badge}>{profile.unread}</i>}
      </button>
      {open && (
        <div className={styles.accountMenu}>
          <div className={styles.accountHead}>
            <button type="button" className="account-avatar" aria-label="Cambiar foto de perfil" title="Cambiar foto de perfil" onClick={() => avatarInputRef.current?.click()}>
              <Avatar id={profile.user.id} name={profile.user.name} size={52} className="avatar" src={profile.user.avatar_url} />
              <span className="account-avatar-edit"><PencilIcon className="account-avatar-pencil" /></span>
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void onAvatarChange(file)
            }} />
            <div className={styles.accountHeadText}>
              <strong>{profile.user.name}</strong>
              <span>{profile.user.email}</span>
              <em className={styles.accountPlan}>{profile.user.is_admin ? 'Administrador' : profile.user.client_company ? 'Cliente' : 'Miembro'}{' · '}{profile.user.plan.charAt(0).toUpperCase() + profile.user.plan.slice(1)}</em>
            </div>
          </div>
          <div className={styles.accountSection}>
            <button type="button" className={styles.accountItem} onClick={() => openSection(onOpenProfile)}><ProfileUserIcon /> Mi perfil</button>
            <button type="button" className={styles.accountItem} onClick={() => openSection(onOpenSettings)}><SettingsIcon /> Configuración</button>
            <button type="button" className={styles.accountItem} onClick={() => openSection(onOpenNotifications)}><BellIcon /> Notificaciones{profile.unread > 0 && <i className={styles.accountBadge}>{profile.unread}</i>}</button>
            <button type="button" className={styles.accountItem} disabled><GlobeIcon /> Idioma<span className={styles.accountMeta}>Español</span></button>
          </div>
          <div className={styles.accountSection}>
            <button type="button" className={styles.accountItem} disabled><HelpCircleIcon /> Ayuda y soporte</button>
            <button type="button" className={styles.accountItem} disabled><SparklesIcon /> Novedades</button>
          </div>
          <div className={styles.accountSection}>
            <button type="button" className={`${styles.accountItem} ${styles.danger}`} onClick={() => void logout()}><LogoutIcon /> Cerrar sesión</button>
          </div>
        </div>
      )}
    </div>
  )
}
