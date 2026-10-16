import { type FormEvent, useEffect, useRef, useState } from 'react'
import { api, type Profile } from '../../api'
import { Avatar } from '../../shared/ui'
import { FloppyIcon, PencilIcon } from '../../shared/icons'
import styles from './AccountModal.module.css'

type Props = { profile: Profile; workspaceId: number | null; onProfile: (value: Profile) => void; onAvatar: (file: File) => Promise<void> }

export function ProfileSection({ profile, workspaceId, onProfile, onAvatar }: Props) {
  const mePath = workspaceId ? `/me?workspace_id=${workspaceId}` : '/me'
  const avatarRef = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState(profile.user.first_name)
  const [lastName, setLastName] = useState(profile.user.last_name ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setFirstName(profile.user.first_name), [profile.user.first_name])
  useEffect(() => setLastName(profile.user.last_name ?? ''), [profile.user.last_name])

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setError(''); setInfo('')
    const nextFirstName = firstName.trim()
    if (!nextFirstName) { setError('El nombre no puede estar vacío.'); return }
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) { setError('Indica tu contraseña actual.'); return }
      if (newPassword.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return }
      if (newPassword !== confirmPassword) { setError('Las contraseñas nuevas no coinciden.'); return }
    }
    setSaving(true)
    try {
      const body: Record<string, string | null> = { first_name: nextFirstName, last_name: lastName.trim() || null }
      if (newPassword) { body.current_password = currentPassword; body.password = newPassword; body.password_confirmation = confirmPassword }
      const next = await api<Profile>(mePath, { method: 'PATCH', body: JSON.stringify(body) })
      onProfile(next); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setInfo(newPassword ? 'Perfil y contraseña actualizados.' : 'Perfil actualizado.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil.') }
    finally { setSaving(false) }
  }

  const hasChanges = firstName.trim() !== profile.user.first_name || lastName.trim() !== (profile.user.last_name ?? '') || Boolean(currentPassword || newPassword || confirmPassword)
  return <form className={`${styles.modalBody} ${styles.profileBody}`} onSubmit={saveProfile}>
    <div className={styles.profileScroll}>
      <div className={styles.identity}>
        <button type="button" className="account-avatar account-avatar-lg" aria-label="Cambiar foto de perfil"
          title="Cambiar foto de perfil" onClick={() => avatarRef.current?.click()}>
          <Avatar id={profile.user.id} name={profile.user.name} size={58}
            className="avatar" src={profile.user.avatar_url} />
          <span className="account-avatar-edit"><PencilIcon className="account-avatar-pencil" /></span>
        </button>
        <input ref={avatarRef} type="file" accept="image/*" hidden onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onAvatar(file)
        }}/>
        <div className={styles.identityText}>
          <strong title={profile.user.name}>{profile.user.name}</strong>
          <small title={profile.user.email}>{profile.user.email}</small>
          <em className="account-plan">{profile.user.is_admin ? 'Administrador'
            : profile.user.client_company ? 'Cliente' : 'Miembro'}</em>
        </div>
      </div>

      <div className={styles.sectionIntro}>
        <strong>Datos personales</strong>
        <small>El nickname se genera al registrar tu cuenta y es permanente, aunque cambies tu nombre. El identificador sirve para recibir invitaciones.</small>
      </div>
      <div className={styles.fieldsGrid}>
        <label className={styles.field}>Nombre
          <input value={firstName} onChange={event => setFirstName(event.target.value)}
            autoComplete="given-name" required maxLength={120}/>
        </label>
        <label className={styles.field}>Apellidos (opcional)
          <input value={lastName} onChange={event => setLastName(event.target.value)}
            autoComplete="family-name" maxLength={120}/>
        </label>
        <div className={styles.readonlyField}>
          <span>Nickname</span>
          <strong className={styles.readonlyValue}>{profile.user.nickname ?? 'usuario'}</strong>
        </div>
        <div className={styles.readonlyField}>
          <span>Identificador público</span>
          <div className={styles.publicHandle}>
            <code title="Identificador único y permanente">{profile.user.handle}</code>
            <button type="button" className={styles.copyHandle} onClick={() => {
              if (!navigator.clipboard?.writeText) {
                setError('La copia al portapapeles no está disponible en este navegador.')
                return
              }
              void navigator.clipboard.writeText(profile.user.handle)
                .then(() => { setError(''); setInfo('Identificador copiado.') })
                .catch(() => setError('No se pudo copiar el identificador.'))
            }}>Copiar</button>
          </div>
        </div>
        <div className={`${styles.readonlyField} ${styles.fieldFull}`}>
          <span>Correo electrónico</span>
          <strong className={styles.readonlyValue}>{profile.user.email}</strong>
        </div>
      </div>

      <div className={styles.sectionIntro}>
        <strong>Seguridad</strong>
        <small>Para cambiar tu contraseña, introduce la actual y la nueva dos veces.</small>
      </div>
      <div className={styles.fieldsGrid}>
        <label className={`${styles.field} ${styles.fieldFull}`}>Contraseña actual
          <input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)}
            autoComplete="current-password"/>
        </label>
        <label className={styles.field}>Nueva contraseña
          <input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)}
            autoComplete="new-password" minLength={8}/>
        </label>
        <label className={styles.field}>Confirmar contraseña
          <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}
            autoComplete="new-password" minLength={8}/>
        </label>
      </div>
    </div>
    <div className={styles.formFooter}>
      {error && <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{error}</p>}
      {!error && info && <p className={`${styles.feedback} ${styles.ok}`} role="status">{info}</p>}
      <button className={`primary ${styles.save}`} type="submit" disabled={saving || !hasChanges}>
        <FloppyIcon />{saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  </form>
}
