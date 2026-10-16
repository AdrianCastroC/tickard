import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, setToken, type Profile } from '../../api'
import { Avatar } from '../../shared/ui'
import { BellIcon, LogoutIcon, ProfileUserIcon, SettingsIcon } from '../../shared/icons'
import type { AccountSection } from './AccountModal'
import styles from './AccountFooter.module.css'

const planNames: Record<string, string> = {
  free: 'Free', base: 'Base', pro: 'Pro', business: 'Business',
}

export function AccountFooter({ profile, mini }: { profile: Profile; mini: boolean }) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const [position, setPosition] = useState<{ left: number; bottom: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  const plan = planNames[profile.user.plan] ?? profile.user.plan

  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const button = trigger.current
      const popup = menu.current
      if (!button || !popup) return
      const rect = button.getBoundingClientRect()
      const menuWidth = popup.offsetWidth
      const margin = 10
      // Bottom-anchored and rendered in document.body, so the sidebar's
      // overflow:hidden cannot clip it, including in collapsed mode.
      const left = Math.min(Math.max(margin, rect.left), window.innerWidth - menuWidth - margin)
      const bottom = Math.max(margin, window.innerHeight - rect.top + 7)
      setPosition(current => current?.left === left && current?.bottom === bottom
        ? current : { left, bottom })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, mini])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function openSection(section: AccountSection) {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('tickard:open-account', { detail: section }))
  }

  async function logout() {
    if (signingOut) return
    setSigningOut(true)
    setError('')
    try {
      await api('/logout', { method: 'POST' })
      setToken(null)
      window.location.assign('/login')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar la sesión.')
      setSigningOut(false)
    }
  }

  return <div className={styles.wrapper}>
    <button ref={trigger} type="button" className={`account-footer ${styles.trigger}`}
      title={`Mi cuenta · ${plan}`} aria-label={`Mi cuenta · ${plan}`}
      aria-haspopup="menu" aria-expanded={open}
      onClick={() => setOpen(value => !value)}>
      <Avatar id={profile.user.id} name={profile.user.name} size={32}
        className="avatar" src={profile.user.avatar_url}/>
      {!mini && <span><strong>{profile.user.name}</strong><small>{plan}</small></span>}
      {!mini && <span className={`account-footer-chevron ${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 15 6-6 6 6" />
        </svg>
      </span>}
    </button>
    {open && createPortal(<div ref={menu} className={styles.menu} role="menu"
      aria-label="Opciones de mi cuenta"
      style={position ? { left: position.left, bottom: position.bottom } :
        { left: 0, bottom: 0, visibility: 'hidden' }}>
      <div className={styles.identity}>
        <Avatar id={profile.user.id} name={profile.user.name} size={44}
          className={styles.identityAvatar} src={profile.user.avatar_url}/>
        <div className={styles.identityDetails}>
          <strong title={profile.user.name}>{profile.user.name}</strong>
          <small title={profile.user.email}>{profile.user.email}</small>
          <span className={styles.plan}>{plan}</span>
        </div>
      </div>
      <div className={styles.items}>
        <button type="button" role="menuitem" onClick={() => openSection('profile')}>
          <ProfileUserIcon/>Mi perfil
        </button>
        <button type="button" role="menuitem" onClick={() => openSection('settings')}>
          <SettingsIcon/>Configuración
        </button>
        <button type="button" role="menuitem" onClick={() => openSection('notifications')}>
          <BellIcon/>Notificaciones
          {profile.unread > 0 && <span className={styles.unread}>{profile.unread}</span>}
        </button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.signOut}>
        <button type="button" role="menuitem" disabled={signingOut}
          onClick={() => void logout()}>
          <LogoutIcon/>{signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>
    </div>, document.body)}
  </div>
}
