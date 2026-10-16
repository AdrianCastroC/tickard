import { type FormEvent, useEffect, useRef, useState } from 'react'
import { api, type Profile } from '../../api'
import { Avatar } from '../../shared/ui'
import { FloppyIcon, PencilIcon } from '../../shared/icons'
import styles from './AccountModal.module.css'

type Props = { profile: Profile; workspaceId: number | null; onProfile: (value: Profile) => void; onAvatar: (file: File) => Promise<void> }
type PendingEmail = { pending_email: string | null; expires_at: string | null }
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ProfileSection({ profile, workspaceId, onProfile, onAvatar }: Props) {
  const mePath = workspaceId ? '/me?workspace_id=' + workspaceId : '/me'
  const verifyPath = workspaceId ? '/me/email-change/confirm?workspace_id=' + workspaceId : '/me/email-change/confirm'
  const avatarRef = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState(profile.user.first_name)
  const [lastName, setLastName] = useState(profile.user.last_name ?? '')
  const [email, setEmail] = useState(profile.user.email)
  const [emailPassword, setEmailPassword] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailInfo, setEmailInfo] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setFirstName(profile.user.first_name), [profile.user.first_name])
  useEffect(() => setLastName(profile.user.last_name ?? ''), [profile.user.last_name])
  useEffect(() => setEmail(profile.user.email), [profile.user.email])
  useEffect(() => {
    let active = true
    void api<PendingEmail>('/me/email-change')
      .then(result => { if (active) setPendingEmail(result.pending_email) })
      .catch(() => { if (active) setEmailError('No se pudo consultar el cambio de correo pendiente.') })
    return () => { active = false }
  }, [profile.user.id])

  const emailChanged = email.trim().toLowerCase() !== profile.user.email.toLowerCase()
  const passwordRules = [
    { label: 'Al menos 10 caracteres', valid: newPassword.length >= 10 },
    { label: 'Mayúsculas y minúsculas', valid: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) },
    { label: 'Un número', valid: /[0-9]/.test(newPassword) },
    { label: 'Un símbolo', valid: /[^\p{L}\p{N}\s]/u.test(newPassword) },
  ]
  const meetsPasswordRules = passwordRules.every(rule => rule.valid)
  const strengthPoints = passwordRules.filter(rule => rule.valid).length + Number(newPassword.length >= 14)
  const strength = newPassword ? Math.max(1, Math.min(4, Math.round(strengthPoints * 4 / 5))) : 0
  const strengthNames = ['', 'Débil', 'Media', 'Buena', 'Fuerte']

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(''); setInfo('')
    const nextFirstName = firstName.trim()
    if (!nextFirstName) { setError('El nombre no puede estar vacío.'); return }
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) { setError('Indica tu contraseña actual.'); return }
      if (!newPassword || !meetsPasswordRules) { setError('La contraseña nueva debe cumplir todos los requisitos de seguridad.'); return }
      if (newPassword !== confirmPassword) { setError('Las contraseñas nuevas no coinciden.'); return }
    }
    setSaving(true)
    try {
      const body: Record<string, string | null> = { first_name: nextFirstName, last_name: lastName.trim() || null }
      if (newPassword) { body.current_password = currentPassword; body.password = newPassword; body.password_confirmation = confirmPassword }
      const next = await api<Profile>(mePath, { method: 'PATCH', body: JSON.stringify(body) })
      onProfile(next)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setInfo(newPassword ? 'Perfil y contraseña actualizados.' : 'Perfil actualizado.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el perfil.')
    } finally { setSaving(false) }
  }

  async function requestEmailChange() {
    setEmailError(''); setEmailInfo('')
    const target = email.trim()
    if (!emailChanged || !validEmail.test(target) || target.length > 254) {
      setEmailError('Introduce una dirección de correo electrónico nueva y válida.')
      return
    }
    if (!emailPassword) { setEmailError('Introduce tu contraseña actual para cambiar el correo.'); return }
    setEmailBusy(true)
    try {
      const result = await api<PendingEmail>('/me/email-change', {
        method: 'POST', body: JSON.stringify({ email: target, current_password: emailPassword }),
      })
      setPendingEmail(result.pending_email)
      setEmailPassword('')
      setEmailCode('')
      setEmailInfo('Código enviado a la nueva dirección. Caduca en 15 minutos.')
    } catch (cause) {
      setEmailError(cause instanceof Error ? cause.message : 'No se pudo solicitar el cambio.')
    } finally { setEmailBusy(false) }
  }

  async function confirmEmailChange() {
    setEmailError(''); setEmailInfo('')
    if (!/^[0-9]{6}$/.test(emailCode.trim())) {
      setEmailError('Introduce el código de seis cifras que recibiste por correo.')
      return
    }
    setEmailBusy(true)
    try {
      const next = await api<Profile>(verifyPath, {
        method: 'POST', body: JSON.stringify({ code: emailCode.trim() }),
      })
      onProfile(next)
      setEmail(next.user.email)
      setEmailPassword('')
      setEmailCode('')
      setPendingEmail(null)
      setEmailInfo('Correo electrónico verificado y actualizado.')
    } catch (cause) {
      setEmailError(cause instanceof Error ? cause.message : 'No se pudo verificar el código.')
    } finally { setEmailBusy(false) }
  }

  function copyId() {
    if (!navigator.clipboard?.writeText) {
      setError('La copia al portapapeles no está disponible en este navegador.')
      return
    }
    void navigator.clipboard.writeText(profile.user.handle)
      .then(() => { setError(''); setInfo('ID copiado.') })
      .catch(() => setError('No se pudo copiar el ID.'))
  }

  const hasChanges = firstName.trim() !== profile.user.first_name ||
    lastName.trim() !== (profile.user.last_name ?? '') || Boolean(currentPassword || newPassword || confirmPassword)

  return <form className={[styles.modalBody, styles.profileBody].join(' ')} onSubmit={saveProfile}>
    <div className={styles.profileScroll}>
      <div className={styles.identity}>
        <button type="button" className="account-avatar account-avatar-lg" aria-label="Cambiar foto de perfil"
          title="Cambiar foto de perfil" onClick={() => avatarRef.current?.click()}>
          <Avatar id={profile.user.id} name={profile.user.name} size={58}
            className="avatar" src={profile.user.avatar_url}/>
          <span className="account-avatar-edit"><PencilIcon className="account-avatar-pencil"/></span>
        </button>
        <input ref={avatarRef} type="file" accept="image/*" hidden onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onAvatar(file)
        }}/>
        <div className={styles.identityText}>
          <strong title={profile.user.name}>{profile.user.name}</strong>
          <em className="account-plan">{({ free: 'Free', base: 'Base', pro: 'Pro', business: 'Business' } as Record<string, string>)[profile.user.plan] ?? profile.user.plan}</em>
        </div>
        <div className={styles.identityId}>
          <div className={styles.publicHandle}>
            <span className={styles.handleLabel}>ID</span>
            <span className={styles.handleSeparator} aria-hidden="true">|</span>
            <code title="ID permanente de la cuenta">{profile.user.handle}</code>
            <button type="button" className={styles.copyHandle} onClick={copyId}
              aria-label="Copiar ID" title="Copiar ID">
              <svg viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
                <path d="M480 400L288 400C279.2 400 272 392.8 272 384L272 128C272 119.2 279.2 112 288 112L421.5 112C425.7 112 429.8 113.7 432.8 116.7L491.3 175.2C494.3 178.2 496 182.3 496 186.5L496 384C496 392.8 488.8 400 480 400zM288 448L480 448C515.3 448 544 419.3 544 384L544 186.5C544 169.5 537.3 153.2 525.3 141.2L466.7 82.7C454.7 70.7 438.5 64 421.5 64L288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L368 496L368 512C368 520.8 360.8 528 352 528L160 528C151.2 528 144 520.8 144 512L144 256C144 247.2 151.2 240 160 240L176 240L176 192L160 192z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.sectionIntro}><strong>Datos personales</strong></div>
      <div className={styles.fieldsGrid}>
        <label className={styles.field}>Nombre
          <input value={firstName} onChange={event => setFirstName(event.target.value)}
            autoComplete="given-name" required maxLength={120}/>
        </label>
        <label className={styles.field}>Apellidos (opcional)
          <input value={lastName} onChange={event => setLastName(event.target.value)}
            autoComplete="family-name" maxLength={120}/>
        </label>
        <div className={[styles.field, styles.fieldFull].join(' ')}>
          <label htmlFor="profile-email">Correo electrónico</label>
          <input id="profile-email" type="email" autoComplete="email" maxLength={254}
            value={email} onChange={event => { setEmail(event.target.value); setEmailError(''); setEmailInfo('') }}/>
          {emailChanged && <div className={styles.emailChange}>
            <label className={styles.field}>Contraseña actual para cambiar el correo
              <input type="password" autoComplete="current-password" value={emailPassword}
                onChange={event => setEmailPassword(event.target.value)}/>
            </label>
            <button type="button" className={styles.secondaryAction} disabled={emailBusy}
              onClick={() => void requestEmailChange()}>{emailBusy ? 'Enviando…' : 'Enviar código de verificación'}</button>
          </div>}
          {pendingEmail && <div className={styles.emailPending}>
            <small>Código de verificación enviado a <strong>{pendingEmail}</strong> (15 minutos de validez).</small>
            <div className={styles.emailCodeRow}>
              <input aria-label="Código de verificación" inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6}" maxLength={6} placeholder="Código de 6 cifras" value={emailCode}
                onChange={event => setEmailCode(event.target.value.replace(/\D/g, ''))}/>
              <button type="button" className={styles.secondaryAction} disabled={emailBusy || emailCode.length !== 6}
                onClick={() => void confirmEmailChange()}>Confirmar correo</button>
            </div>
          </div>}
          {emailError && <small className={styles.fieldError} role="alert">{emailError}</small>}
          {!emailError && emailInfo && <small className={styles.fieldSuccess} role="status">{emailInfo}</small>}
        </div>
      </div>

      <div className={styles.sectionIntro}>
        <strong>Seguridad</strong>
        <small>Para cambiar la contraseña, escribe la actual y confirma la nueva.</small>
      </div>
      <div className={styles.fieldsGrid}>
        <label className={[styles.field, styles.fieldFull].join(' ')}>Contraseña actual
          <input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)}
            autoComplete="current-password"/>
        </label>
        <label className={styles.field}>Nueva contraseña
          <input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)}
            autoComplete="new-password" minLength={10} maxLength={128}/>
        </label>
        <label className={styles.field}>Confirmar contraseña
          <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}
            autoComplete="new-password" minLength={10} maxLength={128}/>
        </label>
        {newPassword && <div className={[styles.passwordStrength, styles.fieldFull].join(' ')}>
          <div className={styles.strengthLabel}>Fuerza orientativa: <strong>{strengthNames[strength]}</strong></div>
          <div className={styles.strengthTrack} data-strength={strength} role="meter" aria-label="Fuerza de la contraseña"
            aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength}>
            <span className={styles.strengthFill} style={{ width: (strength * 25) + '%' }}/>
          </div>
          <div className={styles.passwordRules}>
            {passwordRules.map(rule => <span key={rule.label} className={rule.valid ? styles.ruleValid : undefined}>
              {rule.valid ? '✓' : '○'} {rule.label}
            </span>)}
          </div>
        </div>}
      </div>
    </div>
    <div className={styles.formFooter}>
      {error && <p className={[styles.feedback, styles.feedbackError].join(' ')} role="alert">{error}</p>}
      {!error && info && <p className={[styles.feedback, styles.ok].join(' ')} role="status">{info}</p>}
      <button className={['primary', styles.save].join(' ')} type="submit" disabled={saving || !hasChanges}>
        <FloppyIcon/>{saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  </form>
}
