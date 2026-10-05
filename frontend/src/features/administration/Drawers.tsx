import { type FormEvent, useEffect, useState } from 'react'
import { api, type BoardPayload } from '../../api'

export function RosterDrawer({
  title,
  hint,
  path,
  noun,
  workspaceId,
  onClose,
}: {
  title: string
  hint: string
  path: 'teams' | 'departments'
  noun: string
  workspaceId: number | null
  onClose: () => void
}) {
  type Item = { id: number; name: string; members: { id: number; name: string }[] }
  const [items, setItems] = useState<Item[]>([])
  const [people, setPeople] = useState<{ id: number; name: string }[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [error, setError] = useState('')
  const scopedPath = workspaceId
  ? `/${path}?workspace_id=${workspaceId}`
  : `/${path}`

  async function load() {
    const data = await api<
      Record<string, Item[] | { id: number; name: string }[]>
    >(scopedPath)
  
    setItems(data[path] as Item[])
    setPeople(data.people as { id: number; name: string }[])
  }

  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : 'No se pudo cargar.')) }, [path])

  function edit(item: Item) {
    setEditing(item.id)
    setName(item.name)
    setMembers(item.members.map((member) => String(member.id)))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    const body = JSON.stringify({
      workspace_id: workspaceId,
      name: name.trim(),
      member_ids: members.map(Number),
    })
    if (editing) await api(`/${path}/${editing}`, { method: 'PATCH', body })
    else await api(`/${path}`, { method: 'POST', body })
    setEditing(null)
    setName('')
    setMembers([])
    await load()
  }

  return (
    <div className="drawer-back" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="row">
          <h2>{title}</h2>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <p className="muted">{hint}</p>
        <ul className="notes">
          {items.length === 0 && <li>Todavía no hay nada.</li>}
          {items.map((item) => (
            <li key={item.id}>
              <div className="row">
                <strong>{item.name}</strong>
                <button className="ghost" type="button" onClick={() => edit(item)}>Editar</button>
                <button className="ghost" type="button" onClick={async () => { await api(`/${path}/${item.id}`, {method: 'DELETE', body: JSON.stringify({workspace_id: workspaceId})}); if (editing === item.id) { setEditing(null); setName(''); setMembers([]) }; await load() }}>Quitar</button>
              </div>
              <p className="muted">{item.members.map((member) => member.name).join(', ') || 'Sin personas'}</p>
            </li>
          ))}
        </ul>
        <form className="composer" onSubmit={save}>
          <h3>{editing ? `Editar ${noun}` : `Nuevo ${noun}`}</h3>
          <label className="field">Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field">Personas
            <select multiple value={members} onChange={(event) => setMembers([...event.target.selectedOptions].map((option) => option.value))}>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="primary" type="submit">{editing ? 'Guardar' : `Crear ${noun}`}</button>
            {editing && <button className="ghost" type="button" onClick={() => { setEditing(null); setName(''); setMembers([]) }}>Cancelar</button>}
          </div>
        </form>
      </aside>
    </div>
  )
}

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

export function CategoriesDrawer({ board, onClose, onChange }: {
  board: BoardPayload
  onClose: () => void
  onChange: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')
  const categories = board.categories ?? []

  async function create(event: FormEvent) {
    event.preventDefault()
    const title = name.trim()
    if (!title) return
    setError('')
    try {
      await api(`/boards/${board.board.id}/categories`, { method: 'POST', body: JSON.stringify({ name: title }) })
      setName('')
      await onChange()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la categoría.')
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (editing === null) return
    const title = editName.trim()
    if (!title) return
    await api(`/categories/${editing}`, { method: 'PATCH', body: JSON.stringify({ name: title }) })
    setEditing(null)
    await onChange()
  }

  async function remove(id: number) {
    await api(`/categories/${id}`, { method: 'DELETE' })
    await onChange()
  }

  return (
    <div className="drawer-back" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="row">
          <h2>Categorías del tablero</h2>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <p className="muted">
          Las categorías son del tablero y se comparten entre columnas. Al mover una tarjeta se mantiene la categoría.
          En el tablero solo se muestran si hay alguna tarjeta asignada a ellas.
        </p>
        <ul className="notes">
          {categories.length === 0 && <li className="muted">Todavía no hay categorías.</li>}
          {categories.map((category) => (
            <li key={category.id}>
              {editing === category.id ? (
                <form className="row" onSubmit={saveEdit}>
                  <input value={editName} onChange={(event) => setEditName(event.target.value)} autoFocus />
                  <button className="primary" type="submit">Guardar</button>
                  <button className="ghost" type="button" onClick={() => setEditing(null)}>Cancelar</button>
                </form>
              ) : (
                <div className="row">
                  <strong>{category.name}</strong>
                  <button className="ghost" type="button" onClick={() => { setEditing(category.id); setEditName(category.name) }}>Editar</button>
                  <button className="ghost" type="button" onClick={() => remove(category.id)}>Borrar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <form className="composer" onSubmit={create}>
          <h3>Nueva categoría</h3>
          <label className="field">Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Crear categoría</button>
        </form>
      </aside>
    </div>
  )
}

export function ProjectDrawer({ board, onClose, onChange }: { board: BoardPayload; onClose: () => void; onChange: () => Promise<void> }) {
  const [visibility, setVisibility] = useState(board.visibility)
  const fields = [
    ['description', 'Descripción'],
    ['assignee', 'Asignación'],
    ['due_date', 'Fecha límite'],
    ['priority', 'Prioridad'],
    ['labels', 'Etiquetas'],
    ['comments', 'Comentarios'],
  ] as const

  return (
    <div className="drawer-back" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <h2>Qué ve el cliente</h2>
        {fields.map(([key, label]) => (
          <label key={key} className="row">
            <input type="checkbox" checked={Boolean(visibility[key])} onChange={async (event) => {
              const next = { ...visibility, [key]: event.target.checked }
              setVisibility(next)
              await api(`/projects/${board.board.project_id}`, { method: 'PATCH', body: JSON.stringify({ [`show_${key}`]: event.target.checked }) })
              await onChange()
            }} />
            {label}
          </label>
        ))}
        <h2>Personas</h2>
        <ul className="notes">
          {board.members.map((member) => <li key={member.id}>{member.name} · {member.role}</li>)}
        </ul>
        <InviteForm projectId={board.board.project_id} />
      </aside>
    </div>
  )
}

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
      <button className="primary" type="submit">Enviar invitación</button>
      {link && <p>Enlace: {link}</p>}
    </form>
  )
}
