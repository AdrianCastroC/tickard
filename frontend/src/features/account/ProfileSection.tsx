import { type FormEvent, useEffect, useRef, useState } from 'react'
import { api, type Profile } from '../../api'
import { Avatar } from '../../shared/ui'
import { FloppyIcon, PencilIcon } from '../../shared/icons'
import styles from './AccountModal.module.css'

type Props = { profile: Profile; workspaceId: number | null; onProfile: (value: Profile) => void; onAvatar: (file: File) => Promise<void> }

export function ProfileSection({ profile, workspaceId, onProfile, onAvatar }: Props) {
  const mePath = workspaceId ? `/me?workspace_id=${workspaceId}` : '/me'
  const avatarRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile.user.name)
  const [nickname, setNickname] = useState(profile.user.nickname ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setName(profile.user.name), [profile.user.name])
  useEffect(() => setNickname(profile.user.nickname ?? ''), [profile.user.nickname])

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setError(''); setInfo('')
    const nextName = name.trim()
    if (!nextName) { setError('El nombre no puede estar vacío.'); return }
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) { setError('Indica tu contraseña actual.'); return }
      if (newPassword.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return }
      if (newPassword !== confirmPassword) { setError('Las contraseñas nuevas no coinciden.'); return }
    }
    setSaving(true)
    try {
      const body: Record<string, string> = { name: nextName, nickname: nickname.trim().toLowerCase() }
      if (newPassword) { body.current_password = currentPassword; body.password = newPassword; body.password_confirmation = confirmPassword }
      const next = await api<Profile>(mePath, { method: 'PATCH', body: JSON.stringify(body) })
      onProfile(next); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setInfo(newPassword ? 'Perfil y contraseña actualizados.' : 'Perfil actualizado.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil.') }
    finally { setSaving(false) }
  }

  const hasChanges = name.trim() !== profile.user.name || nickname.trim() !== (profile.user.nickname ?? '') || Boolean(currentPassword || newPassword || confirmPassword)
  return <form className={`${styles.modalBody} ${styles.profileBody}`} onSubmit={saveProfile}>
    <div className={styles.identity}>
      <button type="button" className="account-avatar account-avatar-lg" aria-label="Cambiar foto de perfil" title="Cambiar foto de perfil" onClick={() => avatarRef.current?.click()}>
        <Avatar id={profile.user.id} name={profile.user.name} size={72} className="avatar" src={profile.user.avatar_url} />
        <span className="account-avatar-edit"><PencilIcon className="account-avatar-pencil" /></span>
      </button>
      <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void onAvatar(file) }} />
      <div><strong>{profile.user.name}</strong><p className="muted">{profile.user.email} · {profile.user.handle}</p><em className="account-plan">{profile.user.is_admin ? 'Administrador' : profile.user.client_company ? 'Cliente' : 'Miembro'}</em></div>
    </div>
    <label className="field">Nombre<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
    <label className="field">Identificador público
      <input value={profile.user.handle} readOnly onFocus={event => event.currentTarget.select()} title="Comparte este identificador para que puedan invitarte"/>
    </label>
    <label className="field">Nickname (3 a 30 caracteres)
      <input value={nickname} onChange={event => setNickname(event.target.value.toLowerCase())} placeholder="tu-nick" maxLength={30} pattern="[a-z0-9_-]{3,30}" />
    </label>
    <label className="field">Correo<input value={profile.user.email} disabled readOnly /></label>
    <p className={styles.panelKicker}>Cambiar contraseña</p>
    <label className="field">Contraseña actual<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" /></label>
    <label className="field">Nueva contraseña<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" /></label>
    <label className="field">Repetir contraseña<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></label>
    {error && <p className="error">{error}</p>}{info && <p className={styles.ok}>{info}</p>}
    <button className={`primary ${styles.save}`} type="submit" disabled={saving || !hasChanges}><FloppyIcon />{saving ? 'Guardando…' : 'Guardar cambios'}</button>
  </form>
}
