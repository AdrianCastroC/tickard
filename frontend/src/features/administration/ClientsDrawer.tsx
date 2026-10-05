import { type FormEvent, useEffect, useState } from 'react'
import { api } from '../../api'

export function ClientsDrawer({ workspaceId, onClose }: { workspaceId: number | null; onClose: () => void }) {
  const [clients, setClients] = useState<{ id: number; name: string; projects_count: number; people_count: number }[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const scopedPath = workspaceId
    ? `/clients?workspace_id=${workspaceId}`
    : '/clients'

  async function load() {
    setClients(await api<typeof clients>(scopedPath))
  }

  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los clientes.')) }, [])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    await api('/clients', { method: 'POST', body: JSON.stringify({workspace_id: workspaceId, name: name.trim() }) })
    setName('')
    await load()
  }

  return (
    <div className="drawer-back" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="row">
          <h2>Clientes</h2>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <p className="muted">Cada proyecto pertenece a una empresa cliente.</p>
        <ul className="notes">
          {clients.map((client) => (
            <li key={client.id}>
              <strong>{client.name}</strong>
              <p className="muted">{client.projects_count} {client.projects_count === 1 ? 'proyecto' : 'proyectos'} · {client.people_count} {client.people_count === 1 ? 'persona' : 'personas'}</p>
            </li>
          ))}
        </ul>
        <form className="composer" onSubmit={save}>
          <h3>Nuevo cliente</h3>
          <label className="field">Empresa<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Crear cliente</button>
        </form>
      </aside>
    </div>
  )

}
