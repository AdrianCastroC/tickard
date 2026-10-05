import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { api, type BoardPayload, type Profile, type Project } from '../../../api'
import { NavIcon, PlusIcon } from '../../../shared/ui'
import { CategoriesDrawer, ProjectDrawer } from '../../administration'
import { ProjectItem } from './ProjectItem'
import { DeleteBoardModal } from './DeleteBoardModal'
import { DeleteProjectModal } from './DeleteProjectModal'

type BoardRef = Project['boards'][number]
type Props = {
  profile: Profile
  workspaceId: number | null
  activeBoardId: number | null
  activeBoard: BoardPayload | null
  mini: boolean
  onOpenBoard: (project: Project, board: BoardRef) => void
  onProjectsChanged: () => Promise<Profile>
  onBoardDeleted: (boardId: number) => void
  onProjectDeleted: (projectId: number, remainingProjects: Project[]) => void
  onBoardChanged: () => Promise<void>
}

export function ProjectsSection({
  profile, workspaceId, activeBoardId, activeBoard, mini,
  onOpenBoard, onProjectsChanged, onBoardDeleted, onProjectDeleted, onBoardChanged,
}: Props) {
  const [open, setOpen] = useState(true)
  const [projectMenu, setProjectMenu] = useState<number | null>(null)
  const [boardMenu, setBoardMenu] = useState<number | null>(null)
  const [namingBoard, setNamingBoard] = useState(false)
  const [boardName, setBoardName] = useState('')
  const [newProject, setNewProject] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [boardToDelete, setBoardToDelete] = useState<BoardRef | null>(null)
  const [drawer, setDrawer] = useState<'project' | 'categories' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  function resetMenus() {
    setProjectMenu(null); setBoardMenu(null); setNamingBoard(false); setBoardName('')
  }

  useEffect(() => {
    if (projectMenu === null && boardMenu === null) return
    function close(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const inside = menuRef.current?.contains(target) &&
        (target.closest('.project-menu') || target.closest('button.more'))
      if (!inside) resetMenus()
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [projectMenu, boardMenu])

  async function createBoard(event: FormEvent<HTMLFormElement>, project: Project) {
    event.preventDefault()
    const name = boardName.trim()
    if (!name || saving) return
    setSaving(true); setError('')
    try {
      const created = await api<BoardRef>(`/projects/${project.id}/boards`, {
        method: 'POST', body: JSON.stringify({ name }),
      })
      await onProjectsChanged()
      resetMenus()
      onOpenBoard(project, created)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo completar la acción.')
    } finally { setSaving(false) }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const clientName = String(form.get('client_name') || '').trim()
    if (!name || !clientName || saving) return
    setSaving(true); setError('')
    try {
      const created = await api<Project>('/projects', {
        method: 'POST', body: JSON.stringify({ workspace_id: workspaceId, name, client_name: clientName }),
      })
      const data = await onProjectsChanged()
      setNewProject(false)
      const owner = data.projects.find((project) => project.id === created.id) ?? created
      if (owner.boards[0]) onOpenBoard(owner, owner.boards[0])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo completar la acción.')
    } finally { setSaving(false) }
  }

  async function deleteProject(confirmationName: string) {
    if (!projectToDelete) return
    await api(`/projects/${projectToDelete.id}`, {
      method: 'DELETE', body: JSON.stringify({ confirmation_name: confirmationName }),
    })
    const data = await onProjectsChanged()
    onProjectDeleted(projectToDelete.id, data.projects)
    setProjectToDelete(null)
    resetMenus()
  }

  async function deleteBoard(confirmationName: string) {
    if (!boardToDelete) return
    await api(`/boards/${boardToDelete.id}`, {
      method: 'DELETE', body: JSON.stringify({ confirmation_name: confirmationName }),
    })
    await onProjectsChanged()
    onBoardDeleted(boardToDelete.id)
    setBoardToDelete(null)
    resetMenus()
  }

  function manage(project: Project, kind: 'project' | 'categories', board?: BoardRef) {
    resetMenus()
    const target = board ?? project.boards.find((entry) => entry.id === activeBoardId) ?? project.boards[0]
    if (!target) return
    if (activeBoardId !== target.id) onOpenBoard(project, target)
    setDrawer(kind)
    if (activeBoardId === target.id && kind === 'categories') void onBoardChanged()
  }

  return <>
    <button type="button" className="nav-item sub side-section-toggle" title="Proyectos" onClick={() => setOpen((current) => !current)}>
      <NavIcon><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" /><circle cx="14" cy="15" r="1" /></NavIcon>
      <span className="side-label-text">Proyectos</span>
      <span className={`side-section-chevron${open ? ' open' : ''}`}>›</span>
    </button>
    {open && <>
      <div className="projects" ref={menuRef}>
        {profile.projects.map((project) => <ProjectItem
          key={project.id} project={project} activeBoardId={activeBoardId}
          projectMenu={projectMenu === project.id} boardMenu={boardMenu}
          namingBoard={namingBoard} boardName={boardName} saving={saving}
          onOpen={(board) => onOpenBoard(project, board)}
          onToggleMenu={() => {
            const next = projectMenu === project.id ? null : project.id
            resetMenus(); setError(''); setProjectMenu(next)
          }}
          onNewBoard={() => setNamingBoard(true)}
          onManage={() => manage(project, 'project')}
          onDeleteProject={() => { resetMenus(); setProjectToDelete(project) }}
          onBoardMenu={(id) => {
            const next = boardMenu === id ? null : id
            resetMenus(); setError(''); setBoardMenu(next)
          }}
          onCategories={(board) => manage(project, 'categories', board)}
          onDeleteBoard={(board) => { resetMenus(); setBoardToDelete(board) }}
          onBoardNameChange={setBoardName}
          onCreateBoard={(event) => void createBoard(event, project)}
        />)}
        {profile.projects.length === 0 && <p className="muted side-label-text">Todavía no hay proyectos.</p>}
        {profile.user.is_admin && !newProject && <button className="add-project" type="button" title="Nuevo proyecto" onClick={() => { setError(''); setNewProject(true) }}><PlusIcon /><span className="side-label-text">Nuevo proyecto</span></button>}
      </div>
      {profile.user.is_admin && newProject && !mini && <form onSubmit={createProject} className="field" noValidate>
        <input name="name" placeholder="Nombre del proyecto" />
        <input name="client_name" placeholder="Empresa cliente" />
        <div className="row">
          <button className="primary" type="submit" disabled={saving}>Crear</button>
          <button className="ghost" type="button" onClick={() => { setNewProject(false); setError('') }}>Cancelar</button>
        </div>
      </form>}
      {error && <p className="error">{error}</p>}
    </>}
    {createPortal(<>
      {projectToDelete && <DeleteProjectModal project={projectToDelete} onClose={() => setProjectToDelete(null)} onConfirm={deleteProject} />}
      {boardToDelete && <DeleteBoardModal board={boardToDelete} onClose={() => setBoardToDelete(null)} onConfirm={deleteBoard} />}
      {drawer === 'project' && activeBoard && <ProjectDrawer board={activeBoard} onClose={() => setDrawer(null)} onChange={onBoardChanged} />}
      {drawer === 'categories' && activeBoard && <CategoriesDrawer board={activeBoard} onClose={() => setDrawer(null)} onChange={onBoardChanged} />}
    </>, document.body)}
  </>
}

