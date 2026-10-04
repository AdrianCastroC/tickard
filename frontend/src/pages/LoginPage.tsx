import { type FormEvent, useState } from 'react'
import { api, setToken, type Profile } from '../api'

export function Login() {
  const [email, setEmail] = useState('ana@gestor.test')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const result = await api<{ token: string; user: Profile }>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setToken(result.token)
      window.location.href = '/'
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo entrar.')
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <div className="brand"><img src="/logo-removebg.png" alt="tickard" /></div>
        <p>Entra con el correo de tu empresa.</p>
        <label className="field">Correo<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label>
        <label className="field">Contraseña<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit">Entrar</button>
      </form>
    </main>
  )
}
