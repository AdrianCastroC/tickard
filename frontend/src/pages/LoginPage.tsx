import { type FormEvent, type ReactNode, useState } from 'react'
import { api, setToken, type Profile } from '../api'

type AuthMode = 'login' | 'register'

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="auth-feature"><div className="auth-feature-icon" aria-hidden="true">{icon}</div><strong>{title}</strong><span>{text}</span></div>
}

function FeatureIcon({ type }: { type: 'tasks' | 'boards' | 'teams' | 'projects' }) {
  const common = { width: 28, height: 28, viewBox: '0 0 28 28', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' }
  if (type === 'tasks') return <svg {...common}><rect x="4" y="4" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="2" /><path d="m8 14 4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  if (type === 'boards') return <svg {...common}><rect x="4" y="5" width="8" height="18" rx="2" stroke="currentColor" strokeWidth="2" /><rect x="16" y="5" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 9h1M8 13h1M20 9h1M20 13h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  if (type === 'teams') return <svg {...common}><circle cx="14" cy="9" r="4" stroke="currentColor" strokeWidth="2" /><path d="M6 23c.7-4 3.2-6 8-6s7.3 2 8 6M5 12a3 3 0 0 0 0 6M23 12a3 3 0 0 1 0 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  return <svg {...common}><path d="M5 22V15M11 22V11M17 22V7M23 22V4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><path d="m4 9 6-4 6 2 7-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function EyeIcon({ visible }: { visible: boolean }) {
  return <svg className="auth-eye-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" />{visible && <path d="m4 4 16 16" />}</svg>
}

export function Login() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('ana@gestor.test')
  const [password, setPassword] = useState('password')
  const [name, setName] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (mode === 'register') {
      if (password !== confirmation) setError('Las contraseñas no coinciden.')
      return
    }
    try {
      const result = await api<{ token: string; user: Profile }>('/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      setToken(result.token)
      window.location.href = '/'
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo entrar.')
    }
  }

  return <main className="auth-screen">
    <header className="auth-header"><img src="/logo-removebg.png" alt="tickard" /><span className="auth-language">◎ &nbsp; Español &nbsp;⌄</span></header>
    <section className="auth-layout">
      <div className="auth-hero">
        <img className="auth-hero-mark" src="/logo-removebg.png" alt="" />
        <h1>Organiza. Marca. Completa.</h1><p>Tus tareas, proyectos y equipos,<br />en un solo lugar.</p>
        <div className="auth-features"><Feature icon={<FeatureIcon type="tasks" />} title="Tareas" text="Organiza tu día" /><Feature icon={<FeatureIcon type="boards" />} title="Tableros" text="Visualiza el progreso" /><Feature icon={<FeatureIcon type="teams" />} title="Equipos" text="Colabora sin límites" /><Feature icon={<FeatureIcon type="projects" />} title="Proyectos" text="Convierte planes en resultados" /></div>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-tabs" role="tablist" aria-label="Acceso"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Iniciar sesión</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>Crear cuenta</button></div>
        <div className="auth-heading"><h2>{mode === 'login' ? 'Bienvenido' : 'Crea tu cuenta'}</h2><p>{mode === 'login' ? 'Accede a tu cuenta de Tickard' : 'Empieza a organizarte con Tickard'}</p></div>
        {mode === 'register' && <label className="auth-field"><span>Nombre</span><input value={name} onChange={(event) => setName(event.target.value)} type="text" placeholder="Tu nombre" /></label>}
        <label className="auth-field"><span aria-hidden="true">✉</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Correo electrónico" /></label>
        <label className="auth-field"><span aria-hidden="true">♙</span><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Contraseña" /><button className="auth-eye" type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((visible) => !visible)}><EyeIcon visible={showPassword} /></button></label>
        {mode === 'register' && <label className="auth-field"><span aria-hidden="true">♙</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Confirmar contraseña" /><button className="auth-eye" type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((visible) => !visible)}><EyeIcon visible={showPassword} /></button></label>}
        {mode === 'login' && <div className="auth-options"><label><input type="checkbox" /> Recordarme</label><button type="button">¿Has olvidado tu contraseña?</button></div>}
        {error && <p className="error auth-error">{error}</p>}
        <button className="auth-submit" type="submit">{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} <span aria-hidden="true">→</span></button>
        {mode === 'login' && <><div className="auth-divider"><span>o continúa con</span></div><div className="auth-socials"><button type="button" aria-label="Google"><b className="google-mark">G</b></button><button type="button" aria-label="Apple"><b className="apple-mark">●</b></button><button type="button" aria-label="Microsoft"><b className="microsoft-mark"><i /><i /><i /><i /></b></button></div><p className="auth-switch">¿No tienes cuenta? <button type="button" onClick={() => setMode('register')}>Crear cuenta</button></p></>}
      </form>
    </section>
  </main>
}
