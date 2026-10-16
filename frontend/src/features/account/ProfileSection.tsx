import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type Profile } from '../../api'
import { Avatar } from '../../shared/ui'
import { PencilIcon } from '../../shared/icons'
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
  const [birthMonth, setBirthMonth] = useState(profile.user.birthday_month_day?.slice(0, 2) ?? '')
  const [birthDay, setBirthDay] = useState(profile.user.birthday_month_day?.slice(3, 5) ?? '')
  const [shareBirthday, setShareBirthday] = useState(Boolean(profile.user.share_birthday))
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [saving, setSaving] = useState(false)
  const mePath = workspaceId ? '/me?workspace_id=' + workspaceId : '/me'
  const committed = useRef({ first: profile.user.first_name, last: profile.user.last_name ?? '' })
  const draft = useRef({ first: profile.user.first_name, last: profile.user.last_name ?? '' })
  const busy = useRef(false)
  const live = useRef(true)
  const queued = useRef(false)
  const onProfileRef = useRef(onProfile)
  const birthdaySaved = useRef({ date: profile.user.birthday_month_day, share: Boolean(profile.user.share_birthday) })
  const birthdayDraft = useRef({ date: profile.user.birthday_month_day, share: Boolean(profile.user.share_birthday) })
  const birthdayBusy = useRef(false)
  const birthdayQueued = useRef(false)
  const [birthdaySaving, setBirthdaySaving] = useState(false)
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const daysInMonth = birthMonth ? new Date(2000, Number(birthMonth), 0).getDate() : 31
  onProfileRef.current = onProfile

  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])

  const persist = useCallback(async () => {
    const first = draft.current.first.trim()
    const last = draft.current.last.trim()
    if (!first) {
      if (live.current) { setError('El nombre no puede estar vacío.'); setInfo('') }
      return
    }
    if (busy.current) { queued.current = true; return }
    if (first === committed.current.first && last === committed.current.last) return

    busy.current = true
    if (live.current) { setSaving(true); setError(''); setInfo('') }
    try {
      const next = await api<Profile>(mePath, {
        method: 'PATCH',
        body: JSON.stringify({ first_name: first, last_name: last || null }),
      })
      committed.current = { first: next.user.first_name, last: next.user.last_name ?? '' }
      onProfileRef.current(next)
      if (live.current) setInfo('Cambios guardados automáticamente.')
    } catch (cause) {
      if (live.current) {
        setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los cambios.')
      }
    } finally {
      busy.current = false
      if (live.current) setSaving(false)
      const needsAnother = draft.current.first.trim() !== committed.current.first ||
        draft.current.last.trim() !== committed.current.last
      if (queued.current && needsAnother && live.current) {
        queued.current = false
        void persist()
      } else {
        queued.current = false
      }
    }
  }, [mePath])

  useEffect(() => {
    if (firstName.trim() === committed.current.first &&
        lastName.trim() === committed.current.last) return
    if (!firstName.trim()) return
    const pending = window.setTimeout(() => { void persist() }, 800)
    return () => window.clearTimeout(pending)
  }, [firstName, lastName, persist])

  const persistBirthday = useCallback(async () => {
    const next = birthdayDraft.current
    if (next.date === birthdaySaved.current.date && next.share === birthdaySaved.current.share) return
    if (birthdayBusy.current) { birthdayQueued.current = true; return }
    birthdayBusy.current = true
    if (live.current) { setBirthdaySaving(true); setError(''); setInfo('') }
    try {
      const updated = await api<Profile>(mePath, {
        method: 'PATCH',
        body: JSON.stringify({
          birthday_month_day: next.date,
          share_birthday: next.date !== null && next.share,
        }),
      })
      birthdaySaved.current = {
        date: updated.user.birthday_month_day,
        share: Boolean(updated.user.share_birthday),
      }
      onProfileRef.current(updated)
      if (live.current) setInfo('Preferencias de cumpleaños guardadas.')
    } catch (cause) {
      if (live.current) {
        setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cumpleaños.')
      }
    } finally {
      birthdayBusy.current = false
      if (live.current) setBirthdaySaving(false)
      if (birthdayQueued.current && live.current) {
        birthdayQueued.current = false
        void persistBirthday()
      }
    }
  }, [mePath])

  useEffect(() => {
    // An incomplete selection must not overwrite a previously saved birthday.
    if (Boolean(birthMonth) !== Boolean(birthDay)) return
    if (birthMonth && Number(birthDay) > daysInMonth) return
    const date = birthMonth && birthDay ? birthMonth + '-' + birthDay : null
    birthdayDraft.current = { date, share: date !== null && shareBirthday }
    if (birthdayDraft.current.date === birthdaySaved.current.date &&
        birthdayDraft.current.share === birthdaySaved.current.share) return
    const pending = window.setTimeout(() => void persistBirthday(), 650)
    return () => window.clearTimeout(pending)
  }, [birthMonth, birthDay, shareBirthday, daysInMonth, persistBirthday])

  function changeBirthMonth(value: string) {
    setBirthMonth(value)
    if (!value) { setBirthDay(''); setShareBirthday(false) }
    else if (birthDay && Number(birthDay) > new Date(2000, Number(value), 0).getDate()) {
      setBirthDay('')
      setShareBirthday(false)
    }
  }

  function updateFirst(value: string) {
    draft.current.first = value
    setFirstName(value); setError(''); setInfo('')
  }
  function updateLast(value: string) {
    draft.current.last = value
    setLastName(value); setError(''); setInfo('')
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

  return <>
    <div className={[styles.modalBody, styles.profileBody].join(' ')}>
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
            <input value={firstName} onChange={event => updateFirst(event.target.value)} onBlur={() => void persist()}
              autoComplete="given-name" required maxLength={120}/>
          </label>
          <label className={styles.field}>Apellidos (opcional)
            <input value={lastName} onChange={event => updateLast(event.target.value)} onBlur={() => void persist()}
              autoComplete="family-name" maxLength={120}/>
          </label>
          <div className={[styles.birthdaySettings, styles.fieldFull].join(' ')}>
            <span className={styles.birthdayLabel}>Cumpleaños (opcional)</span>
            <div className={styles.birthdayInputs}>
              <label>Mes
                <select aria-label="Mes del cumpleaños" value={birthMonth}
                  onChange={event => changeBirthMonth(event.target.value)}>
                  <option value="">Sin indicar</option>
                  {months.map((month, i) => <option key={month}
                    value={String(i + 1).padStart(2, '0')}>{month}</option>)}
                </select>
              </label>
              <label>Día
                <select aria-label="Día del cumpleaños" value={birthDay}
                  disabled={!birthMonth} onChange={event => setBirthDay(event.target.value)}>
                  <option value="">Elegir día</option>
                  {Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'))
                    .map(day => <option key={day} value={day}>{Number(day)}</option>)}
                </select>
              </label>
            </div>
            <label className={styles.birthdayShare}>
              <span><strong>Compartir mi cumpleaños</strong>
                <small>Será visible en todos mis Workspaces que tengan habilitados los cumpleaños. No se muestra el año.</small>
              </span>
              <input type="checkbox" checked={shareBirthday} disabled={!birthMonth || !birthDay}
                onChange={event => setShareBirthday(event.target.checked)}/>
            </label>
          </div>
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
        {(saving || birthdaySaving || error || info) && <div className={styles.autoSaveStatus} role={error ? 'alert' : 'status'}>
          {error ? <span className={styles.feedbackError}>{error}</span> :
            <span className={styles.ok}>{saving || birthdaySaving ? 'Guardando cambios…' : info}</span>}
          {error && <button type="button" onClick={() => void persist()}>Reintentar</button>}
        </div>}
      </div>
    {security && <AccountSecurityDialog purpose={security} profile={profile} workspaceId={workspaceId}
      onClose={() => setSecurity(null)}
      onUpdated={next => { onProfile(next); setInfo(security === 'email' ? 'Correo actualizado.' : 'Contraseña actualizada.') }}/>}
  </>
}
