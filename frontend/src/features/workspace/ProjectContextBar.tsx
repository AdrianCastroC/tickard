import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { api, type Project } from '../../api'
import { PlusIcon } from '../../shared/ui'
import { PROJECT_VIEWS, type ProjectView } from './ProjectNavigation'
import type { ProjectContext } from './useProjectTabs'

type Props = { project: Project; context: ProjectContext; canManage: boolean; projectView: ProjectView; onProjectView: (view: ProjectView) => void; onContext: (context: ProjectContext) => void; onRefresh: () => Promise<unknown> }

export function ProjectContextBar({ project, context, canManage, projectView, onProjectView, onContext, onRefresh }: Props) {
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const projectButtonRef = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    const button = projectButtonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    setPosition({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - 218)) })
  }, [])

  useEffect(() => {
    if (!open) return
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false) }
    updatePosition()
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => { document.removeEventListener('keydown', closeOnEscape); window.removeEventListener('scroll', updatePosition, true); window.removeEventListener('resize', updatePosition) }
  }, [open, updatePosition])

  function toggleMenu() {
    setOpen((current) => !current)
  }

  async function createBoard(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    const created = await api<{ id: number }>(`/projects/${project.id}/boards`, { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
    setName(''); setCreating(false); await onRefresh(); onContext(created.id)
  }
  const [name, setName] = useState('')
  const menu = open && createPortal(<><button className="project-context-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} /><div className="project-context-popover" style={{ top: position.top, left: position.left }} role="menu"><div className="project-context-popover-title">Proyecto</div>{PROJECT_VIEWS.map(([key, label]) => <button key={key} type="button" className={projectView === key ? 'on' : ''} onClick={() => { setOpen(false); onProjectView(key); onContext('project') }}>{label}</button>)}</div></>, document.body)

  return <div className="project-context-bar"><button ref={projectButtonRef} className={context === 'project' ? 'on' : ''} type="button" aria-expanded={open} onClick={toggleMenu}>Proyecto</button>{project.boards.map((board) => <button key={board.id} className={context === board.id ? 'on' : ''} type="button" onClick={() => onContext(board.id)}>{board.name}</button>)}{canManage && <button className="context-add" type="button" aria-label="Crear tablero" onClick={() => setCreating((current) => !current)}><PlusIcon /></button>}{creating && <form className="context-create" onSubmit={createBoard}><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del tablero" /><button className="primary" type="submit">Crear</button></form>}{menu}</div>
}
