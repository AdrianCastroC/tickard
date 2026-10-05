import { type FormEvent, useEffect, useRef, useState } from 'react'
import { api, setToken, uploadFile, type BoardPayload, type Card, type Profile, type Project } from '../api'
import { NavIcon, formatDate, type OpenTab } from '../shared/ui'
import { CardDrawer } from '../features/cards/CardDetail'
import { BoardPulse, CreateCardModal, Kanban, orderedColumnCards } from '../features/board'
import { CategoriesDrawer, ClientsDrawer, ProjectDrawer, RosterDrawer } from '../features/administration'
import { Header } from '../features/header/Header'
import { AccountModal } from '../features/account/AccountModal'
import { resolveTheme } from '../features/account/theme'
import { Sidebar } from '../features/sidebar/Sidebar'
import { WorkspaceSelector } from '../features/sidebar/WorkspaceSelector/WorkspaceSelector'
import { ProjectsSection } from '../features/sidebar/ProjectsSection/ProjectsSection'
import { DeleteBoardModal } from '../features/sidebar/ProjectsSection/DeleteBoardModal'
import { DeleteProjectModal } from '../features/sidebar/ProjectsSection/DeleteProjectModal'
import { MainContent } from '../features/workspace/MainContent'
export function Workspace() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const openRef = useRef<number | null>(null)
  const [board, setBoard] = useState<BoardPayload | null>(null)
  const [selected, setSelected] = useState<{ card: Card; mode: 'view' | 'edit' } | null>(null)
  const [showProject, setShowProject] = useState(false)
  const [notes, setNotes] = useState<{ id: number; body: string }[]>([])
  const [accountModal, setAccountModal] = useState<'profile' | 'settings' | 'notifications' | null>(null)
  const [createColumn, setCreateColumn] = useState<{ id: number; name: string } | null>(null)
  const [query, setQuery] = useState('')
  const [assignee, setAssignee] = useState('')
  const [teamId, setTeamId] = useState('')
  const [personal, setPersonal] = useState<'departments' | 'teams' | 'clients' | null>(null)
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [label, setLabel] = useState('')
  const [priority, setPriority] = useState('')
  const [showCategories, setShowCategories] = useState(false)
  const [sideMini, setSideMini] = useState(() => {
    try {
      return localStorage.getItem('gestor:side-mini') === '1'
    } catch {
      return false
    }
  })
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem('tickard:active-workspace')
      return stored ? Number(stored) : null
    } catch {
      return null
    }
  })
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [boardToDelete, setBoardToDelete] = useState<{id: number; name: string} | null>(null)


  function toggleSideMini() {
    setSideMini((current) => {
      const next = !current
      try {
        localStorage.setItem('gestor:side-mini', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  async function loadProfile(workspaceId?: number | null) {
    const path = workspaceId
      ? `/me?workspace_id=${workspaceId}`
      : '/me'
  
    const data = await api<Profile>(path)
    setProfile(data)
    document.documentElement.dataset.theme = resolveTheme(data.user.theme)
    return data
  }

  async function changeWorkspace(workspaceId: number) {
    if (workspaceId === activeWorkspaceId) {
      return
    }
  
    setActiveWorkspaceId(workspaceId)
  
    try {
      localStorage.setItem('tickard:active-workspace', String(workspaceId))
    } catch {
      /* ignore */
    }
  
  
    setTabs([])
    chooseBoard(null)
    setBoard(null)
    setSelected(null)
  
    setPersonal(null)
    setAssignee('')
    setTeamId('')
    setLabel('')
    setPriority('')
  
  
    const data = await loadProfile(workspaceId)
  
    const firstProject = data.projects[0]
    const firstBoard = firstProject?.boards[0]
  
    if (firstProject && firstBoard) {
      setTabs([
        {
          boardId: firstBoard.id,
          projectId: firstProject.id,
          title: firstBoard.name,
        },
      ])
  
      chooseBoard(firstBoard.id)
      await loadBoard(firstBoard.id)
    }
  }

  function chooseBoard(id: number | null) {
    openRef.current = id
    setOpenId(id)
  }

  async function loadBoard(id: number) {
    const data = await api<BoardPayload>(`/boards/${id}`)
    if (openRef.current !== id) return data
    setBoard(data)
    setSelected((current) => {
      if (!current) return null
      const next = data.columns.flatMap((column) => column.cards).find((card) => card.id === current.card.id)
      return next ? { card: next, mode: current.mode } : null
    })
    return data
  }

  useEffect(() => {
    loadProfile(activeWorkspaceId).then((data) => {

      const availableWorkspaceIds = data.workspaces.map((workspace) => workspace.id)

      let workspaceId = activeWorkspaceId

      if (!workspaceId || !availableWorkspaceIds.includes(workspaceId)) {
        workspaceId = data.workspaces[0]?.id ?? null

        if (workspaceId) {
          localStorage.setItem('tickard:active-workspace', String(workspaceId))
        }
      }

      setActiveWorkspaceId(workspaceId)

      const first = data.projects[0]
      const boardId = first?.boards[0]?.id ?? null
      if (first && boardId) {
        setTabs([{ boardId, projectId: first.id, title: first.boards[0].name }])
        chooseBoard(boardId)
        loadBoard(boardId)
      }
    }).catch(() => {
      setToken(null)
      window.location.href = '/login'
    })
  }, [])

  useEffect(() => {
    if (!profile || profile.user.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function sync() {
      document.documentElement.dataset.theme = resolveTheme('system')
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [profile?.user.theme])


  useEffect(() => {
    if (!openId) return
    const timer = window.setInterval(() => {
      api<BoardPayload>(`/boards/${openId}`).then((data) => {
        if (openRef.current !== openId || data.board.id !== openId) return
        setBoard((current) => {
          if (current && current.board.id === openId && data.revision <= current.revision) return current
          return data
        })
      }).catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [openId])

  function openBoardTab(item: Project, boardRef: { id: number; name: string }) {
    setTabs((current) => current.some((tab) => tab.boardId === boardRef.id)
      ? current
      : [...current, { boardId: boardRef.id, projectId: item.id, title: boardRef.name }])
    chooseBoard(boardRef.id)
    setAssignee('')
    setTeamId('')
    setSelected(null)
    loadBoard(boardRef.id)
  }

  async function manageProject(item: Project) {
    const boardRef = item.boards.find((entry) => entry.id === openId) ?? item.boards[0]
    if (!boardRef) return
    if (openId !== boardRef.id) openBoardTab(item, boardRef)
    setShowProject(true)
  }

  async function manageBoardCategories(item: Project, boardRef: { id: number; name: string }) {
    if (openId !== boardRef.id) openBoardTab(item, boardRef)
    await loadBoard(boardRef.id)
    setShowCategories(true)
  }

  async function createBoard(event: FormEvent<HTMLFormElement>, item: Project) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    if (!name) return
    const created = await api<{ id: number; name: string }>(`/projects/${item.id}/boards`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    await loadProfile(activeWorkspaceId)
    openBoardTab(item, created)
  }

  async function deleteBoard(boardId: number, confirmationName: string) {
    await api(`/boards/${boardId}`, { 
      method: 'DELETE', 
      body: JSON.stringify({ confirmation_name: confirmationName })
    })

    setBoardToDelete(null)
    await loadProfile(activeWorkspaceId)
    closeTab(boardId)
  }

  function closeTab(boardId: number) {
    const next = tabs.filter((tab) => tab.boardId !== boardId)
    setTabs(next)
    if (openId !== boardId) return
    const fallback = next.at(-1)?.boardId ?? null
    chooseBoard(fallback)
    setSelected(null)
    if (fallback) loadBoard(fallback)
    else setBoard(null)
  }

  const project = profile?.projects.find((item) => item.boards.some((itemBoard) => itemBoard.id === openId))
  const view = board && board.board.id === openId ? board : null
  const canEdit = view?.role === 'responsable' || view?.role === 'editor'
  const canManage = view?.role === 'responsable'
  const clientView = view?.role === 'cliente'
  const openCard = selected && view
    ? view.columns.flatMap((column) => column.cards).find((card) => card.id === selected.card.id) ?? selected.card
    : selected?.card ?? null

  async function move(cardId: number, columnId: number, position: number) {
    setBoard((current) => {
      if (!current) return current
      const card = current.columns.flatMap((column) => column.cards).find((item) => item.id === cardId)
      if (!card) return current
      const categories = current.categories ?? []
      const columns = current.columns.map((column) => ({
        ...column,
        cards: column.cards.filter((item) => item.id !== cardId),
      }))
      const target = columns.find((column) => column.id === columnId)
      if (!target) return current
      const visual = orderedColumnCards(target, categories)
      const next = [...visual]
      next.splice(Math.min(position, next.length), 0, { ...card, column_id: columnId })
      return {
        ...current,
        columns: columns.map((column) => column.id === columnId
          ? { ...column, cards: next.map((item, index) => ({ ...item, position: index })) }
          : column),
      }
    })
    try {
      await api(`/cards/${cardId}/move`, { method: 'POST', body: JSON.stringify({ column_id: columnId, position }) })
      if (openId) await loadBoard(openId)
    } catch {
      if (openId) await loadBoard(openId)
    }
  }

  async function moveColumn(columnId: number, position: number) {
    setBoard((current) => {
      if (!current) return current
      const ordered = [...current.columns].sort((a, b) => a.position - b.position)
      const moving = ordered.find((column) => column.id === columnId)
      if (!moving) return current
      const rest = ordered.filter((column) => column.id !== columnId)
      rest.splice(Math.min(position, rest.length), 0, moving)
      return {
        ...current,
        columns: rest.map((column, index) => ({ ...column, position: index })),
      }
    })
    try {
      await api(`/columns/${columnId}/move`, { method: 'POST', body: JSON.stringify({ position }) })
      if (openId) await loadBoard(openId)
    } catch {
      if (openId) await loadBoard(openId)
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const clientName = String(form.get('client_name') || '').trim()
    if (!name || !clientName) return
    const created = await api<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({
        workspace_id: activeWorkspaceId,
        name,
        client_name: clientName,
      }),
    })
    const data = await loadProfile(activeWorkspaceId)
    const owner = data.projects.find((item) => item.id === created.id) ?? created
    const boardRef = owner.boards[0]
    if (boardRef) openBoardTab(owner, boardRef)
  }

  async function deleteProject(projectId: number, confirmationName: string) {
    await api(`/projects/${projectId}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmation_name: confirmationName })
    })
    setProjectToDelete(null)
    
    const data = await loadProfile(activeWorkspaceId)
    const remainingTabs = tabs.filter((tab) => tab.projectId !== projectId)
    setTabs(remainingTabs)
    if (project?.id === projectId) {
      const fallback = remainingTabs.at(-1)?.boardId 
        ?? data.projects.at(-1)?.boards.at(0)?.id 
        ?? null
      chooseBoard(fallback)
      setSelected(null)
      if (fallback) await loadBoard(fallback)
      else setBoard(null)
    }

  }

  if (!profile) return <main className="login"><p>CargandoÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦</p></main>

  const filtersActive = Boolean(assignee || teamId || label || priority)
  const backlog = view?.columns.find((column) => column.name === 'Backlog') ?? view?.columns[0]

  async function openNotificationsModal() {
    setAccountModal('notifications')
    const items = await api<{ id: number; body: string }[]>('/notifications')
    setNotes(items)
    if (profile && profile.unread > 0) {
      await api('/notifications/read', { method: 'POST' })
      setProfile({ ...profile, unread: 0 })
    }
  }

  async function changeAvatar(file: File) {
    const path = activeWorkspaceId
      ? `/me/avatar?workspace_id=${activeWorkspaceId}`
      : '/me/avatar'
  
    const next = await uploadFile<Profile>(path, file, 'avatar')
    setProfile(next)
  }

  return (
    <div className={`frame${sideMini ? ' is-side-mini' : ''}`}>
      <Header
        profile={profile}
        query={query}
        onQueryChange={setQuery}
        onOpenProfile={() => setAccountModal('profile')}
        onOpenSettings={() => setAccountModal('settings')}
        onOpenNotifications={() => { void openNotificationsModal() }}
        onNotesChange={setNotes}
        onAvatarChange={changeAvatar}
      />
      {accountModal && (
        <AccountModal
          section={accountModal}
          profile={profile}
          notes={notes}
          workspaceId={activeWorkspaceId}
          onSection={setAccountModal}
          onProfile={setProfile}
          onNotes={setNotes}
          onClose={() => setAccountModal(null)}
          onAvatar={changeAvatar}
        />
      )}
      <div className="body">
      <Sidebar mini={sideMini} onToggleMini={toggleSideMini}>
        <WorkspaceSelector profile={profile} activeWorkspaceId={activeWorkspaceId} mini={sideMini} onToggleMini={toggleSideMini} onWorkspaceChange={changeWorkspace} onProfileRefresh={loadProfile} />
        <nav className="nav">
          {view?.role !== 'cliente' && <button className="nav-item sub" type="button" title="Mis tareas" onClick={() => { setAssignee(String(profile.user.id)); setTeamId(''); setPersonal(null); setShowFilters(true) }}><NavIcon><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /><path d="M14 4h7" /><path d="M14 9h7" /><path d="M14 15h7" /><path d="M14 20h7" /></NavIcon><span className="side-label-text">Mis tareas</span></button>}
        <ProjectsSection profile={profile} activeBoardId={openId} mini={sideMini} onOpenBoard={openBoardTab} onManageProject={manageProject} onManageCategories={manageBoardCategories} onCreateProject={createProject} onCreateBoard={createBoard} onDeleteProject={setProjectToDelete} onDeleteBoard={setBoardToDelete} />
        </nav>
      </Sidebar>
      {projectToDelete && <DeleteProjectModal project={projectToDelete} onClose={() => setProjectToDelete(null)} onConfirm={(name) => deleteProject(projectToDelete.id, name)} />}
      {boardToDelete && <DeleteBoardModal board={boardToDelete} onClose={() => setBoardToDelete(null)} onConfirm={(name) => deleteBoard(boardToDelete.id, name)} />}
      <MainContent
        tabs={tabs}
        activeBoardId={openId}
        onSelectTab={(boardId) => { chooseBoard(boardId); setAssignee(''); setTeamId(''); setSelected(null); void loadBoard(boardId) }}
        onCloseTab={closeTab}
        showBoard={Boolean(view || openId)}
        title={view?.board.name || project?.boards.find((item) => item.id === openId)?.name}
        subtitle={view?.board.project_name || project?.name}
        canEdit={canEdit}
        backlog={backlog}
        filtersActive={filtersActive}
        filtersOpen={showFilters}
        onToggleFilters={() => setShowFilters((current) => !current)}
        onAdd={(column) => setCreateColumn(column)}
        filterProps={{ open: Boolean(view && showFilters), clientView, visibility: view?.visibility ?? {}, members: view?.members ?? [], labels: view?.labels ?? [], assignee, teamId, teams: view?.teams ?? [], label, priority, onAssignee: setAssignee, onTeam: setTeamId, onLabel: setLabel, onPriority: setPriority }}
      >
        {!view && !openId && <div className="empty-board"><div><h2>{profile.user.is_admin ? 'Inicia un proyecto' : 'Espera a que te asignen un proyecto'}</h2><p className="muted">{profile.user.is_admin ? 'Crea el primer proyecto desde el lateral y abre su tablero.' : 'Cuando un responsable te añada, el proyecto saldrá en el lateral.'}</p></div></div>}
        {openId && !view && <div className="empty-board"><p className="muted">Cargando el tablero…</p></div>}
        {view && <div className="workspace"><Kanban board={view} canEdit={canEdit} canManage={canManage} query={query} assignee={assignee} teamId={teamId} label={label} priority={priority} onOpen={(card) => setSelected({ card, mode: 'view' })} onEdit={(card) => setSelected({ card, mode: 'edit' })} onMove={move} onMoveColumn={moveColumn} onAdd={(id, name) => setCreateColumn({ id, name })} onCreatedColumn={() => void loadBoard(view.board.id)} onRefresh={() => void loadBoard(view.board.id)} onManageCategories={() => setShowCategories(true)} /><BoardPulse columns={view.columns} /></div>}
      </MainContent>
            {selected && view && openCard && (
        <CardDrawer
          card={openCard}
          mode={selected.mode}
          board={view}
          currentUser={profile.user}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onEdit={() => setSelected({ card: openCard, mode: 'edit' })}
          onView={() => setSelected({ card: openCard, mode: 'view' })}
          onChange={async () => { if (openId) await loadBoard(openId) }}
        />
      )}
      {showProject && view && <ProjectDrawer board={view} onClose={() => setShowProject(false)} onChange={async () => { if (openId) await loadBoard(openId) }} />}
      {showCategories && view && (
        <CategoriesDrawer
          board={view}
          onClose={() => setShowCategories(false)}
          onChange={async () => { if (openId) await loadBoard(openId) }}
        />
      )}
      {personal === 'departments' && <RosterDrawer title="Departamentos" hint="Un departamento es la estructura de la empresa. Agrupa personas y no asigna la tarea." path="departments" noun="departamento" workspaceId={activeWorkspaceId} onClose={() => setPersonal(null)} />}
      {personal === 'teams' && <RosterDrawer title="Equipos" hint="Un equipo es un grupo de trabajo. En una tarea se asigna a personas, a un equipo, o a los dos." path="teams" noun="equipo" workspaceId={activeWorkspaceId} onClose={() => {setPersonal(null); if (openId) {loadBoard(openId)}}}/>}
      {personal === 'clients' && <ClientsDrawer workspaceId={activeWorkspaceId} onClose={() => setPersonal(null)} />}
      {createColumn && view && (
        <CreateCardModal
          board={view}
          column={createColumn}
          onClose={() => setCreateColumn(null)}
          onCreated={async () => {
            setCreateColumn(null)
            await loadBoard(view.board.id)
          }}
        />
      )}
      </div>
    </div>
  )
}

function formatDateLong(value?: string | null) {
  if (!value) return 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function formatRelative(value?: string | null) {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff)) return ''
  const minutes = Math.max(0, Math.round(diff / 60000))
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 7) return `hace ${days} d`
  return formatDate(value)
}

void formatDateLong
void formatRelative
