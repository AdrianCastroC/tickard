import { useState, type FormEvent } from 'react'
import { api, type Project } from '../../api'
import { PlusIcon } from '../../shared/ui'
import type { ProjectContext } from './useProjectTabs'

type Props = { project: Project; context: ProjectContext; canManage: boolean; onContext: (context: ProjectContext) => void; onRefresh: () => Promise<unknown> }

export function ProjectContextBar({ project, context, canManage, onContext, onRefresh }: Props) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  async function createBoard(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    const created = await api<{ id: number }>(`/projects/${project.id}/boards`, { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
    setName('')
    setCreating(false)
    await onRefresh()
    onContext(created.id)
  }

  return <div className="project-context-bar"><button className={context === 'project' ? 'on' : ''} type="button" onClick={() => onContext('project')}>Proyecto</button>{project.boards.map((board) => <button key={board.id} className={context === board.id ? 'on' : ''} type="button" onClick={() => onContext(board.id)}>{board.name}</button>)}{canManage && <button className="context-add" type="button" aria-label="Crear tablero" onClick={() => setCreating((current) => !current)}><PlusIcon /></button>}{creating && <form className="context-create" onSubmit={createBoard}><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del tablero" /><button className="primary" type="submit">Crear</button></form>}</div>
}
