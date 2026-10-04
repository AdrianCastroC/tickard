import { type FormEvent, useEffect, useRef, useState } from 'react'
import { api, setToken, uploadFile, type BoardPayload, type Card, type Profile, type Project } from '../api'
import { Avatar, BellIcon, ComputerIcon, ConfigIcon, DotsIcon, FloppyIcon, GlobeIcon, HelpCircleIcon, LogoutIcon, MoonIcon, NavIcon, PencilIcon, PlusIcon, ProfileUserIcon, SettingsIcon, SparklesIcon, SunIcon, TrashIcon, formatDate, type OpenTab } from '../shared/ui'
import { CardDrawer, CloseIcon } from '../features/cards/CardDetail'
import { BoardPulse, CreateCardModal, Filters, Kanban, orderedColumnCards } from '../features/board/Board'
import { CategoriesDrawer, ClientsDrawer, ProjectDrawer, RosterDrawer } from '../features/administration/Drawers'
export function Workspace() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const openRef = useRef<number | null>(null)
  const [board, setBoard] = useState<BoardPayload | null>(null)
  const [selected, setSelected] = useState<{ card: Card; mode: 'view' | 'edit' } | null>(null)
  const [showProject, setShowProject] = useState(false)
  const [notes, setNotes] = useState<{ id: number; body: string }[]>([])
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountModal, setAccountModal] = useState<'profile' | 'settings' | 'notifications' | null>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [createColumn, setCreateColumn] = useState<{ id: number; name: string } | null>(null)
  const [newProject, setNewProject] = useState(false)
  const [projectMenu, setProjectMenu] = useState<number | null>(null)
  const [boardMenu, setBoardMenu] = useState<number | null>(null)
  const [namingBoard, setNamingBoard] = useState(false)
  const [boardName, setBoardName] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
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
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [deleteProjectConfirmation, setDeleteProjectConfirmation] = useState('')
  void projectToDelete
  void deleteProjectConfirmation
  const [boardToDelete, setBoardToDelete] = useState<{id: number; name: string} | null>(null)
  const [deleteBoardConfirmation, setDeleteBoardConfirmation] = useState('')

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

  async function loadProfile() {
    const data = await api<Profile>('/me')
    setProfile(data)
    document.documentElement.dataset.theme = resolveTheme(data.user.theme)
    return data
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
    loadProfile().then((data) => {
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
    if (!accountOpen) return
    function close(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [accountOpen])

  useEffect(() => {
    if (projectMenu === null && boardMenu === null) return
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setProjectMenu(null)
        setBoardMenu(null)
        setNamingBoard(false)
        setBoardName('')
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [projectMenu, boardMenu])

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

  function focusProject(item: Project) {
    const boardRef = item.boards[0]
    if (!boardRef) return
    openBoardTab(item, boardRef)
  }

  async function manageProject(item: Project) {
    setProjectMenu(null)
    setBoardMenu(null)
    setNamingBoard(false)
    const boardRef = item.boards.find((entry) => entry.id === openId) ?? item.boards[0]
    if (!boardRef) return
    if (openId !== boardRef.id) openBoardTab(item, boardRef)
    setShowProject(true)
  }

  async function manageBoardCategories(item: Project, boardRef: { id: number; name: string }) {
    setProjectMenu(null)
    setBoardMenu(null)
    if (openId !== boardRef.id) openBoardTab(item, boardRef)
    await loadBoard(boardRef.id)
    setShowCategories(true)
  }

  async function createBoard(event: FormEvent, item: Project) {
    event.preventDefault()
    const name = boardName.trim()
    if (!name) return
    const created = await api<{ id: number; name: string }>(`/projects/${item.id}/boards`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    await loadProfile()
    setProjectMenu(null)
    setNamingBoard(false)
    setBoardName('')
    openBoardTab(item, created)
  }

  async function deleteBoard(boardId: number, confirmationName: string) {
    await api(`/boards/${boardId}`, { 
      method: 'DELETE', 
      body: JSON.stringify({ confirmation_name: confirmationName })
    })

    setBoardToDelete(null)
    setDeleteBoardConfirmation('')
    await loadProfile()
    setBoardMenu(null)
    setNamingBoard(false)
    setBoardName('')
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
      body: JSON.stringify({ name, client_name: clientName }),
    })
    const data = await loadProfile()
    setNewProject(false)
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
    setDeleteProjectConfirmation('')
    
    const data = await loadProfile()
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

    setProjectMenu(null)
  }
  void deleteProject

  if (!profile) return <main className="login"><p>Cargando…</p></main>

  const filtersActive = Boolean(assignee || teamId || label || priority)
  const backlog = view?.columns.find((column) => column.name === 'Backlog') ?? view?.columns[0]

  async function openAccount() {
    setAccountOpen(true)
    const items = await api<{ id: number; body: string }[]>('/notifications')
    setNotes(items)
  }

  function openAccountModal(section: 'profile' | 'settings' | 'notifications') {
    setAccountOpen(false)
    setAccountModal(section)
  }

  async function openNotificationsModal() {
    setAccountOpen(false)
    setAccountModal('notifications')
    const items = await api<{ id: number; body: string }[]>('/notifications')
    setNotes(items)
    if (profile && profile.unread > 0) {
      await api('/notifications/read', { method: 'POST' })
      setProfile({ ...profile, unread: 0 })
    }
  }

  async function changeAvatar(file: File) {
    const next = await uploadFile<Profile>('/me/avatar', file, 'avatar')
    setProfile(next)
  }

  return (
    <div className={`frame${sideMini ? ' is-side-mini' : ''}`}>
      <header className="topbar">
        <aside className="side">
          <div className="brand"><img src="/logo-removebg.png" alt="tickard" /></div>
        </aside>
        <div className="top-main">
          <div className="top-half">
            <label className="search">
              <NavIcon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></NavIcon>
              <input value={query} placeholder="Buscar tareas, proyectos..." onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          <div className="top-half profile">
            <div className="account" ref={accountRef}>
              <button
                className={`avatar-button${accountOpen ? ' on' : ''}`}
                type="button"
                aria-expanded={accountOpen}
                aria-label="Cuenta"
                onClick={() => {
                  if (accountOpen) {
                    setAccountOpen(false)
                  } else {
                    void openAccount()
                  }
                }}
              >
                <Avatar id={profile.user.id} name={profile.user.name} size={80} className="avatar" src={profile.user.avatar_url} />
                {profile.unread > 0 && <i className="badge">{profile.unread}</i>}
              </button>
              {accountOpen && (
                <div className="account-menu">
                  <div className="account-head">
                    <button
                      type="button"
                      className="account-avatar"
                      aria-label="Cambiar foto de perfil"
                      title="Cambiar foto de perfil"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Avatar id={profile.user.id} name={profile.user.name} size={52} className="avatar" src={profile.user.avatar_url} />
                      <span className="account-avatar-edit">
                        <PencilIcon className="account-avatar-pencil" />
                      </span>
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void changeAvatar(file)
                      }}
                    />
                    <div className="account-head-text">
                      <strong>{profile.user.name}</strong>
                      <span>{profile.user.email}</span>
                      {profile.user.is_admin
                        ? <em className="account-plan">Administrador</em>
                        : profile.user.client_company
                          ? <em className="account-plan">Cliente</em>
                          : <em className="account-plan">Miembro</em>}
                    </div>
                  </div>

                  <div className="account-section">
                    <button type="button" className="account-item" onClick={() => openAccountModal('profile')}>
                      <ProfileUserIcon /> Mi perfil
                    </button>
                    <button type="button" className="account-item" onClick={() => openAccountModal('settings')}>
                      <SettingsIcon /> Configuración
                    </button>
                    <button type="button" className="account-item" onClick={() => { void openNotificationsModal() }}>
                      <BellIcon /> Notificaciones
                      {profile.unread > 0 && <i className="account-badge">{profile.unread}</i>}
                    </button>
                    <button type="button" className="account-item" disabled>
                      <GlobeIcon /> Idioma
                      <span className="account-meta">Español</span>
                    </button>
                  </div>

                  <div className="account-section">
                    <button type="button" className="account-item" disabled>
                      <HelpCircleIcon /> Ayuda y soporte
                    </button>
                    <button type="button" className="account-item" disabled>
                      <SparklesIcon /> Novedades
                    </button>
                  </div>

                  <div className="account-section">
                    <button
                      type="button"
                      className="account-item danger"
                      onClick={async () => {
                        await api('/logout', { method: 'POST' })
                        setToken(null)
                        window.location.href = '/login'
                      }}
                    >
                      <LogoutIcon /> Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {accountModal && (
        <AccountModal
          section={accountModal}
          profile={profile}
          notes={notes}
          onSection={setAccountModal}
          onProfile={setProfile}
          onNotes={setNotes}
          onClose={() => setAccountModal(null)}
          onAvatar={changeAvatar}
        />
      )}
      <div className="body">
      <aside className={`side${sideMini ? ' is-mini' : ''}`}>
        <div className="side-tools">
          <button
            className="side-toggle"
            type="button"
            aria-label={sideMini ? 'Maximizar panel' : 'Minimizar panel'}
            title={sideMini ? 'Maximizar panel' : 'Minimizar panel'}
            aria-pressed={sideMini}
            onClick={toggleSideMini}
          >
            <NavIcon>
              {sideMini ? (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                  <path d="m14 9 3 3-3 3" />
                </>
              ) : (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                  <path d="m16 15-3-3 3-3" />
                </>
              )}
            </NavIcon>
          </button>
        </div>
        <nav className="nav">
          <button className="nav-item" type="button" title="Inicio" onClick={() => { setAssignee(''); setTeamId(''); setPersonal(null) }}>
            <NavIcon><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></NavIcon>
            <span className="side-label-text">Inicio</span>
          </button>
          {view?.role !== 'cliente' && (
            <button
              className={assignee === String(profile.user.id) ? 'nav-item on' : 'nav-item'}
              type="button"
              title="Mis tareas"
              onClick={() => { setAssignee(String(profile.user.id)); setTeamId(''); setPersonal(null); setShowFilters(true) }}
            >
              <NavIcon>
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
                <path d="M14 4h7" />
                <path d="M14 9h7" />
                <path d="M14 15h7" />
                <path d="M14 20h7" />
              </NavIcon>
              <span className="side-label-text">Mis tareas</span>
            </button>
          )}
          <p className="kicker kicker-icon" title="Tableros">
            <NavIcon>
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M8 7v7"/>
              <path d="M12 7v4"/>
              <path d="M16 7v9"/>
            </NavIcon>
            <span className="side-label-text">Tableros</span>
          </p>
          <button
            className={!assignee && !personal ? 'nav-item sub on' : 'nav-item sub'}
            type="button"
            title="Tablero"
            onClick={() => { setPersonal(null); setAssignee(''); setTeamId('') }}
          >
            <NavIcon>
              <path d="M5 3v14" />
              <path d="M12 3v8" />
              <path d="M19 3v18" />
            </NavIcon>
            <span className="side-label-text">Tablero</span>
          </button>
          {profile.user.is_admin && (
            <>
              <p className="kicker kicker-icon" title="Personal">
                <NavIcon>
                  <path d="M17 21v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1"/>
                  <path d="M19 10h1a2 2 0 012 2v1"/>
                  <path d="M5 10H4a2 2 0 00-2 2v1"/>
                  <circle cx="12" cy="11" r="3"/>
                  <circle cx="18" cy="4" r="2"/>
                  <circle cx="6" cy="4" r="2"/>
                </NavIcon>
                <span className="side-label-text">Personal</span>
              </p>
              <button className={personal === 'departments' ? 'nav-item sub on' : 'nav-item sub'} type="button" title="Departamentos" onClick={() => setPersonal('departments')}>
                <NavIcon>
                  <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/>
                  <path d="m7 16.5-4.74-2.85"/>
                  <path d="m7 16.5 5-3"/>
                  <path d="M7 16.5v5.17"/>
                  <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/>
                  <path d="m17 16.5-5-3"/>
                  <path d="m17 16.5 4.74-2.85"/>
                  <path d="M17 16.5v5.17"/>
                  <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/>
                  <path d="M12 8 7.26 5.15"/>
                  <path d="m12 8 4.74-2.85"/>
                  <path d="M12 13.5V8"/>
                </NavIcon>
                <span className="side-label-text">Departamentos</span>
              </button>
              <button className={personal === 'teams' ? 'nav-item sub on' : 'nav-item sub'} type="button" title="Equipos" onClick={() => setPersonal('teams')}>
                <NavIcon>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <path d="M16 3.128a4 4 0 0 1 0 7.744"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <circle cx="9" cy="7" r="4"/>
                </NavIcon>
                <span className="side-label-text">Equipos</span>
              </button>
              <button className={personal === 'clients' ? 'nav-item sub on' : 'nav-item sub'} type="button" title="Clientes" onClick={() => setPersonal('clients')}>
                <NavIcon>
                  <path d="M16.051 12.616a1 1 0 0 1 1.909.024l.737 1.452a1 1 0 0 0 .737.535l1.634.256a1 1 0 0 1 .588 1.806l-1.172 1.168a1 1 0 0 0-.282.866l.259 1.613a1 1 0 0 1-1.541 1.134l-1.465-.75a1 1 0 0 0-.912 0l-1.465.75a1 1 0 0 1-1.539-1.133l.258-1.613a1 1 0 0 0-.282-.866l-1.156-1.153a1 1 0 0 1 .572-1.822l1.633-.256a1 1 0 0 0 .737-.535z"/>
                  <path d="M8 15H7a4 4 0 0 0-4 4v2"/>
                  <circle cx="10" cy="7" r="4"/>
                </NavIcon>
                <span className="side-label-text">Clientes</span>
              </button>
            </>
          )}
        </nav>
        <p className="kicker kicker-icon" title="Proyectos">
          <NavIcon>
            <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
            <circle cx="14" cy="15" r="1" />
          </NavIcon>
          <span className="side-label-text">Proyectos</span>
        </p>
        <div className="projects">
          {profile.projects.map((item) => (
            <div key={item.id} className="project">
              <div className="project-row" ref={projectMenu === item.id ? menuRef : undefined}>
                <button
                  type="button"
                  title={item.name}
                  onClick={() => focusProject(item)}
                >
                  <NavIcon>
                    <path d="M2 6h4"/>
                    <path d="M2 10h4"/>
                    <path d="M2 14h4"/>
                    <path d="M2 18h4"/>
                    <rect width="16" height="20" x="4" y="2" rx="2"/>
                    <path d="M15 2v20"/>
                    <path d="M15 7h5"/>
                    <path d="M15 12h5"/>
                    <path d="M15 17h5"/>
                  </NavIcon>
                  <span className="side-label-text">{item.name}</span>
                </button>
                {item.role === 'responsable' && (
                  <button
                    className={projectMenu === item.id ? 'more on' : 'more'}
                    type="button"
                    aria-label={`Opciones de ${item.name}`}
                    onClick={() => {
                      setProjectMenu(projectMenu === item.id ? null : item.id)
                      setBoardMenu(null)
                      setNamingBoard(false)
                      setBoardName('')
                    }}
                  >
                    <DotsIcon />
                  </button>
                )}
                {projectMenu === item.id && (
                  <div className="project-menu">
                    {namingBoard ? (
                      <form onSubmit={(event) => createBoard(event, item)}>
                        <input value={boardName} placeholder="Nombre del tablero" onChange={(event) => setBoardName(event.target.value)} autoFocus />
                        <button className="primary" type="submit">Crear tablero</button>
                      </form>
                    ) : (
                      <>
                        <button type="button" onClick={() => setNamingBoard(true)}><PlusIcon /> Nuevo tablero</button>
                        <button type="button" onClick={() => manageProject(item)}><ConfigIcon /> Gestionar proyecto</button>
                        <button type="button" className="danger" onClick={() => {
                          setProjectToDelete(item)
                          setDeleteProjectConfirmation('')
                        }}><TrashIcon /> Eliminar</button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {item.boards.map((boardItem) => (
                <div
                  key={boardItem.id}
                  className={boardItem.id === openId ? 'board-row on' : 'board-row'}
                  ref={boardMenu === boardItem.id ? menuRef : undefined}
                >
                  <button
                    className="board-link"
                    type="button"
                    onClick={() => openBoardTab(item, boardItem)}
                  >
                    {boardItem.name}
                  </button>
                  {item.role === 'responsable' && (
                    <button
                      className={boardMenu === boardItem.id ? 'more on' : 'more'}
                      type="button"
                      aria-label={`Opciones de ${boardItem.name}`}
                      onClick={() => {
                        setBoardMenu(boardMenu === boardItem.id ? null : boardItem.id)
                        setProjectMenu(null)
                        setNamingBoard(false)
                      }}
                    >
                      <DotsIcon />
                    </button>
                  )}
                  {boardMenu === boardItem.id && (
                    <div className="project-menu">
                      <button type="button" onClick={() => manageBoardCategories(item, boardItem)}>Categorías</button>
                      <button type="button" className="danger" onClick={() => {setBoardToDelete(boardItem); setDeleteBoardConfirmation('')}}><TrashIcon /> Eliminar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {profile.projects.length === 0 && <p className="muted side-label-text">Todavía no hay proyectos.</p>}
          {profile.user.is_admin && !newProject && (
            <button className="add-project" type="button" title="Nuevo proyecto" onClick={() => setNewProject(true)}>
              <PlusIcon />
              <span className="side-label-text">Nuevo proyecto</span>
            </button>
          )}
        </div>
        {profile.user.is_admin && newProject && !sideMini && (
          <form onSubmit={createProject} className="field" noValidate>
            <input name="name" placeholder="Nombre del proyecto" />
            <input name="client_name" placeholder="Empresa cliente" />
            <div className="row">
              <button className="primary" type="submit">Crear</button>
              <button className="ghost" type="button" onClick={() => setNewProject(false)}>Cancelar</button>
            </div>
          </form>
        )}
      </aside>
      {boardToDelete && (
        <div className="modal-back" onClick={() => {
          setBoardToDelete(null)
          setDeleteBoardConfirmation('')
        }}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>Eliminar tablero</h2>
            <p>¿Estás seguro de querer eliminar el tablero {''} <strong>{boardToDelete.name}</strong>?</p>
            <p>Se eliminaran permanentemente todas las tarjetas y datos contenidos en este tablero.</p>
            <p>Escribe <strong>{boardToDelete.name}</strong> para confirmar.</p>
            <input type="text" placeholder={boardToDelete.name} value={deleteBoardConfirmation} onChange={(event) => setDeleteBoardConfirmation(event.target.value)} autoFocus />

            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => {setBoardToDelete(null); setDeleteBoardConfirmation('')}}>Cancelar</button>
              <button type="button" className="ghost danger" disabled={deleteBoardConfirmation !== boardToDelete.name} onClick={() => deleteBoard(boardToDelete.id, deleteBoardConfirmation)}><TrashIcon />Eliminar tablero</button>
            </div>
          </div>
        </div>
      )}
      <section className="main">
        {tabs.length > 0 && (
          <div className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab.boardId}
                className={tab.boardId === openId ? 'on' : ''}
                type="button"
                onClick={() => { chooseBoard(tab.boardId); setAssignee(''); setTeamId(''); setSelected(null); loadBoard(tab.boardId) }}
              >
                {tab.title}
                <span className="tab-x" onClick={(event) => { event.stopPropagation(); closeTab(tab.boardId) }} aria-label="Cerrar pestaña" role="button">
                  <CloseIcon />
                </span>
              </button>
            ))}
          </div>
        )}
        {!view && !openId && (
          <div className="empty-board">
            <div>
              <h2>{profile.user.is_admin ? 'Inicia un proyecto' : 'Espera a que te asignen un proyecto'}</h2>
              <p className="muted">
                {profile.user.is_admin
                  ? 'Crea el primer proyecto desde el lateral y abre su tablero.'
                  : 'Cuando un responsable te añada, el proyecto saldrá en el lateral.'}
              </p>
            </div>
          </div>
        )}
        {(view || openId) && (
          <div className="board-head">
            <h1>{view?.board.name || project?.boards.find((item) => item.id === openId)?.name}</h1>
            {(view?.board.project_name || project?.name) && (
              <p className="subtitle">{view?.board.project_name || project?.name}</p>
            )}
            {view && (
              <div className="views">
                <button className="primary" type="button">
                  <NavIcon>
                    <path d="M5 3v14" />
                    <path d="M12 3v8" />
                    <path d="M19 3v18" />
                  </NavIcon>
                  Tablero
                </button>
                <button type="button" disabled>
                  <NavIcon>
                    <path d="M21 5H3" />
                    <path d="M15 12H3" />
                    <path d="M17 19H3" />
                  </NavIcon>
                  Lista
                </button>
                <button type="button" disabled>
                  <NavIcon>
                    <path d="M12 3v18" />
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M3 15h18" />
                  </NavIcon>
                  Tabla
                </button>
                <button type="button" disabled>
                  <NavIcon>
                    <path d="M6 5h12" />
                    <path d="M4 12h10" />
                    <path d="M12 19h8" />
                  </NavIcon>
                  Gantt
                </button>
                <div className="task-actions">
                  <button className={showFilters || filtersActive ? 'icon-button on' : 'icon-button'} type="button" aria-label="Filtros" onClick={() => setShowFilters((current) => !current)}>
                    <NavIcon><path d="M4 6h16M7 12h10M10 18h4" /></NavIcon>
                  </button>
                  {canEdit && backlog && (
                    <button className="primary" type="button" onClick={() => setCreateColumn({ id: backlog.id, name: backlog.name })}><PlusIcon /> Nueva tarea</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {openId && !view && <div className="empty-board"><p className="muted">Cargando el tablero…</p></div>}
        {view && (
          <>
            {showFilters && (
              <Filters
                clientView={clientView}
                visibility={view.visibility}
                members={view.members}
                labels={view.labels}
                assignee={assignee}
                teamId={teamId}
                teams={view.teams ?? []}
                label={label}
                priority={priority}
                onAssignee={setAssignee}
                onTeam={setTeamId}
                onLabel={setLabel}
                onPriority={setPriority}
              />
            )}
            <div className="workspace">
              <Kanban
                board={view}
                canEdit={canEdit}
                canManage={canManage}
                query={query}
                assignee={assignee}
                teamId={teamId}
                label={label}
                priority={priority}
                onOpen={(card) => setSelected({ card, mode: 'view' })}
                onEdit={(card) => setSelected({ card, mode: 'edit' })}
                onMove={move}
                onMoveColumn={moveColumn}
                onAdd={(id, name) => setCreateColumn({ id, name })}
                onCreatedColumn={() => void loadBoard(view.board.id)}
                onRefresh={() => void loadBoard(view.board.id)}
                onManageCategories={() => setShowCategories(true)}
              />
              <BoardPulse columns={view.columns} />
            </div>
          </>
        )}
      </section>
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
      {personal === 'departments' && <RosterDrawer title="Departamentos" hint="Un departamento es la estructura de la empresa. Agrupa personas y no asigna la tarea." path="departments" noun="departamento" onClose={() => setPersonal(null)} />}
      {personal === 'teams' && <RosterDrawer title="Equipos" hint="Un equipo es un grupo de trabajo. En una tarea se asigna a personas, a un equipo, o a los dos." path="teams" noun="equipo" onClose={() => { setPersonal(null); if (openId) loadBoard(openId) }} />}
      {personal === 'clients' && <ClientsDrawer onClose={() => setPersonal(null)} />}
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

type UserTheme = Profile['user']['theme']

function resolveTheme(theme: UserTheme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

async function setTheme(setProfile: (value: Profile) => void, theme: UserTheme) {
  document.documentElement.dataset.theme = resolveTheme(theme)
  const next = await api<Profile>('/me', { method: 'PATCH', body: JSON.stringify({ theme }) })
  setProfile(next)
}

function AccountModal({ section, profile, notes, onSection, onProfile, onNotes, onClose, onAvatar }: {
  section: 'profile' | 'settings' | 'notifications'
  profile: Profile
  notes: { id: number; body: string }[]
  onSection: (section: 'profile' | 'settings' | 'notifications') => void
  onProfile: (value: Profile) => void
  onNotes: (value: { id: number; body: string }[]) => void
  onClose: () => void
  onAvatar: (file: File) => Promise<void>
}) {
  void profile
  void profile
  const avatarRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile.user.name)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(profile.user.name)
  }, [profile.user.name])

  useEffect(() => {
    if (section !== 'notifications') return
    let cancelled = false
    void (async () => {
      const items = await api<{ id: number; body: string }[]>('/notifications')
      if (cancelled) return
      onNotes(items)
      if (profile.unread > 0) {
        await api('/notifications/read', { method: 'POST' })
        if (!cancelled) onProfile({ ...profile, unread: 0 })
      }
    })()
    return () => { cancelled = true }
  }, [section])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    setError('')
    setInfo('')
    const nextName = name.trim()
    if (!nextName) {
      setError('El nombre no puede estar vacío.')
      return
    }
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setError('Indica tu contraseña actual.')
        return
      }
      if (newPassword.length < 8) {
        setError('La nueva contraseña debe tener al menos 8 caracteres.')
        return
      }
      if (newPassword !== confirmPassword) {
        setError('Las contraseñas nuevas no coinciden.')
        return
      }
    }
    setSaving(true)
    try {
      const body: Record<string, string> = { name: nextName }
      if (newPassword) {
        body.current_password = currentPassword
        body.password = newPassword
        body.password_confirmation = confirmPassword
      }
      const next = await api<Profile>('/me', { method: 'PATCH', body: JSON.stringify(body) })
      onProfile(next)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setInfo(newPassword ? 'Perfil y contraseña actualizados.' : 'Perfil actualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil.')
    } finally {
      setSaving(false)
    }
  }

  async function saveNotify(field: 'notify_in_app' | 'notify_email', value: boolean) {
    setError('')
    try {
      const next = await api<Profile>('/me', { method: 'PATCH', body: JSON.stringify({ [field]: value }) })
      onProfile(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la configuración.')
    }
  }

  const nameChanged = name.trim() !== profile.user.name
  const passwordTouched = Boolean(currentPassword || newPassword || confirmPassword)
  const hasChanges = nameChanged || passwordTouched

  const titles = {
    profile: 'Mi perfil',
    settings: 'Configuración',
    notifications: 'Notificaciones',
  } as const

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal account-modal" onClick={(event) => event.stopPropagation()}>
        <div className="account-modal-nav">
          <button type="button" className={section === 'profile' ? 'on' : undefined} onClick={() => onSection('profile')}>
            <ProfileUserIcon /> Mi perfil
          </button>
          <button type="button" className={section === 'settings' ? 'on' : undefined} onClick={() => onSection('settings')}>
            <SettingsIcon /> Configuración
          </button>
          <button type="button" className={section === 'notifications' ? 'on' : undefined} onClick={() => onSection('notifications')}>
            <BellIcon /> Notificaciones
            {profile.unread > 0 && <i className="account-badge">{profile.unread}</i>}
          </button>
        </div>
        <div className="account-modal-main">
          <div className="row account-modal-head">
            <h2>{titles[section]}</h2>
            <button className="icon-close" type="button" aria-label="Cerrar" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>

          {section === 'profile' && (
            <form className="account-modal-body" onSubmit={saveProfile}>
              <div className="account-modal-identity">
                <button
                  type="button"
                  className="account-avatar account-avatar-lg"
                  aria-label="Cambiar foto de perfil"
                  title="Cambiar foto de perfil"
                  onClick={() => avatarRef.current?.click()}
                >
                  <Avatar id={profile.user.id} name={profile.user.name} size={72} className="avatar" src={profile.user.avatar_url} />
                  <span className="account-avatar-edit">
                    <PencilIcon className="account-avatar-pencil" />
                  </span>
                </button>
                <input
                  ref={avatarRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void onAvatar(file)
                  }}
                />
                <div>
                  <strong>{profile.user.name}</strong>
                  <p className="muted">{profile.user.email}</p>
                  {profile.user.is_admin
                    ? <em className="account-plan">Administrador</em>
                    : profile.user.client_company
                      ? <em className="account-plan">Cliente</em>
                      : <em className="account-plan">Miembro</em>}
                </div>
              </div>
              <label className="field">
                Nombre
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              </label>
              <label className="field">
                Correo
                <input value={profile.user.email} disabled readOnly />
              </label>
              <p className="account-panel-kicker">Cambiar contraseña</p>
              <label className="field">
                Contraseña actual
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
              </label>
              <label className="field">
                Nueva contraseña
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
              </label>
              <label className="field">
                Repetir contraseña
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
              </label>
              {error && <p className="error">{error}</p>}
              {info && <p className="account-ok">{info}</p>}
              <button className="primary account-save" type="submit" disabled={saving || !hasChanges}>
                <FloppyIcon />
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          )}

          {section === 'settings' && (
            <div className="account-modal-body">
              <p className="account-panel-kicker">Tema</p>
              <div className="account-theme-switch" role="group" aria-label="Tema">
                <button
                  type="button"
                  className={profile.user.theme === 'system' ? 'on' : undefined}
                  aria-label="Ordenador"
                  title="Ordenador"
                  aria-pressed={profile.user.theme === 'system'}
                  onClick={() => { void setTheme(onProfile, 'system') }}
                >
                  <ComputerIcon />
                </button>
                <button
                  type="button"
                  className={profile.user.theme === 'light' ? 'on' : undefined}
                  aria-label="Claro"
                  title="Claro"
                  aria-pressed={profile.user.theme === 'light'}
                  onClick={() => { void setTheme(onProfile, 'light') }}
                >
                  <SunIcon />
                </button>
                <button
                  type="button"
                  className={profile.user.theme === 'dark' ? 'on' : undefined}
                  aria-label="Oscuro"
                  title="Oscuro"
                  aria-pressed={profile.user.theme === 'dark'}
                  onClick={() => { void setTheme(onProfile, 'dark') }}
                >
                  <MoonIcon />
                </button>
              </div>
              <p className="account-panel-kicker">Avisos</p>
              <label className="account-toggle">
                <span>
                  <strong>Avisos en la app</strong>
                  <small>Asignaciones y comentarios dentro de tickard</small>
                </span>
                <input
                  type="checkbox"
                  checked={profile.user.notify_in_app}
                  onChange={(event) => { void saveNotify('notify_in_app', event.target.checked) }}
                />
              </label>
              <label className="account-toggle">
                <span>
                  <strong>Avisos por correo</strong>
                  <small>Asignaciones y comentarios de cliente</small>
                </span>
                <input
                  type="checkbox"
                  checked={profile.user.notify_email}
                  onChange={(event) => { void saveNotify('notify_email', event.target.checked) }}
                />
              </label>
              {error && <p className="error">{error}</p>}
            </div>
          )}

          {section === 'notifications' && (
            <div className="account-modal-body">
              <ul className="account-notes account-notes-modal">
                {notes.length === 0 && <li className="muted">No hay avisos.</li>}
                {notes.map((note) => <li key={note.id}>{note.body}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDateLong(value?: string | null) {
  if (!value) return '—'
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

