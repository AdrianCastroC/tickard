import { useEffect, useState } from 'react'
import type { Profile, Project } from '../api'
import { NavIcon } from '../shared/icons'
import { AccountHeader } from '../features/account/AccountHeader'
import { AccountFooter } from '../features/account/AccountFooter'
import { useBoard } from '../features/board/useBoard'
import type { GanttCardFocus, GanttDependencyNavigation } from '../features/board/GanttView'
import { useBoardFilters } from '../features/board/useBoardFilters'
import { GlobalHome, InboxSurface } from '../features/global/GlobalSurfaces'
import { MyTasksSurface, type MyTask, type MyMeeting } from '../features/global/MyTasksSurface'
import { Sidebar } from '../features/sidebar/Sidebar'
import { useSidebarState } from '../features/sidebar/useSidebarState'
import { WorkspaceSelector } from '../features/sidebar/WorkspaceSelector/WorkspaceSelector'
import { PersonalSection } from '../features/sidebar/PersonalSection/PersonalSection'
import { ProjectsSection } from '../features/sidebar/ProjectsSection/ProjectsSection'
import { MainContent } from '../features/workspace/MainContent'
import { ProjectContextBar } from '../features/workspace/ProjectContextBar'
import { WorkspaceOverview } from '../features/workspace/WorkspaceOverview'
import { ProjectLayout as ProjectSurface } from '../features/workspace/ProjectLayout'
import type { ProjectView } from '../features/workspace/ProjectNavigation'
import { useWorkspace } from '../features/workspace/useWorkspace'
import { useProjectTabs, type ProjectContext } from '../features/workspace/useProjectTabs'

type AppContext = 'home' | 'inbox' | 'my-tasks' | 'workspace'

export function Workspace() {
  const workspace = useWorkspace(); const sidebar = useSidebarState(); const [query, setQuery] = useState(''); const [appContext, setAppContext] = useState<AppContext>('home'); const [breadcrumb, setBreadcrumb] = useState(['Inicio'])
  if (!workspace.profile) return <main className="login"><p>Cargando…</p></main>
  return <div className={`frame${sidebar.mini ? ' is-side-mini' : ''}`}><AccountHeader profile={workspace.profile} workspaceId={workspace.activeWorkspaceId} onProfile={workspace.updateProfile} query={query} onQueryChange={setQuery} breadcrumb={breadcrumb} mini={sidebar.mini} /><WorkspaceContent workspace={workspace} profile={workspace.profile} sidebar={sidebar} query={query} appContext={appContext} onAppContext={setAppContext} onBreadcrumb={setBreadcrumb} /></div>
}

