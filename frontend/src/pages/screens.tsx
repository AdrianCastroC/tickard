import { useEffect, useState } from 'react'
import type { Profile, Project } from '../api'
import { NavIcon } from '../shared/ui'
import { AccountHeader } from '../features/account/AccountHeader'
import { AccountFooter } from '../features/account/AccountFooter'
import { BoardSurface } from '../features/board/BoardSurface'
import { useBoard } from '../features/board/useBoard'
import { useBoardFilters } from '../features/board/useBoardFilters'
import { GlobalHome, InboxSurface, MyTasksSurface } from '../features/global/GlobalSurfaces'
import { Sidebar } from '../features/sidebar/Sidebar'
import { useSidebarState } from '../features/sidebar/useSidebarState'
import { WorkspaceSelector } from '../features/sidebar/WorkspaceSelector/WorkspaceSelector'
import { PersonalSection } from '../features/sidebar/PersonalSection/PersonalSection'
import { ProjectsSection } from '../features/sidebar/ProjectsSection/ProjectsSection'
import { MainContent } from '../features/workspace/MainContent'
import { ProjectContextBar } from '../features/workspace/ProjectContextBar'
import { ProjectSurface } from '../features/workspace/ProjectSurface'
import { useWorkspace } from '../features/workspace/useWorkspace'
import { useProjectTabs, type ProjectContext } from '../features/workspace/useProjectTabs'

type AppContext = 'home' | 'inbox' | 'my-tasks' | 'workspace'

export function Workspace() {
  const workspace = useWorkspace(); const sidebar = useSidebarState(); const [query, setQuery] = useState(''); const [appContext, setAppContext] = useState<AppContext>('home'); const [breadcrumb, setBreadcrumb] = useState(['Inicio'])
  if (!workspace.profile) return <main className="login"><p>Cargando…</p></main>
  return <div className={`frame${sidebar.mini ? ' is-side-mini' : ''}`}><AccountHeader profile={workspace.profile} workspaceId={workspace.activeWorkspaceId} onProfile={workspace.updateProfile} query={query} onQueryChange={setQuery} breadcrumb={breadcrumb} mini={sidebar.mini} /><WorkspaceContent workspace={workspace} profile={workspace.profile} sidebar={sidebar} query={query} appContext={appContext} onAppContext={setAppContext} onBreadcrumb={setBreadcrumb} /></div>
}

function WorkspaceContent({ workspace, profile, sidebar, query, appContext, onAppContext, onBreadcrumb }: { workspace: ReturnType<typeof useWorkspace>; profile: Profile; sidebar: ReturnType<typeof useSidebarState>; query: string; appContext: AppContext; onAppContext: (context: AppContext) => void; onBreadcrumb: (value: string[]) => void }) {
  const tabs = useProjectTabs(profile.projects); const activeProject = profile.projects.find((project) => project.id === tabs.activeProjectId); const context: ProjectContext = activeProject ? tabs.contexts[activeProject.id] ?? 'project' : 'project'; const activeBoardId = typeof context === 'number' ? context : null; const board = useBoard(activeBoardId ?? activeProject?.boards[0]?.id ?? null, tabs.selection); const filters = useBoardFilters(); const canManage = activeProject?.role === 'responsable'
  function openProject(project: Project) { board.setSelected(null); onAppContext('workspace'); tabs.open(project) }
  function selectProject(id: number) { board.setSelected(null); tabs.select(id) }
  function selectContext(next: ProjectContext) { board.setSelected(null); onAppContext('workspace'); tabs.selectContext(next) }
  function removeProject(id: number, projects: Project[]) { board.setSelected(null); tabs.removeProject(id, projects) }
  async function removeBoard(id: number) { await workspace.refreshProfile(); if (context === id) { board.setSelected(null); tabs.selectContext('project') } }
  useEffect(() => { const select = (event: Event) => { const id = (event as CustomEvent<number>).detail; onAppContext('workspace'); tabs.selectContext(id) }; window.addEventListener('tickard:select-board', select); return () => window.removeEventListener('tickard:select-board', select) }, [tabs, onAppContext])
  const projectName = activeProject?.name; const boardName = typeof context === 'number' ? activeProject?.boards.find((item) => item.id === context)?.name : undefined; const currentBreadcrumb = appContext !== 'workspace' ? [appContext === 'home' ? 'Inicio' : appContext === 'inbox' ? 'Bandeja de entrada' : 'Mis tareas'] : [profile.workspaces.find((item) => item.id === workspace.activeWorkspaceId)?.name ?? 'Workspace', ...(projectName ? ['Proyectos', projectName] : []), ...(boardName ? [boardName] : [])]; useEffect(() => { onBreadcrumb(currentBreadcrumb) }, [currentBreadcrumb.join('|')])
  return <div className="body"><Sidebar mini={sidebar.mini}><nav className="global-nav"><button className={`nav-item sub${appContext === 'home' ? ' on' : ''}`} type="button" onClick={() => onAppContext('home')}><NavIcon><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /></NavIcon><span className="side-label-text">Inicio</span></button><button className={`nav-item sub${appContext === 'inbox' ? ' on' : ''}`} type="button" onClick={() => onAppContext('inbox')}><NavIcon><rect width="18" height="14" x="3" y="5" rx="2" /><path d="m3 7 9 6 9-6" /></NavIcon><span className="side-label-text">Bandeja de entrada</span></button><button className={`nav-item sub${appContext === 'my-tasks' ? ' on' : ''}`} type="button" onClick={() => onAppContext('my-tasks')}><NavIcon><path d="m5 12 4 4L19 6" /><rect width="18" height="18" x="3" y="3" rx="2" /></NavIcon><span className="side-label-text">Mis tareas</span></button></nav><WorkspaceSelector profile={profile} activeWorkspaceId={workspace.activeWorkspaceId} mini={sidebar.mini} onToggleMini={sidebar.toggle} onWorkspaceChange={async (id) => { onAppContext('workspace'); await workspace.changeWorkspace(id) }} onProfileRefresh={workspace.refreshProfile} /><nav className="nav">{profile.user.is_admin && <PersonalSection workspaceId={workspace.activeWorkspaceId} closeRequest={filters.myTasksRequest} onDataChanged={board.refresh} />}<ProjectsSection profile={profile} workspaceId={workspace.activeWorkspaceId} mini={sidebar.mini} onOpenProject={openProject} onProjectsChanged={workspace.refreshProfile} /></nav><AccountFooter profile={profile} mini={sidebar.mini} /></Sidebar><MainContent tabs={tabs.tabs} activeProjectId={tabs.activeProjectId} onSelectTab={selectProject} onCloseTab={(id) => tabs.close(id)} contextBar={activeProject && appContext === 'workspace' && typeof context === 'number' && <ProjectContextBar project={activeProject} context={context} canManage={canManage} onContext={selectContext} onRefresh={workspace.refreshProfile} />}>{appContext === 'home' && <GlobalHome profile={profile} />}{appContext === 'inbox' && <InboxSurface />}{appContext === 'my-tasks' && <MyTasksSurface />}{appContext === 'workspace' && activeProject && context === 'project' && <ProjectSurface project={activeProject} board={board.board} onRefresh={workspace.refreshProfile} onDeleted={removeProject} />}{appContext === 'workspace' && activeProject && typeof context === 'number' && <BoardSurface state={board} filters={filters} activeBoardId={activeBoardId} project={activeProject} profile={profile} query={query} onBoardDeleted={removeBoard} />}{appContext === 'workspace' && !activeProject && <div className="empty-board"><p className="muted">Selecciona un proyecto para comenzar.</p></div>}</MainContent></div>
}
