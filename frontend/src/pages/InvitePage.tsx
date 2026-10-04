import { type FormEvent, useEffect, useState } from 'react'
import { api, setToken } from '../api'

export function Invite({ token }: { token: string }) {
  const [info, setInfo] = useState<{ project: string; client: string; email: string } | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ project: string; client: string; email: string; name?: string }>(`/invitations/${token}`)
      .then((data) => {
        setInfo(data)
        setName(data.name ?? '')
      })
      .catch(() => setError('Esta invitación ya no está disponible.'))
  }, [token])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const result = await api<{ token: string }>(`/invitations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    })
    setToken(result.token)
    window.location.href = '/'
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <h1>Aceptar invitación</h1>
        {info && <p>{info.project} · {info.client}</p>}
        <label className="field">Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field">Contraseña<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit">Crear acceso</button>
      </form>
    </main>
  )
}