function WorkspaceContent({ workspace, profile, sidebar, query, appContext, onAppContext, onBreadcrumb }: { workspace: ReturnType<typeof useWorkspace>; profile: Profile; sidebar: ReturnType<typeof useSidebarState>; query: string; appContext: AppContext; onAppContext: (context: AppContext) => void; onBreadcrumb: (value: string[]) => void }) {
  const tabs = useProjectTabs(profile.projects); const activeProject = profile.projects.find((project) => project.id === tabs.activeProjectId); const context: ProjectContext = activeProject ? tabs.contexts[activeProject.id] ?? 'project' : 'project'; const [projectView, setProjectView] = useState<ProjectView>('overview'); const activeBoardId = appContext === 'workspace' && typeof context === 'number' ? context : appContext === 'workspace' && context === 'project' && projectView === 'settings' ? activeProject?.boards[0]?.id ?? null : null; const board = useBoard(activeBoardId, tabs.selection); const filters = useBoardFilters(); const canManage = activeProject?.role === 'responsable'
  const [ganttFocus, setGanttFocus] = useState<GanttCardFocus | null>(null)
  function openRelatedGanttCard(target: GanttDependencyNavigation) {
    const relatedProject = profile.projects.find((project) =>
      project.boards.some((targetBoard) => targetBoard.id === target.boardId))
    if (!relatedProject) return

    board.setSelected(null)
    onAppContext('workspace')
    setGanttFocus((current) => ({ ...target, requestId: (current?.requestId ?? 0) + 1 }))
    // The project and board must change atomically; selecting the context
    // before a new project becomes active would navigate in the old tab.
    tabs.selectBoard(relatedProject, target.boardId)
  }
  async function openMyTask(task: MyTask) {
    // Mis tareas spans all Workspaces. Resolve membership and project access
    // again before navigating, because the selected Workspace may differ.
    const nextProfile = task.workspace_id === workspace.activeWorkspaceId
      ? profile : await workspace.changeWorkspace(task.workspace_id)
    if (!nextProfile) throw new Error('No se pudo cambiar al Workspace de esta tarea.')
    const destination = nextProfile.projects.find(item => item.id === task.project_id)
    if (!destination || !destination.boards.some(item => item.id === task.board_id)) {
      throw new Error('Ya no tienes acceso a este proyecto o tablero.')
    }
    board.setSelected(null)
    onAppContext('workspace')
    setGanttFocus(current => ({
      boardId: task.board_id,
      cardId: task.id,
      openCard: true,
      requestId: (current?.requestId ?? 0) + 1,
    }))
    tabs.selectBoard(destination, task.board_id)
  }
  async function openMyMeeting(meeting: MyMeeting) {
    const nextProfile = meeting.workspace_id === workspace.activeWorkspaceId
      ? profile : await workspace.changeWorkspace(meeting.workspace_id)
    if (!nextProfile) throw new Error('No se pudo acceder al Workspace de esta reunión.')
    const destination = nextProfile.projects.find(item => item.id === meeting.project_id)
    if (!destination) throw new Error('Ya no tienes acceso al proyecto de esta reunión.')
    board.setSelected(null)
    onAppContext('workspace')
    tabs.open(destination)
    tabs.selectContext('project')
    setProjectView('calendar')
  }
  function openProject(project: Project) { board.setSelected(null); onAppContext('workspace'); tabs.open(project) }
  function selectProject(id: number) { board.setSelected(null); tabs.select(id) }
  function showWorkspace() { board.setSelected(null); onAppContext('workspace'); tabs.showWorkspace() }
  function removeProject(id: number, projects: Project[]) { board.setSelected(null); tabs.removeProject(id, projects) }
  async function removeBoard(id: number) { await workspace.refreshProfile(); if (context === id) { board.setSelected(null); tabs.selectContext('project') } }
  useEffect(() => { const select = (event: Event) => { const id = (event as CustomEvent<number>).detail; onAppContext('workspace'); tabs.selectContext(id) }; window.addEventListener('tickard:select-board', select); return () => window.removeEventListener('tickard:select-board', select) }, [tabs, onAppContext])
  const projectName = activeProject?.name; const boardName = typeof context === 'number' ? activeProject?.boards.find((item) => item.id === context)?.name : undefined; const currentBreadcrumb = appContext !== 'workspace' ? [appContext === 'home' ? 'Inicio' : appContext === 'inbox' ? 'Bandeja de entrada' : 'Mis tareas'] : [profile.workspaces.find((item) => item.id === workspace.activeWorkspaceId)?.name ?? 'Workspace', ...(projectName ? ['Proyectos', projectName] : []), ...(boardName ? [boardName] : [])]; useEffect(() => { onBreadcrumb(currentBreadcrumb) }, [currentBreadcrumb.join('|')])
  return <div className="body"><Sidebar mini={sidebar.mini}><nav className="global-nav"><div className="global-nav-row"><button className={`nav-item sub${appContext === 'home' ? ' on' : ''}`} type="button" title={sidebar.mini ? 'Desplegar menú' : 'Inicio'} aria-label={sidebar.mini ? 'Desplegar menú' : 'Inicio'} onClick={() => sidebar.mini ? sidebar.toggle() : onAppContext('home')}><NavIcon><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /></NavIcon><span className="side-label-text">Inicio</span></button>{!sidebar.mini && (<button className="sidebar-toggle" type="button" title="Plegar menú" aria-label="Plegar menú" onClick={sidebar.toggle}><NavIcon><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /><path d="m16 15-3-3 3-3" /></NavIcon></button>)}</div><button className={`nav-item sub${appContext === 'inbox' ? ' on' : ''}`} type="button" onClick={() => onAppContext('inbox')}><NavIcon><rect width="18" height="14" x="3" y="5" rx="2" /><path d="m3 7 9 6 9-6" /></NavIcon><span className="side-label-text">Bandeja de entrada</span></button><button className={`nav-item sub${appContext === 'my-tasks' ? ' on' : ''}`} type="button" onClick={() => onAppContext('my-tasks')}><NavIcon><path d="m5 12 4 4L19 6" /><rect width="18" height="18" x="3" y="3" rx="2" /></NavIcon><span className="side-label-text">Mis tareas</span></button></nav><WorkspaceSelector profile={profile} activeWorkspaceId={workspace.activeWorkspaceId} mini={sidebar.mini} activeContext={!activeProject && appContext === 'workspace'} onOpenOverview={showWorkspace} onWorkspaceChange={async (id) => { onAppContext('workspace'); tabs.showWorkspace(); await workspace.changeWorkspace(id) }} onProfileRefresh={workspace.refreshProfile} /><nav className="nav">{profile.user.is_admin && <PersonalSection workspaceId={workspace.activeWorkspaceId} closeRequest={filters.myTasksRequest} onDataChanged={board.refresh} />}<ProjectsSection profile={profile} workspaceId={workspace.activeWorkspaceId} mini={sidebar.mini} onOpenProject={openProject} onProjectsChanged={workspace.refreshProfile} /></nav><AccountFooter profile={profile} mini={sidebar.mini} /></Sidebar><MainContent tabs={tabs.tabs} activeProjectId={tabs.activeProjectId} onSelectTab={selectProject} onCloseTab={(id) => tabs.close(id)} showProjectTabs={appContext === 'workspace' && activeProject !== undefined && activeProject !== null} contextBar={activeProject && appContext === 'workspace' && typeof context === 'number' && <ProjectContextBar project={activeProject} context={context} canManage={canManage} projectView={projectView} onProjectView={setProjectView} onContext={tabs.selectContext} onRefresh={workspace.refreshProfile} />}>{appContext === 'home' && <GlobalHome profile={profile} />}{appContext === 'inbox' && <InboxSurface onAccepted={async (workspaceId) => {
      if (workspaceId === workspace.activeWorkspaceId) await workspace.refreshProfile()
      else await workspace.changeWorkspace(workspaceId)
    }} />}{appContext === 'my-tasks' && <MyTasksSurface onOpenTask={openMyTask} onOpenMeeting={openMyMeeting} />}{appContext === 'workspace' && !activeProject && <WorkspaceOverview profile={profile} workspaceId={workspace.activeWorkspaceId} />}{appContext === 'workspace' && activeProject && <ProjectSurface project={activeProject} board={board.board} projectView={projectView} onProjectViewChange={setProjectView} onRefresh={workspace.refreshProfile} onDeleted={removeProject} context={context} boardState={board} filters={filters} profile={profile} query={query} onBoardDeleted={removeBoard} onNavigateExternalCard={openRelatedGanttCard} ganttFocus={ganttFocus} onContextChange={tabs.selectContext} />}</MainContent></div>
}
