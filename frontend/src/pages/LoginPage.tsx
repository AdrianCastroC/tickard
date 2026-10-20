import { type FormEvent, type ReactNode, useState } from 'react'
import { api, setToken, type Profile } from '../api'
import { LoginBoardsIcon, LoginEyeIcon, LoginProjectsIcon, LoginTasksIcon, LoginTeamsIcon } from '../shared/icons'

type AuthMode = 'login' | 'register'

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="auth-feature"><div className="auth-feature-icon" aria-hidden="true">{icon}</div><strong>{title}</strong><span>{text}</span></div>
}

function FeatureIcon({ type }: { type: 'tasks' | 'boards' | 'teams' | 'projects' }) {
  if (type === 'tasks') return <LoginTasksIcon />
  if (type === 'boards') return <LoginBoardsIcon />
  if (type === 'teams') return <LoginTeamsIcon />
  return <LoginProjectsIcon />
}

export function Login() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('ana@gestor.test')
  const [password, setPassword] = useState('password')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [verification, setVerification] = useState<{email: string; nonce: string} | null>(null)
  const [code, setCode] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (mode === 'register' && password !== confirmation) {
      if (password !== confirmation) setError('Las contraseñas no coinciden.')
      return
    }
    setIsSubmitting(true)
    try {
      if (mode === 'register') {
        const pending = await api<{verification_required: boolean; email: string; nonce: string}>('/register', {
          method: 'POST',
          body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() || null, email, password, password_confirmation: confirmation }),
        })
        setVerification({ email: pending.email, nonce: pending.nonce })
        setCode('')
      } else {
        const result = await api<{ token: string; user: Profile }>('/login', {
          method: 'POST', body: JSON.stringify({ email, password }),
        })
        setToken(result.token)
        window.location.href = '/'
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo entrar.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function confirmEmail(event: FormEvent) {
    event.preventDefault()
    if (!verification || isSubmitting) return
    setError('')
    setIsSubmitting(true)
    try {
      const result = await api<{ token: string; user: Profile }>('/registration/verify', {
        method: 'POST',
        body: JSON.stringify({ ...verification, code }),
      })
      setToken(result.token)
      window.location.href = '/'
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo verificar el correo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (verification) return <main className="auth-screen">
    <header className="auth-header"><img src="/logo-removebg.png" alt="Tickard" /></header>
    <section className="auth-layout" style={{display: 'flex', justifyContent: 'center'}}>
      <form className="auth-card" onSubmit={confirmEmail} aria-busy={isSubmitting}>
        <div className="auth-heading"><h2>Verifica tu correo</h2>
          <p>Hemos enviado un código de 6 cifras a <strong>{verification.email}</strong>. Caduca en 15 minutos.</p>
        </div>
        <label className="auth-field"><span>Código de verificación</span>
          <input value={code} onChange={event => setCode(event.target.value.replace(/\\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" maxLength={6} required pattern="[0-9]{6}" placeholder="000000" />
        </label>
        {error && <p className="error auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={isSubmitting || code.length !== 6}>
          {isSubmitting ? 'Verificando…' : 'Verificar y entrar'}
        </button>
        <button className="ghost" type="button" onClick={() => { setVerification(null); setCode(''); setError('') }}>
          Volver al registro
        </button>
      </form>
    </section>
  </main>

  return <main className="auth-screen">
    <header className="auth-header"><img src="/logo-removebg.png" alt="tickard" /><span className="auth-language">◎ &nbsp; Español &nbsp;⌄</span></header>
    <section className="auth-layout">
      <div className="auth-hero">
        <img className="auth-hero-mark" src="/logo-removebg.png" alt="" />
        <h1>Organiza. Marca. Completa.</h1><p>Tus tareas, proyectos y equipos,<br />en un solo lugar.</p>
        <div className="auth-features"><Feature icon={<FeatureIcon type="tasks" />} title="Tareas" text="Organiza tu día" /><Feature icon={<FeatureIcon type="boards" />} title="Tableros" text="Visualiza el progreso" /><Feature icon={<FeatureIcon type="teams" />} title="Equipos" text="Colabora sin límites" /><Feature icon={<FeatureIcon type="projects" />} title="Proyectos" text="Convierte planes en resultados" /></div>
      </div>
      <form className="auth-card" onSubmit={submit} aria-busy={isSubmitting}>
        <div className="auth-tabs" role="tablist" aria-label="Acceso"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Iniciar sesión</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>Crear cuenta</button></div>
        <div className="auth-heading"><h2>{mode === 'login' ? 'Bienvenido' : 'Crea tu cuenta'}</h2><p>{mode === 'login' ? 'Accede a tu cuenta de Tickard' : 'Empieza a organizarte con Tickard'}</p></div>
        {mode === 'register' && <>
          <label className="auth-field"><span>Nombre</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} type="text" autoComplete="given-name" placeholder="Tu nombre" required maxLength={120} /></label>
          <label className="auth-field"><span>Apellidos (opcional)</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} type="text" autoComplete="family-name" placeholder="Tus apellidos" maxLength={120} /></label>
        </>}
        <label className="auth-field"><span aria-hidden="true">✉</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Correo electrónico" /></label>
        <label className="auth-field"><span aria-hidden="true">♙</span><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Contraseña" /><button className="auth-eye" type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((visible) => !visible)}><LoginEyeIcon visible={showPassword} /></button></label>
        {mode === 'register' && <label className="auth-field"><span aria-hidden="true">♙</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Confirmar contraseña" /><button className="auth-eye" type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((visible) => !visible)}><LoginEyeIcon visible={showPassword} /></button></label>}
        {mode === 'register' && <p className="auth-hint">Mínimo 10 caracteres, con mayúsculas, minúsculas, números y símbolos.</p>}
        {mode === 'login' && <div className="auth-options"><label><input type="checkbox" /> Recordarme</label><button type="button">¿Has olvidado tu contraseña?</button></div>}
        {error && <p className="error auth-error">{error}</p>}
        {isSubmitting && <p className="auth-submitting">Cargando…</p>}
        <button className="auth-submit" type="submit">{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} <span aria-hidden="true">→</span></button>
        {mode === 'login' && <><div className="auth-divider"><span>o continúa con</span></div><div className="auth-socials"><button type="button" aria-label="Google"><b className="google-mark">G</b></button><button type="button" aria-label="Apple"><b className="apple-mark">●</b></button><button type="button" aria-label="Microsoft"><b className="microsoft-mark"><i /><i /><i /><i /></b></button></div><p className="auth-switch">¿No tienes cuenta? <button type="button" onClick={() => setMode('register')}>Crear cuenta</button></p></>}
      </form>
    </section>
  </main>
}
