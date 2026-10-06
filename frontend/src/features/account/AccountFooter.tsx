import type { Profile } from '../../api'
import { Avatar } from '../../shared/ui'

export function AccountFooter({ profile, mini }: { profile: Profile; mini: boolean }) {
  function openAccount() { window.dispatchEvent(new CustomEvent('tickard:open-account')) }
  return <button type="button" className="account-footer" title="Mi cuenta" aria-label="Mi cuenta" onClick={openAccount}><Avatar id={profile.user.id} name={profile.user.name} size={32} className="avatar" src={profile.user.avatar_url} />{!mini && <span><strong>{profile.user.name}</strong><small>Mi cuenta</small></span>}<span className="account-footer-chevron">›</span></button>
}
