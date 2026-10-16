import { type FormEvent, useEffect, useState } from 'react'
import { api } from '../../api'
import { FloppyIcon } from '../../shared/icons'

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
            <button className={editing ? 'primary save-button' : 'primary'} type="submit">{editing && <FloppyIcon />}{editing ? 'Guardar' : `Crear ${noun}`}</button>
            {editing && <button className="ghost" type="button" onClick={() => { setEditing(null); setName(''); setMembers([]) }}>Cancelar</button>}
          </div>
        </form>
      </aside>
    </div>
  )
}
