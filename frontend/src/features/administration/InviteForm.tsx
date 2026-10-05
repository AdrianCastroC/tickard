import { type FormEvent, useState } from 'react'
import { api } from '../../api'

export function InviteForm({ projectId }: { projectId: number }) {
  const [link, setLink] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const result = await api<{ link: string }>(`/projects/${projectId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), name: form.get('name'), role: form.get('role') }),
    })
    setLink(result.link)
  }
  return (
    <form onSubmit={submit} className="field">
      <h2>Invitar</h2>
      <input name="name" placeholder="Nombre" />
      <input name="email" type="email" placeholder="Correo" required />
      <select name="role" defaultValue="editor">
        <option value="responsable">Responsable</option>
        <option value="editor">Editor</option>
        <option value="lector">Lector</option>
        <option value="cliente">Cliente</option>
      </select>
      <button className="primary" type="submit">Enviar invitaciÃ³n</button>
      {link && <p>Enlace: {link}</p>}
    </form>
  )
}
