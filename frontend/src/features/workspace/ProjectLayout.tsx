import { useEffect, useState } from 'react'
import type { BoardPayload, Profile, Project } from '../../api'
import { api } from '../../api'
import { ProjectDrawer } from '../administration'
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
  project, board, context = 'project', projectView, onProjectViewChange, boardState, filters, profile,
  query, onBoardDeleted, onNavigateExternalCard, ganttFocus, onContextChange, onRefresh, onDeleted,
  onBoardSelect = (id) => window.dispatchEvent(new CustomEvent('tickard:select-board', { detail: id })),
}: Props) {
  const [deleting, setDeleting] = useState(false)
  const canManage = project.role === 'responsable'
  const [clientAccessBusy, setClientAccessBusy] = useState(false)
  const [clientAccessError, setClientAccessError] = useState('')
  const [availableClients, setAvailableClients] = useState<{id:number;name:string}[]>([])
  const workspaceClientsEnabled = profile?.workspaces.some(workspace =>
    workspace.id === project.workspace_id && workspace.show_clients) ?? false
  useEffect(() => {
    if (projectView !== 'settings' || !canManage || !workspaceClientsEnabled) return
    let active = true
    void api<{clients:{id:number;name:string}[]}>(`/clients?workspace_id=${project.workspace_id}`)
      .then(result => { if (active) setAvailableClients(result.clients.map(client => ({id:client.id,name:client.name}))) })
      .catch(() => { if (active) setAvailableClients([]) })
    return () => { active = false }
  }, [projectView, canManage, workspaceClientsEnabled, project.workspace_id])

  async function updateClientAccess(clientId: number | null, enabled: boolean) {
    if (clientAccessBusy) return
    setClientAccessBusy(true); setClientAccessError('')
    try {
      await api(`/projects/${project.id}`, { method: 'PATCH',
        body: JSON.stringify({ client_company_id: clientId, client_access_enabled: enabled }),
      })
      await onRefresh()
    } catch (cause) {
      setClientAccessError(cause instanceof Error ? cause.message : 'No se pudo actualizar el acceso de clientes.')
    } finally { setClientAccessBusy(false) }
  }
  async function deleteProject(name: string) {
    await api(`/projects/${project.id}`, { method: 'DELETE', body: JSON.stringify({ confirmation_name: name }) })
    const next = await onRefresh() as { projects: Project[] }
    onDeleted(project.id, next.projects)
  }
  function changeView(next: ProjectView) {
    onProjectViewChange(next)
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
    {projectView === 'settings' && canManage && <section className="project-panel project-settings-view">
      <h2>Configuración del proyecto</h2>
      <div className="project-client-settings">
        <h3>Acceso de clientes</h3>
        {workspaceClientsEnabled ? <>
          <label className="field">Empresa cliente (opcional)
            <select value={project.client_company_id ?? ''} disabled={clientAccessBusy || project.client_access_enabled}
              onChange={event => void updateClientAccess(event.target.value ? Number(event.target.value) : null, false)}>
              <option value="">Sin empresa cliente</option>
              {availableClients.map(client => <option value={client.id} key={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label className="workspace-birthday-toggle">
            <span><strong>Permitir acceso de clientes a este proyecto</strong>
              <small>Solo las cuentas autorizadas de la empresa seleccionada podrán acceder según sus permisos. La empresa asociada por sí sola no concede acceso.</small></span>
            <input type="checkbox" checked={Boolean(project.client_access_enabled)}
              disabled={clientAccessBusy || !project.client_company_id}
              onChange={event => void updateClientAccess(project.client_company_id, event.target.checked)}/>
          </label>
        </> : <p className="muted">El módulo Clientes está desactivado en este Workspace. Los proyectos funcionan sin acceso externo.</p>}
        {clientAccessError && <p role="alert" className="error">{clientAccessError}</p>}
      </div>
      {board
        ? <ProjectDrawer embedded board={board} onClose={() => changeView('overview')} onChange={async () => { await onRefresh() }}/>
        : <p className="muted">{project.boards.length ? 'Cargando configuración…' : 'Este proyecto aún no tiene un tablero para configurar.'}</p>}
      <button className="danger" type="button" onClick={() => setDeleting(true)}>Eliminar proyecto</button>
    </section>}
    {projectView === 'settings' && !canManage && <section className="project-panel">
      <h2>Configuración del proyecto</h2><p className="muted">No tienes permisos para administrar este proyecto.</p>
    </section>}
  </>
  const boardContent = context !== 'project' && boardState && filters && profile && query !== undefined
    ? <BoardSurface state={boardState} filters={filters} activeBoardId={context} project={project}
      profile={profile} query={query} onBoardDeleted={onBoardDeleted}
      onNavigateExternalCard={onNavigateExternalCard} ganttFocus={ganttFocus} embedded/>
    : null

  return <div className="workspace project-layout">
    {context === 'project' && <>
      <ProjectHeader project={project} settingsActive={projectView === 'settings'}
        onSettings={() => changeView(projectView === 'settings' ? 'overview' : 'settings')}/>
      <ProjectNavigation value={projectView} onChange={changeView}/>
      <div className={`project-view${projectView === 'boards' ? ' project-view-boards' : projectView === 'overview' ? ' project-view-overview' : ''}`}>{projectContent}</div>
    </>}
    {boardContent}
    {deleting && <DeleteProjectModal project={project} onClose={() => setDeleting(false)} onConfirm={deleteProject}/>}
  </div>
}
