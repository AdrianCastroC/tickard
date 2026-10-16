import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, type Profile } from '../../api'
import styles from './AccountModal.module.css'

export type SecurityPurpose = 'email' | 'password'
type Step = 'confirm' | 'current_code' | 'ready' | 'new_code'
type Props = { purpose: SecurityPurpose; profile: Profile; workspaceId: number | null; onClose: () => void; onUpdated: (next: Profile) => void }
type Status = { stage: Step | null; expires_at?: string | null; new_email?: string | null }

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AccountSecurityDialog({ purpose, profile, workspaceId, onClose, onUpdated }: Props) {
  const [step, setStep] = useState<Step>('confirm')
  const [code, setCode] = useState('')
  const [nextEmail, setNextEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const root = '/me/security/' + purpose
  const suffix = workspaceId ? '?workspace_id=' + workspaceId : ''
  const title = purpose === 'email' ? 'Cambiar correo electrónico' : 'Cambiar contraseña'
  useEffect(() => {
    let active = true
    void api<Status>(root)
      .then(result => { if (active) { setStep(result.stage ?? 'confirm'); setNextEmail(result.new_email ?? '') } })
      .catch(() => { if (active) setError('No se pudo comprobar la verificación pendiente.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [root])

  useEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [onClose])

  async function post<T>(path: string, data?: Record<string, string>): Promise<T | null> {
    setBusy(true); setError(''); setMessage('')
    try {
      return await api<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación.')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function start() {
    const result = await post<Status>(root + '/start')
    if (!result) return
    setStep('current_code')
    setCode('')
    setMessage('Hemos enviado un código de un solo uso al correo actual. Caduca en 10 minutos.')
  }

  async function verifyOld() {
    if (!/^[0-9]{6}$/.test(code)) { setError('Introduce un código de seis cifras.'); return }
    const result = await post<Status>(root + '/verify', { code })
    if (!result) return
    setStep('ready')
    setCode('')
    setMessage('Correo actual verificado. Puedes continuar.')
  }

  async function requestNewEmail() {
    const email = nextEmail.trim()
    if (!emailRegex.test(email) || email.length > 254 || email.toLowerCase() === profile.user.email.toLowerCase()) {
      setError('Introduce una dirección de correo nueva y válida.'); return
    }
    if (!currentPassword) { setError('Introduce tu contraseña actual.'); return }
    const result = await post<Status>(root + '/request-new', { email, current_password: currentPassword })
    if (!result) return
    setStep('new_code'); setCode(''); setCurrentPassword('')
    setMessage('Código enviado al correo nuevo. Caduca en 10 minutos.')
  }

  async function finishEmail() {
    if (!/^[0-9]{6}$/.test(code)) { setError('Introduce el código recibido en el correo nuevo.'); return }
    const result = await post<Profile>(root + '/confirm' + suffix, { code })
    if (result) { onUpdated(result); onClose() }
  }

  const requirements = [
    { text: '10 caracteres como mínimo', ok: password.length >= 10 },
    { text: 'Mayúsculas y minúsculas', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { text: 'Al menos un número', ok: /[0-9]/.test(password) },
    { text: 'Al menos un símbolo', ok: /[^\p{L}\p{N}\s]/u.test(password) },
  ]
  const score = requirements.filter(rule => rule.ok).length + Number(password.length >= 14)
  const strength = Math.max(1, Math.min(4, Math.round(score * 4 / 5)))
  const strengthText = ['', 'Débil', 'Media', 'Buena', 'Fuerte'][password ? strength : 0]

  async function finishPassword() {
    if (!requirements.every(rule => rule.ok)) { setError('La contraseña no cumple los requisitos mínimos.'); return }
    if (password !== confirmation) { setError('Las contraseñas nuevas no coinciden.'); return }
    if (!currentPassword) { setError('Introduce tu contraseña actual.'); return }
    const result = await post<Profile>(root + '/finish' + suffix, {
      current_password: currentPassword, password, password_confirmation: confirmation,
    })
    if (result) { onUpdated(result); onClose() }
  }

  return createPortal(
    <div className={styles.securityBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className={styles.securityDialog} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.securityHead}>
          <strong>{title}</strong>
          <button type="button" title="Cerrar" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        {loading ? <div className={styles.securityContent}><p>Comprobando estado de seguridad…</p></div> :
          <div className={styles.securityContent}>
            {step === 'confirm' && <>
              <p>¿Estás seguro de que quieres {purpose === 'email' ? 'cambiar el correo asociado a tu cuenta' : 'cambiar la contraseña'}?</p>
              <p>Enviaremos un código de seguridad al correo actual <strong>{profile.user.email}</strong>. Sin este código no podrás continuar.</p>
            </>}
            {step === 'current_code' && <>
              <p>Introduce el código de seis cifras enviado a <strong>{profile.user.email}</strong>. Solo sirve para esta operación y caduca en 10 minutos.</p>
              <label className={styles.securityField}>Código de seguridad
                <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
                  placeholder="000000"/>
              </label>
            </>}
            {step === 'ready' && purpose === 'email' && <>
              <p>Se ha confirmado el acceso a tu correo actual. Introduce el nuevo correo y tu contraseña actual.</p>
              <label className={styles.securityField}>Nuevo correo electrónico
                <input type="email" autoComplete="email" value={nextEmail}
                  onChange={event => setNextEmail(event.target.value)} maxLength={254}/>
              </label>
              <label className={styles.securityField}>Contraseña actual
                <input type="password" autoComplete="current-password" value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}/>
              </label>
            </>}
            {step === 'new_code' && purpose === 'email' && <>
              <p>Confirma que tienes acceso a <strong>{nextEmail}</strong> introduciendo el segundo código recibido.</p>
              <label className={styles.securityField}>Código del nuevo correo
                <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
                  placeholder="000000"/>
              </label>
            </>}
            {step === 'ready' && purpose === 'password' && <>
              <p>Correo actual verificado. Introduce la contraseña actual y establece una nueva.</p>
              <label className={styles.securityField}>Contraseña actual
                <input type="password" autoComplete="current-password" value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}/>
              </label>
              <label className={styles.securityField}>Nueva contraseña
                <input type="password" autoComplete="new-password" value={password}
                  onChange={event => setPassword(event.target.value)} maxLength={128}/>
              </label>
              <label className={styles.securityField}>Confirmar nueva contraseña
                <input type="password" autoComplete="new-password" value={confirmation}
                  onChange={event => setConfirmation(event.target.value)} maxLength={128}/>
              </label>
              {password && <div className={styles.securityStrength}>
                <div>Fuerza orientativa: <strong>{strengthText}</strong></div>
                <div className={styles.strengthTrack} data-strength={strength} role="meter"
                  aria-label="Fuerza de la contraseña" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={4}>
                  <span className={styles.strengthFill} style={{ width: (strength * 25) + '%' }}/>
                </div>
                <div className={styles.passwordRules}>{requirements.map(rule =>
                  <span key={rule.text} className={rule.ok ? styles.ruleValid : undefined}>
                    {rule.ok ? '✓' : '○'} {rule.text}
                  </span>)}</div>
              </div>}
            </>}
            {error && <p className={styles.securityError} role="alert">{error}</p>}
            {!error && message && <p className={styles.securitySuccess} role="status">{message}</p>}
          </div>}
        <div className={styles.securityActions}>
          <button type="button" onClick={onClose} disabled={busy}>Cancelar</button>
          {!loading && <button className={styles.securityPrimary} type="button" disabled={busy}
            onClick={() => void (step === 'confirm' ? start() :
              step === 'current_code' ? verifyOld() :
              step === 'new_code' ? finishEmail() :
              purpose === 'email' ? requestNewEmail() : finishPassword())}>
            {busy ? 'Procesando…' : step === 'confirm' ? 'Enviar código' :
              step === 'current_code' ? 'Verificar código' : step === 'new_code' ? 'Confirmar nuevo correo' :
              purpose === 'email' ? 'Enviar código al nuevo correo' : 'Cambiar contraseña'}
          </button>}
        </div>
      </div>
    </div>, document.body)
}
