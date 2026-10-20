import { useEffect, useState, type FormEvent } from 'react'
import { api, getToken, setToken, type Profile } from '../api'

type Preview = { workspace?: string; project?: string; client?: string | null; email?: string | null; type?: 'email'|'link' }
type Props = { token: string; kind?: 'workspace'|'project' }
type Mode = 'login'|'register'
export function Invite({ token, kind = 'project' }: Props) {
  const [info, setInfo] = useState<Preview | null>(null)
  const [mode, setMode] = useState<Mode>('login')
  const [authed, setAuthed] = useState(Boolean(getToken()))
  const [account, setAccount] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [verification, setVerification] = useState<{email: string; nonce: string} | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const path = kind === 'workspace' ? `/workspace-invitations/${token}` : `/invitations/${token}`

  useEffect(() => {
    const abort = new AbortController()
    setInfo(null)
    setError('')
    void api<Preview>(path, { signal: abort.signal }).then(response => {
      if (!abort.signal.aborted) {
        setInfo(response)
        setEmail(response.email ?? '')
      }
    }).catch(cause => {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Esta invitación ya no está disponible.')
    })
    if (getToken()) {
      void api<Profile>('/me', { signal: abort.signal }).then(profile => {
        if (!abort.signal.aborted) setAccount(profile.user.email)
      }).catch(() => {
        if (!abort.signal.aborted) {
          setAuthed(false)
          setToken(null)
        }
      })
    }
    return () => abort.abort()
  }, [path])

  async function accept() {
    const result = await api<{ workspace_id?: number }>(`${path}/accept`, { method:'POST' })
    if (result.workspace_id) localStorage.setItem('tickard:active-workspace', String(result.workspace_id))
    window.location.href = '/'
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!info || busy) return
    setBusy(true)
    setError('')
    try {
      if (verification) {
        const result = await api<{ token: string; user: Profile }>('/registration/verify', {
          method: 'POST', body: JSON.stringify({ ...verification, code: verificationCode }),
        })
        setToken(result.token)
        setAuthed(true)
        setAccount(result.user.user.email)
        setVerification(null)
        await accept()
        return
      }
      if (!authed) {
        if (mode === 'register' && password !== confirmation) {
          setError('Las contraseñas no coinciden.')
          return
        }
        if (mode === 'register') {
          const pending = await api<{email: string; nonce: string}>('/register', {
            method: 'POST',
            body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() || null, email, password, password_confirmation: confirmation }),
          })
          setVerification({ email: pending.email, nonce: pending.nonce })
          setVerificationCode('')
          return
        }
        const result = await api<{ token: string; user: Profile }>('/login', {
          method: 'POST', body: JSON.stringify({ email, password }),
        })
        setToken(result.token)
        setAuthed(true)
        setAccount(result.user.user.email)
      }
      await accept()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aceptar la invitación.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-screen">
    <header className="auth-header"><img src="/logo-removebg.png" alt="Tickard"/></header>
    <section style={{ display:'flex', justifyContent:'center', padding:'30px 16px' }}>
      <form className="auth-card" onSubmit={submit} style={{ width:'min(100%,480px)', maxWidth:480 }} aria-busy={busy}>
        <div className="auth-heading">
          <h2>Invitación a Tickard</h2>
          <p>{info?.workspace
            ? `Te han invitado a unirte al Workspace «${info.workspace}».`
            : info?.project ? `Te han invitado al proyecto «${info.project}».`
            : 'Comprobando invitación…'}</p>
        </div>
        {info && <>
          {verification ? <>
            <p>Comprueba el correo <strong>{verification.email}</strong> y escribe el código de seis cifras.</p>
            <label className="auth-field"><span>Código</span>
              <input value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required />
            </label>
            <button className="auth-submit" type="submit" disabled={busy || verificationCode.length !== 6}>Verificar correo y aceptar invitación</button>
            <button className="ghost" type="button" onClick={() => setVerification(null)}>Volver</button>
          </> : <>
          {info.email && <p style={{ fontSize:12, color:'var(--muted)' }}>Invitación para: <strong>{info.email}</strong></p>}
          {authed ? <>
            <p>Sesión iniciada {account && <>como <strong>{account}</strong></>}</p>
            {info.email && account && info.email.toLowerCase() !== account.toLowerCase() &&
              <p className="error">Este enlace está dirigido a otra dirección de correo. Cambia de cuenta para aceptarlo.</p>}
            {mode === 'register' && <p style={{fontSize:12, color:'var(--muted)'}}>La contraseña debe incluir mayúsculas, minúsculas, números y símbolos.</p>}
            <button className="auth-submit" type="submit" disabled={busy}>Aceptar invitación →</button>
            <button className="ghost" type="button" onClick={() => { setToken(null); setAuthed(false); setAccount(''); setError('') }}>Usar otra cuenta</button>
          </> : <>
            <div className="auth-tabs" role="tablist" aria-label="Acceso">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Iniciar sesión</button>
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>Crear cuenta</button>
            </div>
            {mode === 'register' && <>
              <label className="auth-field"><span>Nombre</span><input value={firstName} onChange={event => setFirstName(event.target.value)} required placeholder="Tu nombre" autoComplete="given-name" maxLength={120}/></label>
              <label className="auth-field"><span>Apellidos (opcional)</span><input value={lastName} onChange={event => setLastName(event.target.value)} placeholder="Tus apellidos" autoComplete="family-name" maxLength={120}/></label>
            </>}
            <label className="auth-field"><span>Correo</span><input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="Correo electrónico"/></label>
            <label className="auth-field"><span>Contraseña</span><input type="password" required minLength={10} value={password} onChange={event => setPassword(event.target.value)} placeholder="Contraseña"/></label>
            {mode === 'register' && <label className="auth-field"><span>Repetir contraseña</span><input type="password" required minLength={10} value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Repetir contraseña"/></label>}
            {mode === 'register' && <p style={{fontSize:12, color:'var(--muted)'}}>La contraseña debe incluir mayúsculas, minúsculas, números y símbolos.</p>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Procesando…' : 'Acceder y aceptar invitación →'}</button>
          </>}
          </>}
        </>}
        {error && <p className="error" role="alert">{error}</p>}
        <p style={{ fontSize:11, color:'var(--muted)' }}>La invitación nunca cambia la contraseña ni los datos de una cuenta existente.</p>
      </form>
    </section>
  </main>
}
