import { useState } from 'react'
import type { BoardPayload, Project } from '../../api'
import { ProjectDrawer } from '../administration'
import { DeleteProjectModal } from '../sidebar/ProjectsSection/DeleteProjectModal'
import { api } from '../../api'
import { ProjectHeader } from './ProjectHeader'
import { ProjectNavigation, type ProjectView } from './ProjectNavigation'
import { ProjectSurface } from './ProjectSurface'

export function ProjectLayout({ project, board, onRefresh, onDeleted, onBoardSelect = (id) => window.dispatchEvent(new CustomEvent('tickard:select-board', { detail: id })) }: { project: Project; board: BoardPayload | null; onRefresh: () => Promise<unknown>; onDeleted: (id: number, projects: Project[]) => void; onBoardSelect?: (id: number) => void }) {
  const [view, setView] = useState<ProjectView>('overview')
  const [deleting, setDeleting] = useState(false)
  async function deleteProject(name: string) { await api(`/projects/${project.id}`, { method: 'DELETE', body: JSON.stringify({ confirmation_name: name }) }); const profile = await onRefresh() as { projects: Project[] }; onDeleted(project.id, profile.projects) }
  return <div className="workspace project-layout"><ProjectHeader project={project} /><ProjectNavigation value={view} onChange={setView} /><div className="project-view">{view === 'overview' && <ProjectSurface project={project} board={board} />}{view === 'boards' && <section className="project-panel project-boards-view"><h2>Tableros</h2><div className="project-board-cards">{project.boards.map((item) => <button key={item.id} className="project-board-card" type="button" onClick={() => onBoardSelect(item.id)}><strong>{item.name}</strong><span className="muted">Abrir tablero ›</span></button>)}</div></section>}{view !== 'overview' && view !== 'boards' && view !== 'settings' && <Placeholder title={itemsLabel(view)} />}{view === 'settings' && <section className="project-panel"><h2>Configuración</h2>{board ? <ProjectDrawer board={board} onClose={() => setView('overview')} onChange={async () => { await onRefresh() }} /> : <p className="muted">Este proyecto aún no tiene un tablero para configurar.</p>}<button className="danger" type="button" onClick={() => setDeleting(true)}>Eliminar proyecto</button></section>}</div>{deleting && <DeleteProjectModal project={project} onClose={() => setDeleting(false)} onConfirm={deleteProject} />}</div>
}
function Placeholder({ title }: { title: string }) { return <section className="project-panel project-placeholder"><h2>{title}</h2><p className="muted">Esta sección estará disponible próximamente.</p></section> }
function itemsLabel(view: ProjectView) { return view === 'gantt' ? 'Gantt' : view === 'calendar' ? 'Calendario' : view === 'files' ? 'Archivos' : 'Equipo' }
