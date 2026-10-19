import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BoardPayload, Profile, Project } from '../../api'
import { api } from '../../api'
import { ProjectSettings } from '../administration'
import { DeleteProjectModal } from '../sidebar/ProjectsSection/DeleteProjectModal'
import { BoardSurface } from '../board/BoardSurface'
import type { GanttCardFocus, GanttDependencyNavigation } from '../board/GanttView'
import type { useBoard } from '../board/useBoard'
import type { useBoardFilters } from '../board/useBoardFilters'
import { ProjectHeader } from './ProjectHeader'
import { ProjectNavigation, type ProjectView } from './ProjectNavigation'
import { ProjectSurface } from './ProjectSurface'
import { ProjectBoards } from './ProjectBoards'
import { ProjectGantt } from './ProjectGantt'
import { ProjectCalendar } from './ProjectCalendar'
import { ProjectFiles } from './ProjectFiles'
import { ProjectPersonnel } from './ProjectPersonnel'
import type { ProjectContext } from './useProjectTabs'

type Props = {
  project: Project; board: BoardPayload | null; context?: ProjectContext; projectView: ProjectView
  onProjectViewChange: (view: ProjectView) => void
  boardState?: ReturnType<typeof useBoard>; filters?: ReturnType<typeof useBoardFilters>
  profile?: Profile; query?: string; onBoardDeleted?: (id: number) => Promise<void>
  ganttFocus?: GanttCardFocus | null; onNavigateExternalCard: (target: GanttDependencyNavigation) => void
  onContextChange?: (context: ProjectContext) => void; onRefresh: () => Promise<unknown>
  onDeleted: (id: number, projects: Project[]) => void; onBoardSelect?: (id: number) => void
}

export function ProjectLayout({
  project, context = 'project', projectView, onProjectViewChange, boardState, filters, profile,
  query, onBoardDeleted, onNavigateExternalCard, ganttFocus, onContextChange, onRefresh, onDeleted,
  onBoardSelect = (id) => window.dispatchEvent(new CustomEvent('tickard:select-board', { detail: id })),
}: Props) {
  const [deleting, setDeleting] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  useEffect(() => { setSettingsOpen(false) }, [project.id])
  const canManage = project.role === 'responsable'
  async function deleteProject(name: string) {
    await api(`/projects/${project.id}`, { method: 'DELETE', body: JSON.stringify({ confirmation_name: name }) })
    const next = await onRefresh() as { projects: Project[] }
    onDeleted(project.id, next.projects)
  }
  function changeView(next: ProjectView) {
    onProjectViewChange(next === 'settings' ? 'overview' : next)
    onContextChange?.('project')
  }

  const projectContent = <>
    {projectView === 'overview' && <ProjectSurface key={project.id} project={project} onOpenGantt={() => changeView('gantt')}
      onOpenPersonnel={() => changeView('team')} onBoardSelect={onBoardSelect}
      onOpenCard={onNavigateExternalCard}/>}
    {projectView === 'boards' && <ProjectBoards key={project.id} project={project}
      onBoardSelect={onBoardSelect} onRefresh={onRefresh}/>}
    {projectView === 'gantt' && profile && <ProjectGantt project={project} profile={profile} onNavigateExternalCard={onNavigateExternalCard}/>}
    {projectView === 'calendar' && profile && <ProjectCalendar key={project.id} project={project} profile={profile}/>}
    {projectView === 'files' && profile && <ProjectFiles key={project.id} project={project} profile={profile}/>}
    {projectView === 'team' && profile && <ProjectPersonnel key={project.id} project={project} profile={profile}/>}

  </>
  const boardContent = context !== 'project' && boardState && filters && profile && query !== undefined
    ? <BoardSurface state={boardState} filters={filters} activeBoardId={context} project={project}
      profile={profile} query={query} onBoardDeleted={onBoardDeleted}
      onNavigateExternalCard={onNavigateExternalCard} ganttFocus={ganttFocus} embedded/>
    : null

  return <div className="workspace project-layout">
    {context === 'project' && <>
      <ProjectHeader project={project} settingsActive={settingsOpen}
        onSettings={() => setSettingsOpen(true)}/>
      <ProjectNavigation value={projectView} onChange={changeView}/>
      <div className={`project-view${projectView === 'boards' ? ' project-view-boards' : projectView === 'overview' ? ' project-view-overview' : ''}`}>{projectContent}</div>
    </>}
    {boardContent}
    {settingsOpen && canManage && createPortal(
      <div className="wd-modal-back" onMouseDown={event => {
        if (event.target === event.currentTarget) setSettingsOpen(false)
      }}>
        <div className="wd-modal project-settings-modal" role="dialog" aria-modal="true" aria-labelledby="project-settings-modal-title">
          <header className="wd-modal-head">
            <h2 id="project-settings-modal-title">Configuración del proyecto</h2>
            <button type="button" aria-label="Cerrar configuración" onClick={() => setSettingsOpen(false)}>×</button>
          </header>
          <div className="project-settings-modal-body">
            <ProjectSettings key={project.id} project={project} onRefresh={onRefresh}
              onDelete={() => { setSettingsOpen(false); setDeleting(true) }}/>
          </div>
        </div>
      </div>,
      document.body,
    )}
    {deleting && <DeleteProjectModal project={project} onClose={() => setDeleting(false)} onConfirm={deleteProject}/>}
  </div>
}
