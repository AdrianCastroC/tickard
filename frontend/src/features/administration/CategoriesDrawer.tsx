import { type FormEvent, useState } from 'react'
import { api, type BoardPayload } from '../../api'

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
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la categorÃ­a.')
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
          <h2>CategorÃ­as del tablero</h2>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <p className="muted">
          Las categorÃ­as son del tablero y se comparten entre columnas. Al mover una tarjeta se mantiene la categorÃ­a.
          En el tablero solo se muestran si hay alguna tarjeta asignada a ellas.
        </p>
        <ul className="notes">
          {categories.length === 0 && <li className="muted">TodavÃ­a no hay categorÃ­as.</li>}
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
          <h3>Nueva categorÃ­a</h3>
          <label className="field">Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Crear categorÃ­a</button>
        </form>
      </aside>
    </div>
  )
}
