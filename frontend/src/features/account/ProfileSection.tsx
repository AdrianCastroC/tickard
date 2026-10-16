import { type FormEvent, useEffect, useRef, useState } from 'react'
import { api, type Profile } from '../../api'
import { Avatar } from '../../shared/ui'
import { FloppyIcon, PencilIcon } from '../../shared/icons'
import { AccountSecurityDialog, type SecurityPurpose } from './AccountSecurityDialog'
import styles from './AccountModal.module.css'

type Props = { profile: Profile; workspaceId: number | null; onProfile: (value: Profile) => void; onAvatar: (file: File) => Promise<void> }

const CopyIcon = () => <svg viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
  <path d="M480 400L288 400C279.2 400 272 392.8 272 384L272 128C272 119.2 279.2 112 288 112L421.5 112C425.7 112 429.8 113.7 432.8 116.7L491.3 175.2C494.3 178.2 496 182.3 496 186.5L496 384C496 392.8 488.8 400 480 400zM288 448L480 448C515.3 448 544 419.3 544 384L544 186.5C544 169.5 537.3 153.2 525.3 141.2L466.7 82.7C454.7 70.7 438.5 64 421.5 64L288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L368 496L368 512C368 520.8 360.8 528 352 528L160 528C151.2 528 144 520.8 144 512L144 256C144 247.2 151.2 240 160 240L176 240L176 192L160 192z"/>
</svg>

export function ProfileSection({ profile, workspaceId, onProfile, onAvatar }: Props) {
  const avatarRef = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState(profile.user.first_name)
  const [lastName, setLastName] = useState(profile.user.last_name ?? '')
  const [security, setSecurity] = useState<SecurityPurpose | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [saving, setSaving] = useState(false)
  const mePath = workspaceId ? '/me?workspace_id=' + workspaceId : '/me'

  useEffect(() => setFirstName(profile.user.first_name), [profile.user.first_name])
  useEffect(() => setLastName(profile.user.last_name ?? ''), [profile.user.last_name])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(''); setInfo('')
    if (!firstName.trim()) { setError('El nombre no puede estar vacío.'); return }
    setSaving(true)
    try {
      const next = await api<Profile>(mePath, {
        method: 'PATCH',
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() || null }),
      })
      onProfile(next)
      setInfo('Datos personales actualizados.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los datos.')
    } finally { setSaving(false) }
  }

  function copy(value: string, label: string) {
    if (!navigator.clipboard?.writeText) {
      setError('El portapapeles no está disponible en este navegador.')
      return
    }
    void navigator.clipboard.writeText(value)
      .then(() => { setError(''); setInfo(label + ' copiado.') })
      .catch(() => setError('No se pudo copiar ' + label.toLowerCase() + '.'))
  }

  const hasChanges = firstName.trim() !== profile.user.first_name ||
    lastName.trim() !== (profile.user.last_name ?? '')

  return <>
    <form className={[styles.modalBody, styles.profileBody].join(' ')} onSubmit={saveProfile}>
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
            <div className={styles.idGroup}>
              <span className={styles.idTag}>ID</span>
              <div className={styles.publicHandle}>
                <code title="ID permanente de la cuenta">{profile.user.handle}</code>
                <button type="button" className={styles.copyHandle} onClick={() => copy(profile.user.handle, 'ID')}
                  title="Copiar ID" aria-label="Copiar ID"><CopyIcon/></button>
              </div>
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
          <div className={[styles.readonlyField, styles.fieldFull].join(' ')}>
            <span>Correo electrónico</span>
            <div className={styles.emailDisplay}>
              <span title={profile.user.email}>{profile.user.email}</span>
              <button type="button" className={styles.copyHandle} onClick={() => copy(profile.user.email, 'Correo')}
                title="Copiar correo electrónico" aria-label="Copiar correo electrónico"><CopyIcon/></button>
            </div>
          </div>
        </div>

        <div className={styles.sectionIntro}><strong>Seguridad</strong></div>
        <div className={styles.securityOptions}>
          <div><span>Correo electrónico</span><small>Requiere un código del correo actual y otro del nuevo.</small></div>
          <button type="button" className={styles.secondaryAction} onClick={() => setSecurity('email')}>Cambiar correo</button>
          <div><span>Contraseña</span><small>Requiere verificar tu correo actual antes de cambiarla.</small></div>
          <button type="button" className={styles.secondaryAction} onClick={() => setSecurity('password')}>Cambiar contraseña</button>
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
    {security && <AccountSecurityDialog purpose={security} profile={profile} workspaceId={workspaceId}
      onClose={() => setSecurity(null)}
      onUpdated={next => { onProfile(next); setInfo(security === 'email' ? 'Correo actualizado.' : 'Contraseña actualizada.') }}/>}
  </>
}
