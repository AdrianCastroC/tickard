import { useState } from 'react'
import type { Profile, Project } from '../api'
import { NavIcon } from '../shared/ui'
import { AccountHeader } from '../features/account/AccountHeader'
import { BoardSurface } from '../features/board/BoardSurface'
import { useBoard } from '../features/board/useBoard'
import { useBoardFilters } from '../features/board/useBoardFilters'
import { Sidebar } from '../features/sidebar/Sidebar'
import { useSidebarState } from '../features/sidebar/useSidebarState'
import { WorkspaceSelector } from '../features/sidebar/WorkspaceSelector/WorkspaceSelector'
import { PersonalSection } from '../features/sidebar/PersonalSection/PersonalSection'
import { ProjectsSection } from '../features/sidebar/ProjectsSection/ProjectsSection'
import { MainContent } from '../features/workspace/MainContent'
import { useWorkspace } from '../features/workspace/useWorkspace'
import { useBoardTabs } from '../features/workspace/useBoardTabs'

export function Workspace() {
  const workspace = useWorkspace()
  const sidebar = useSidebarState()
  const [query, setQuery] = useState('')
  if (!workspace.profile) return <main className="login"><p>Cargando…</p></main>

  return <div className={`frame${sidebar.mini ? ' is-side-mini' : ''}`}>
    <AccountHeader key={workspace.activeWorkspaceId} profile={workspace.profile}
      workspaceId={workspace.activeWorkspaceId} onProfile={workspace.updateProfile}
      query={query} onQueryChange={setQuery} />
    <WorkspaceContent key={workspace.activeWorkspaceId} workspace={workspace}
      profile={workspace.profile} sidebar={sidebar} query={query} />
  </div>
}

// A workspace change remounts its local features/tabs, not the persisted layout/search.
function WorkspaceContent({ workspace, profile, sidebar, query }: {
  workspace: ReturnType<typeof useWorkspace>
  profile: Profile
  sidebar: ReturnType<typeof useSidebarState>
  query: string
}) {
  const tabs = useBoardTabs(profile.projects)
  const board = useBoard(tabs.activeId, tabs.selection)
  const filters = useBoardFilters()
  const project = profile.projects.find((item) => item.boards.some((entry) => entry.id === tabs.activeId))

  function openBoard(project: Project, target: Project['boards'][number]) {
    filters.resetAssignment(); board.setSelected(null); tabs.open(project, target)
  }
  function selectTab(id: number) {
    filters.resetAssignment(); board.setSelected(null); tabs.select(id)
  }
  function closeTab(id: number) {
    if (tabs.activeId === id) board.setSelected(null)
    tabs.close(id)
  }
  function projectDeleted(id: number, projects: Project[]) {
    if (project?.id === id) board.setSelected(null)
    tabs.removeProject(id, projects)
  }

  return <div className="body">
    <Sidebar mini={sidebar.mini} onToggleMini={sidebar.toggle}>
      <WorkspaceSelector profile={profile} activeWorkspaceId={workspace.activeWorkspaceId}
        mini={sidebar.mini} onToggleMini={sidebar.toggle}
        onWorkspaceChange={workspace.changeWorkspace} onProfileRefresh={workspace.refreshProfile} />
      <nav className="nav">
        {board.board?.role !== 'cliente' && <button
          className={filters.assignee === String(profile.user.id) ? 'nav-item sub on' : 'nav-item sub'}
          type="button" title="Mis tareas" onClick={() => filters.showMyTasks(profile.user.id)}>
          <NavIcon><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /><path d="M14 4h7" /><path d="M14 9h7" /><path d="M14 15h7" /><path d="M14 20h7" /></NavIcon>
          <span className="side-label-text">Mis tareas</span>
        </button>}
        {profile.user.is_admin && <PersonalSection workspaceId={workspace.activeWorkspaceId}
          closeRequest={filters.myTasksRequest} onDataChanged={board.refresh} />}
        <ProjectsSection profile={profile} workspaceId={workspace.activeWorkspaceId}
          activeBoardId={tabs.activeId} activeBoard={board.board} mini={sidebar.mini}
          onOpenBoard={openBoard} onProjectsChanged={workspace.refreshProfile}
          onBoardDeleted={closeTab} onProjectDeleted={projectDeleted} onBoardChanged={board.refresh} />
      </nav>
    </Sidebar>
    <MainContent tabs={tabs.tabs} activeBoardId={tabs.activeId} onSelectTab={selectTab} onCloseTab={closeTab}>
      <BoardSurface state={board} filters={filters} activeBoardId={tabs.activeId}
        project={project} profile={profile} query={query} />
    </MainContent>
  </div>
}
