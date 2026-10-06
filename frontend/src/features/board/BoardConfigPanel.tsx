import { useState } from 'react'
import { api, type BoardPayload } from '../../api'
import { CategoriesDrawer } from '../administration'
import { DeleteBoardModal } from '../sidebar/ProjectsSection/DeleteBoardModal'

export function BoardConfigPanel({ board, onClose, onChange, onDeleted }: { board: BoardPayload; onClose: () => void; onChange: () => Promise<void>; onDeleted: () => Promise<void> }) {
  const [categories, setCategories] = useState(false)
  const [deleting, setDeleting] = useState(false)
  async function confirmDelete(name: string) {
    await api(`/boards/${board.board.id}`, { method: 'DELETE', body: JSON.stringify({ confirmation_name: name }) })
    setDeleting(false)
    await onDeleted()
  }
  return <>{<div className="drawer-back" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="row"><h2>Configurar tablero</h2><button className="ghost" type="button" onClick={onClose}>Cerrar</button></div><button className="ghost" type="button" onClick={() => setCategories(true)}>Gestionar categorías</button><button className="danger" type="button" onClick={() => setDeleting(true)}>Eliminar tablero</button></aside></div>}{categories && <CategoriesDrawer board={board} onClose={() => setCategories(false)} onChange={onChange} />}{deleting && <DeleteBoardModal board={board.board} onClose={() => setDeleting(false)} onConfirm={confirmDelete} />}</>
}
