import { useState } from 'react'
import type { BoardPayload, Profile, Project } from '../../api'
import { ProjectDrawer } from '../administration'
import { DeleteProjectModal } from '../sidebar/ProjectsSection/DeleteProjectModal'
import { api } from '../../api'
import { BoardSurface } from '../board/BoardSurface'
import type { GanttCardFocus, GanttDependencyNavigation } from '../board/GanttView'
import type { useBoard } from '../board/useBoard'
import type { useBoardFilters } from '../board/useBoardFilters'
import { ProjectHeader } from './ProjectHeader'
import { ProjectNavigation, type ProjectView } from './ProjectNavigation'
import { ProjectSurface } from './ProjectSurface'
import { ProjectGantt } from './ProjectGantt'
import type { ProjectContext } from './useProjectTabs'

type Props = { project: Project; board: BoardPayload | null; context?: ProjectContext; projectView: ProjectView; onProjectViewChange: (view: ProjectView) => void; boardState?: ReturnType<typeof useBoard>; filters?: ReturnType<typeof useBoardFilters>; profile?: Profile; query?: string; onBoardDeleted?: (id: number) => Promise<void>; ganttFocus?: GanttCardFocus | null; onNavigateExternalCard: (target: GanttDependencyNavigation) => void; onContextChange?: (context: ProjectContext) => void; onRefresh: () => Promise<unknown>; onDeleted: (id: number, projects: Project[]) => void; onBoardSelect?: (id: number) => void }

export function ProjectLayout({ project, board, context = 'project', projectView, onProjectViewChange, boardState, filters, profile, query, onBoardDeleted, onNavigateExternalCard, ganttFocus, onContextChange, onRefresh, onDeleted, onBoardSelect = (id) => window.dispatchEvent(new CustomEvent('tickard:select-board', { detail: id })) }: Props) {
  const [deleting, setDeleting] = useState(false)
  async function deleteProject(name: string) { await api(`/projects/${project.id}`, { method: 'DELETE', body: JSON.stringify({ confirmation_name: name }) }); const next = await onRefresh() as { projects: Project[] }; onDeleted(project.id, next.projects) }
  function changeView(next: ProjectView) { onProjectViewChange(next); onContextChange?.('project') }
  const projectContent = <>{projectView === 'overview' && <ProjectSurface project={project} board={board} />}{projectView === 'gantt' && profile && <ProjectGantt project={project} profile={profile} onNavigateExternalCard={onNavigateExternalCard} />}{projectView === 'boards' && <section className="project-panel project-boards-view"><h2>Tableros</h2><div className="project-board-cards">{project.boards.map((item) => <button key={item.id} className="project-board-card" type="button" onClick={() => onBoardSelect(item.id)}><strong>{item.name}</strong><span className="muted">Abrir tablero ›</span></button>)}</div></section>}{projectView !== 'overview' && projectView !== 'boards' && projectView !== 'gantt' && projectView !== 'settings' && <Placeholder title={itemsLabel(projectView)} />}{projectView === 'settings' && <section className="project-panel"><h2>Configuración</h2>{board ? <ProjectDrawer board={board} onClose={() => onProjectViewChange('overview')} onChange={async () => { await onRefresh() }} /> : <p className="muted">Este proyecto aún no tiene un tablero para configurar.</p>}<button className="danger" type="button" onClick={() => setDeleting(true)}>Eliminar proyecto</button></section>}</>
  const boardContent = context !== 'project' && boardState && filters && profile && query !== undefined ? <BoardSurface state={boardState} filters={filters} activeBoardId={context} project={project} profile={profile} query={query} onBoardDeleted={onBoardDeleted} onNavigateExternalCard={onNavigateExternalCard} ganttFocus={ganttFocus} embedded /> : null
  return <div className="workspace project-layout">{context === 'project' && <><ProjectHeader project={project} /><ProjectNavigation value={projectView} onChange={changeView} /><div className="project-view">{projectContent}</div></>}{boardContent}{deleting && <DeleteProjectModal project={project} onClose={() => setDeleting(false)} onConfirm={deleteProject} />}</div>
}

function Placeholder({ title }: { title: string }) { return <section className="project-panel project-placeholder"><h2>{title}</h2><p className="muted">Esta sección estará disponible próximamente.</p></section> }
function itemsLabel(view: ProjectView) { return view === 'gantt' ? 'Gantt' : view === 'calendar' ? 'Calendario' : view === 'files' ? 'Archivos' : 'Equipo' }
