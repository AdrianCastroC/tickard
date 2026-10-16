import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api'
import { Avatar, formatDateLong } from '../../shared/ui'
import { EditIcon, FilterFunnelIcon, FloppyIcon, PlusIcon, TrashIcon } from '../../shared/icons'
import styles from './DepartmentsDashboard.module.css'
import teamCss from './TeamsDashboard.module.css'

type Person = { id: number; name: string; avatar_url: string | null }
type Linked = { id: number; name: string }
type IconName = 'users' | 'code' | 'layers' | 'palette' | 'megaphone' | 'settings' | 'chart' | 'box'
type Team = {
  id: number; name: string; description: string | null; status: 'active' | 'inactive'; icon: IconName
  created_at: string | null; updated_at: string | null; members: Person[]
  departments: Linked[]; projects: Linked[]; projects_count: number; cards_count: number
}
type Data = { can_manage: boolean; teams: Team[]; people: Person[]; departments: Linked[]; projects: Linked[] }
type Tab = 'summary' | 'members' | 'projects' | 'settings'
type Sort = 'name' | 'members' | 'projects' | 'recent'
type Mark = IconName | 'folder' | 'search' | 'grid' | 'list' | 'more'
const icons: IconName[] = ['users', 'code', 'layers', 'palette', 'megaphone', 'settings', 'chart', 'box']
const iconNames: Record<IconName, string> = {
  users: 'Personas', code: 'Desarrollo', layers: 'Capas', palette: 'Diseño',
  megaphone: 'Marketing', settings: 'Operaciones', chart: 'Comercial', box: 'General',
}
const tones = ['mint', 'blue', 'purple', 'orange', 'rose', 'teal'] as const
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })
const tabs: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Resumen' }, { id: 'members', label: 'Miembros' },
  { id: 'projects', label: 'Proyectos' }, { id: 'settings', label: 'Ajustes' },
]
const skeleton = Array.from({ length: 6 }, (_, i) => i)

function Glyph({ name, size = 18 }: { name: Mark; size?: number }) {
  const paths: Record<Mark, ReactNode> = {
    users: <><circle cx="9" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2H2ZM16 5a3 3 0 0 1 0 6M16 15a5 5 0 0 1 6 5"/></>,
    code: <><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></>,
    layers: <><path d="m12 2-9 5 9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 2-2c0-1-1-1.6-1-2.4 0-1 1-1.6 2-1.6h2a4 4 0 0 0 4-4 9 9 0 0 0-10-8Z"/><path d="M7 10h.01M11 7h.01M16 8h.01M7 15h.01"/></>,
    megaphone: <><path d="M3 10v4a1 1 0 0 0 1 1h3l3 5h3l-3-5 10 4V5L10 9H4a1 1 0 0 0-1 1Z"/><path d="M21 9a4 4 0 0 1 0 6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m10 2-.5 3-2 1-2.6-1.6-2 3.5 2.3 2v2l-2.3 2 2 3.5L7.5 16l2 1 .5 3h4l.5-3 2-1 2.6 1.6 2-3.5-2.3-2v-2l2.3-2-2-3.5L16.5 6l-2-1-.5-3Z"/></>,
    chart: <><path d="M4 20V12h4v8M10 20V8h4v12M16 20V3h4v17M3 20h18"/></>,
    box: <><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="m3 7 9 5 9-5M12 12v10"/></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    list: <><path d="M9 5h12M9 12h12M9 19h12"/><path d="M4 5h.01M4 12h.01M4 19h.01"/></>,
    more: <><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function Avatars({ people, max = 4 }: { people: Person[]; max?: number }) {
  if (!people.length) return <span className={styles.muted}>Sin miembros</span>
  return <div className={styles.avatars} aria-label={people.map(person => person.name).join(', ')}>
    {people.slice(0, max).map(person => <Avatar key={person.id} id={person.id} name={person.name}
      src={person.avatar_url} size={29} className={styles.avatar}/>)}
    {people.length > max && <span className={styles.avatarMore}>+{people.length - max}</span>}
  </div>
}

function Stat({ icon, tone, value, title, detail }: {
  icon: Mark; tone: string; value: number; title: string; detail: string
}) {
  return <div className={styles.stat}>
    <span className={styles.statIcon} data-tone={tone}><Glyph name={icon} size={22}/></span>
    <div><strong>{value}</strong><span>{title}</span><small>{detail}</small></div>
  </div>
}

export function TeamsSurface({ workspaceId }: { workspaceId: number | null }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [sort, setSort] = useState<Sort>('name')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterContainerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [menuId, setMenuId] = useState<number | null>(null)
  const [editor, setEditor] = useState<'create' | 'edit' | null>(null)
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<number[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [icon, setIcon] = useState<IconName>('users')
  const [memberIds, setMemberIds] = useState<number[]>([])
  const [departmentIds, setDepartmentIds] = useState<number[]>([])
  const [projectIds, setProjectIds] = useState<number[]>([])

  const path = '/teams?workspace_id=' + workspaceId
  const load = useCallback(async () => {
    if (!workspaceId) return
    const response = await api<Data>(path)
    setData(response)
    setSelectedId(id => response.teams.some(team => team.id === id) ? id : response.teams[0]?.id ?? null)
    setSelectedRows(ids => ids.filter(id => response.teams.some(team => team.id === id)))
  }, [workspaceId, path])

  useEffect(() => {
    let active = true
    setData(null); setLoading(true); setLoadError(''); setSelectedId(null); setSelectedRows([])
    setEditor(null); setMenuId(null); setFiltersOpen(false)
    if (!workspaceId) { setLoading(false); return }
    void api<Data>(path).then(result => {
      if (active) { setData(result); setSelectedId(result.teams[0]?.id ?? null) }
    }).catch(cause => {
      if (active) setLoadError(cause instanceof Error ? cause.message : 'No se pudieron cargar los equipos.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [workspaceId, path])

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es')
    const rows = (data?.teams ?? []).filter(team =>
      (statusFilter === 'all' || team.status === statusFilter)
      && (departmentFilter === 'all' ||
        (departmentFilter === 'none' ? !team.departments.length :
          team.departments.some(department => String(department.id) === departmentFilter)))
      && (!query || team.name.toLocaleLowerCase('es').includes(query)
        || team.description?.toLocaleLowerCase('es').includes(query)
        || team.members.some(person => person.name.toLocaleLowerCase('es').includes(query))))
    return rows.sort((a, b) =>
      sort === 'members' ? b.members.length - a.members.length || collator.compare(a.name, b.name) :
      sort === 'projects' ? b.projects_count - a.projects_count || collator.compare(a.name, b.name) :
      sort === 'recent' ? (b.created_at ?? '').localeCompare(a.created_at ?? '') :
      collator.compare(a.name, b.name))
  }, [data, search, statusFilter, departmentFilter, sort])
  const stats = useMemo(() => {
    const all = data?.teams ?? []
    return {
      active: all.filter(team => team.status === 'active').length,
      people: new Set(all.flatMap(team => team.members.map(person => person.id))).size,
      departments: new Set(all.flatMap(team => team.departments.map(dept => dept.id))).size,
      projects: new Set(all.flatMap(team => team.projects.map(project => project.id))).size,
    }
  }, [data])
  const activeFilterCount = Number(statusFilter !== 'all') +
    Number(departmentFilter !== 'all') + Number(sort !== 'name')
  useEffect(() => {
    if (!filtersOpen) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !filterContainerRef.current?.contains(event.target)) setFiltersOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFiltersOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [filtersOpen])

  const selected = data?.teams.find(team => team.id === selectedId) ?? null
  const canManage = data?.can_manage === true
  const selectedAll = visible.length > 0 && visible.every(team => selectedRows.includes(team.id))

  function choose(team: Team) {
    setSelectedId(team.id); setEditor(null); setActiveTab('summary'); setMenuId(null)
    setError(''); setNotice('')
  }
  function beginCreate() {
    setEditor('create'); setName(''); setDescription(''); setStatus('active'); setIcon('users')
    setMemberIds([]); setDepartmentIds([]); setProjectIds([])
    setError(''); setNotice(''); setMenuId(null); setFiltersOpen(false)
  }
  function beginEdit(team: Team) {
    setSelectedId(team.id); setEditor('edit'); setName(team.name); setDescription(team.description ?? '')
    setStatus(team.status); setIcon(team.icon ?? 'users'); setMemberIds(team.members.map(person => person.id))
    setDepartmentIds(team.departments.map(dept => dept.id))
    setProjectIds(team.projects.map(project => project.id))
    setError(''); setNotice(''); setMenuId(null)
  }
  function toggle(ids: number[], change: (value: number[]) => void, id: number, checked: boolean) {
    change(checked ? [...ids, id] : ids.filter(item => item !== id))
  }
  function toggleVisible(checked: boolean) {
    const ids = new Set(visible.map(item => item.id))
    setSelectedRows(current => checked ? [...new Set([...current, ...ids])] : current.filter(id => !ids.has(id)))
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage || !workspaceId || busy || !name.trim()) return
    setBusy(true); setError(''); setNotice('')
    try {
      const payload = {
        workspace_id: workspaceId, name: name.trim(), description: description.trim() || null,
        status, icon, member_ids: memberIds, department_ids: departmentIds, project_ids: projectIds,
      }
      const created = editor === 'create' ? await api<{ id: number }>('/teams', {
        method: 'POST', body: JSON.stringify(payload),
      }) : null
      if (editor === 'edit' && selectedId) {
        await api('/teams/' + selectedId, { method: 'PATCH', body: JSON.stringify(payload) })
      }
      await load()
      setSelectedId(created?.id ?? selectedId)
      setEditor(null); setActiveTab('summary')
      setNotice(created ? 'Equipo creado.' : 'Equipo actualizado.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el equipo.')
    } finally { setBusy(false) }
  }
  async function remove() {
    if (!workspaceId || !canManage || busy || !confirmDeleteIds.length) return
    const ids = [...confirmDeleteIds]
    setBusy(true); setError(''); setNotice('')
    let removed = 0
    try {
      for (const id of ids) {
        await api('/teams/' + id, { method: 'DELETE', body: JSON.stringify({ workspace_id: workspaceId }) })
        removed++
      }
      setConfirmDeleteIds([]); setSelectedRows([]); setEditor(null)
      await load()
      setNotice(removed === 1 ? 'Equipo eliminado sin borrar sus proyectos ni miembros.' :
        removed + ' equipos eliminados sin borrar sus proyectos ni miembros.')
    } catch (cause) {
      setConfirmDeleteIds([])
      try { await load() } catch { /* Original deletion error is more informative. */ }
      setError(cause instanceof Error ? cause.message : 'No se pudieron eliminar todos los equipos.')
      if (removed > 0) setNotice(removed + ' equipos eliminados antes del error.')
    } finally { setBusy(false) }
  }

  if (!workspaceId) return <section className={styles.root}><p>Selecciona un Workspace.</p></section>
  return <section className={styles.root} aria-label="Gestión de equipos">
    <header className={styles.heading}>
      <div className={teamCss.headline}>
        <span className={teamCss.headlineIcon}><Glyph name="users" size={27}/></span>
        <span><h1>Equipos</h1><p>Organiza los equipos de tu organización y gestiona sus miembros.</p>
          {notice && <span role="status" className={styles.notice}>{notice}</span>}
          {loadError && <span role="alert" className={styles.alert}>{loadError}
            <button type="button" onClick={() => { setLoading(true); setLoadError('')
              void load().catch(cause => setLoadError(cause instanceof Error ? cause.message : 'Error de carga.'))
                .finally(() => setLoading(false)) }}>Reintentar</button></span>}
        </span>
      </div>
    </header>
    {loading ? <div className={styles.loading} role="status" aria-label="Cargando equipos">
      <div className={styles.loadingStats}>{skeleton.slice(0, 4).map(i => <span key={i}/>)}</div>
      <div className={styles.loadingGrid}>{skeleton.map(i => <span key={i}/>)}</div>
    </div> : data && <>
      <div className={styles.stats}>
        <Stat icon="users" tone="blue" value={data.teams.length} title="Equipos"
          detail={stats.active + ' activos · ' + (data.teams.length - stats.active) + ' inactivos'}/>
        <Stat icon="users" tone="mint" value={stats.people} title="Miembros" detail="asignados a equipos"/>
        <Stat icon="layers" tone="purple" value={stats.departments} title="Departamentos" detail="con equipos"/>
        <Stat icon="folder" tone="orange" value={stats.projects} title="Proyectos" detail="vinculados"/>
      </div>
      <div className={styles.workspace}>
        <div className={styles.mainColumn}>
          <div className={styles.filters}>
            <label className={styles.search}><Glyph name="search" size={17}/>
              <input type="search" placeholder="Buscar equipos o miembros…" aria-label="Buscar equipos o miembros"
                value={search} onChange={event => setSearch(event.target.value)}/></label>
            <div className={styles.filterControls} ref={filterContainerRef}>
              <button type="button"
                className={`icon-button board-filter-trigger ${styles.filterTrigger}${filtersOpen || activeFilterCount ? ' on' : ''}`}
                title="Filtros" aria-haspopup="dialog" aria-expanded={filtersOpen}
                aria-controls={filtersOpen ? 'teams-filters-popover' : undefined}
                aria-label={activeFilterCount ? `Filtros: ${activeFilterCount} activos` : 'Filtros de equipos'}
                onClick={() => setFiltersOpen(open => !open)}>
                <FilterFunnelIcon/>
                {activeFilterCount > 0 && <span className="board-filter-active-dot" aria-hidden="true"/>}
              </button>
              {filtersOpen && <div id="teams-filters-popover" role="dialog" aria-label="Filtros de equipos"
                className={styles.filterPopover}>
                <div className={styles.filterPopoverHeader}><strong>Filtros</strong>
                  {activeFilterCount > 0 && <button type="button" onClick={() => {
                    setStatusFilter('all'); setDepartmentFilter('all'); setSort('name')
                  }}>Limpiar</button>}
                </div>
                <label>Departamento
                  <select value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)}>
                    <option value="all">Todos</option><option value="none">Sin departamento</option>
                    {data.departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                  </select>
                </label>
                <label>Estado
                  <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                    <option value="all">Todos</option><option value="active">Activos</option>
                    <option value="inactive">Inactivos</option>
                  </select>
                </label>
                <label>Ordenar por
                  <select value={sort} onChange={event => setSort(event.target.value as Sort)}>
                    <option value="name">Nombre</option><option value="members">Más miembros</option>
                    <option value="projects">Más proyectos</option><option value="recent">Más recientes</option>
                  </select>
                </label>
              </div>}
            </div>
            <div className={styles.viewSwitcher} role="group" aria-label="Vista de equipos">
              <button type="button" aria-label="Vista de lista" aria-pressed={layout === 'list'}
                className={layout === 'list' ? styles.viewActive : undefined}
                onClick={() => setLayout('list')}><Glyph name="list" size={17}/></button>
              <button type="button" aria-label="Vista de tarjetas" aria-pressed={layout === 'grid'}
                className={layout === 'grid' ? styles.viewActive : undefined}
                onClick={() => setLayout('grid')}><Glyph name="grid" size={17}/></button>
            </div>
            {canManage && <button type="button" className={styles.primary} onClick={beginCreate}>
              <PlusIcon/> Nuevo equipo</button>}
          </div>
          {selectedRows.length > 0 && <div className={teamCss.selectionToolbar}>
            <strong>{selectedRows.length} seleccionados</strong>
            <button type="button" onClick={() => setSelectedRows([])}>Limpiar selección</button>
            {canManage && <button type="button" onClick={() => setConfirmDeleteIds(selectedRows)}>
              <TrashIcon/> Eliminar seleccionados</button>}
          </div>}
          <div className={teamCss.tableScroller}>
            {layout === 'list' ? <table className={teamCss.table}>
              <thead><tr>
                <th className={teamCss.checkboxCol}><input type="checkbox" aria-label="Seleccionar todos los equipos visibles"
                  checked={selectedAll} onChange={event => toggleVisible(event.target.checked)}/></th>
                <th>Nombre</th><th>Departamento</th><th>Miembros</th><th>Proyectos</th>
                <th>Estado</th><th className={teamCss.actionsCol}>Acciones</th>
              </tr></thead>
              <tbody>{visible.map((team, i) => <tr key={team.id} data-selected={selectedId === team.id && editor !== 'create'}>
                <td><input type="checkbox" aria-label={'Seleccionar ' + team.name} checked={selectedRows.includes(team.id)}
                  onChange={event => toggle(selectedRows, setSelectedRows, team.id, event.target.checked)}/></td>
                <td><button type="button" className={teamCss.teamCell} onClick={() => choose(team)}>
                  <span className={styles.cardIcon} data-tone={tones[i % tones.length]}>
                    <Glyph name={icons.includes(team.icon) ? team.icon : 'users'} size={23}/></span>
                  <span><strong>{team.name}</strong><small>{team.description || 'Sin descripción'}</small></span>
                </button></td>
                <td>{team.departments.length ? <span className={teamCss.departmentTags}>
                  {team.departments.slice(0, 2).map(dept => <span key={dept.id}>{dept.name}</span>)}
                  {team.departments.length > 2 && <small>+{team.departments.length - 2}</small>}
                </span> : <span className={styles.muted}>Sin asignar</span>}</td>
                <td><Avatars people={team.members}/></td>
                <td><button type="button" className={teamCss.projectCount} onClick={() => {
                  choose(team); setActiveTab('projects')
                }}><Glyph name="folder" size={17}/>{team.projects_count}</button></td>
                <td><span className={styles.status} data-status={team.status}>
                  <span/>{team.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td><div className={teamCss.rowActions}>
                  {canManage && <button type="button" title={'Editar ' + team.name} aria-label={'Editar ' + team.name}
                    onClick={() => beginEdit(team)}><EditIcon/></button>}
                  <div className={teamCss.menuWrapper}><button type="button" aria-label={'Opciones de ' + team.name}
                    title={'Opciones de ' + team.name} aria-expanded={menuId === team.id}
                    onClick={() => setMenuId(menuId === team.id ? null : team.id)}><Glyph name="more"/></button>
                    {menuId === team.id && <div className={teamCss.rowMenu}>
                      <button type="button" onClick={() => choose(team)}>Ver detalle</button>
                      {canManage && <button type="button" onClick={() => { choose(team); setConfirmDeleteIds([team.id]) }}>
                        <TrashIcon/> Eliminar</button>}
                    </div>}</div>
                </div></td>
              </tr>)}</tbody>
            </table> : <div className={teamCss.cards}>
              {visible.map((team, i) => <article key={team.id} className={styles.departmentCard}
                data-selected={team.id === selectedId && editor !== 'create'}>
                <div className={styles.cardTop}>
                  <button type="button" className={styles.cardSelect} onClick={() => choose(team)}>
                    <span className={styles.cardIcon} data-tone={tones[i % tones.length]}>
                      <Glyph name={icons.includes(team.icon) ? team.icon : 'users'} size={24}/></span>
                    <span className={styles.cardCopy}><strong>{team.name}</strong>
                      <span>{team.description || 'Sin descripción'}</span></span>
                  </button>
                  {canManage && <button type="button" className={teamCss.iconButton} title={'Editar ' + team.name}
                    onClick={() => beginEdit(team)}><EditIcon/></button>}
                </div>
                <div className={teamCss.cardDepartments}>
                  {team.departments.map(dept => <span key={dept.id}>{dept.name}</span>)}
                  {!team.departments.length && <span>Sin departamento</span>}
                </div>
                <button className={styles.cardMetrics} type="button" onClick={() => choose(team)}>
                  <span><Glyph name="users" size={15}/><strong>{team.members.length}</strong><small>Miembros</small></span>
                  <span><Glyph name="folder" size={15}/><strong>{team.projects_count}</strong><small>Proyectos</small></span>
                  <span><Glyph name="layers" size={15}/><strong>{team.cards_count}</strong><small>Tareas</small></span>
                </button>
                <div className={styles.cardBottom}><Avatars people={team.members}/>
                  <span className={styles.status} data-status={team.status}>
                    <span/>{team.status === 'active' ? 'Activo' : 'Inactivo'}</span></div>
              </article>)}
            </div>}
            {!visible.length && <div className={styles.empty}><Glyph name="users" size={28}/>
              <strong>{data.teams.length ? 'No hay resultados' : 'Todavía no hay equipos'}</strong>
              <p>{data.teams.length ? 'Prueba a cambiar los filtros.' : 'Crea el primer equipo para organizar a tus compañeros.'}</p>
              {canManage && !data.teams.length && <button type="button" className={styles.primary} onClick={beginCreate}>
                <PlusIcon/> Nuevo equipo</button>}
            </div>}
          </div>
          <span className={styles.results}>{visible.length} de {data.teams.length} equipos</span>
        </div>
        <aside className={styles.inspector} aria-label="Detalle del equipo">
          {editor ? <form className={styles.form} onSubmit={save}>
            <div className={styles.formHeading}><strong>{editor === 'create' ? 'Nuevo equipo' : 'Editar equipo'}</strong>
              <button type="button" className={styles.close} aria-label="Cerrar edición"
                onClick={() => { setEditor(null); setError('') }}>×</button></div>
            <div className={styles.formScroll}>
              <label className={styles.field}>Nombre
                <input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)}/></label>
              <label className={styles.field}>Descripción
                <textarea rows={3} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)}
                  placeholder="¿Cuál es la función de este equipo?"/></label>
              <div className={styles.formRow}>
                <label className={styles.field}>Estado
                  <select value={status} onChange={event => setStatus(event.target.value as 'active' | 'inactive')}>
                    <option value="active">Activo</option><option value="inactive">Inactivo</option>
                  </select></label>
                <label className={styles.field}>Icono
                  <select value={icon} onChange={event => setIcon(event.target.value as IconName)}>
                    {icons.map(kind => <option key={kind} value={kind}>{iconNames[kind]}</option>)}
                  </select></label>
              </div>
              <div className={styles.editorSection}><strong>Miembros <small>({memberIds.length})</small></strong>
                <div className={styles.checkList}>{data.people.map(person => <label key={person.id}>
                  <input type="checkbox" checked={memberIds.includes(person.id)}
                    onChange={event => toggle(memberIds, setMemberIds, person.id, event.target.checked)}/>
                  <Avatar id={person.id} name={person.name} src={person.avatar_url} size={26}/>
                  <span>{person.name}</span>
                </label>)}{!data.people.length && <small>Sin miembros internos disponibles.</small>}</div>
              </div>
              <div className={styles.editorSection}><strong>Departamentos <small>({departmentIds.length})</small></strong>
                <div className={styles.checkList}>{data.departments.map(dept => <label key={dept.id}>
                  <input type="checkbox" checked={departmentIds.includes(dept.id)}
                    onChange={event => toggle(departmentIds, setDepartmentIds, dept.id, event.target.checked)}/>
                  <Glyph name="layers"/><span>{dept.name}</span>
                </label>)}{!data.departments.length && <small>No hay departamentos en este Workspace.</small>}</div>
              </div>
              <div className={styles.editorSection}><strong>Proyectos <small>({projectIds.length})</small></strong>
                <div className={styles.checkList}>{data.projects.map(project => <label key={project.id}>
                  <input type="checkbox" checked={projectIds.includes(project.id)}
                    onChange={event => toggle(projectIds, setProjectIds, project.id, event.target.checked)}/>
                  <Glyph name="folder"/><span>{project.name}</span>
                </label>)}{!data.projects.length && <small>No hay proyectos en este Workspace.</small>}</div>
              </div>
              <p className={styles.hint}>Asociar un equipo a un proyecto no convierte automáticamente a todos sus miembros en miembros del proyecto.</p>
            </div>
            {error && <p role="alert" className={styles.formError}>{error}</p>}
            <footer className={styles.formActions}>
              <button type="button" disabled={busy} className={styles.subtle} onClick={() => setEditor(null)}>Cancelar</button>
              <button type="submit" disabled={busy || !name.trim()} className={styles.primary}>
                <FloppyIcon/>{busy ? 'Guardando…' : 'Guardar'}
              </button>
            </footer>
          </form> : selected ? <>
            <div className={styles.detailHead}>
              <span className={styles.detailIcon} data-tone={tones[Math.max(0,data.teams.indexOf(selected)) % tones.length]}>
                <Glyph name={icons.includes(selected.icon) ? selected.icon : 'users'} size={25}/></span>
              <div className={styles.detailTitle}>
                <div className={teamCss.detailName}><strong>{selected.name}</strong>
                  <span className={styles.status} data-status={selected.status}><span/>
                    {selected.status === 'active' ? 'Activo' : 'Inactivo'}</span></div>
                <p>{selected.description || 'Sin descripción'}</p>
              </div>
              <button type="button" className={styles.close} onClick={() => setSelectedId(null)}
                aria-label="Cerrar detalle" title="Cerrar detalle">×</button>
            </div>
            <nav className={styles.tabs} aria-label="Secciones del equipo">
              {tabs.map(tab => <button type="button" key={tab.id}
                className={activeTab === tab.id ? styles.activeTab : undefined}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
            </nav>
            <div className={styles.detailScroll}>
              {activeTab === 'summary' && <>
                <div className={styles.sectionTitle}><strong>Información</strong>
                  {canManage && <button type="button" className={styles.editSmall} onClick={() => beginEdit(selected)}>
                    <EditIcon/> Editar</button>}</div>
                <dl className={styles.info}>
                  <dt>Nombre</dt><dd>{selected.name}</dd>
                  <dt>Descripción</dt><dd>{selected.description || 'Sin descripción'}</dd>
                  <dt>Departamento</dt><dd>{selected.departments.length ?
                    selected.departments.map(dept => dept.name).join(', ') : 'Sin asignar'}</dd>
                  <dt>Estado</dt><dd><span className={styles.status} data-status={selected.status}>
                    <span/>{selected.status === 'active' ? 'Activo' : 'Inactivo'}</span></dd>
                  <dt>Fecha de creación</dt><dd>{formatDateLong(selected.created_at)}</dd>
                  <dt>Última actualización</dt><dd>{formatDateLong(selected.updated_at)}</dd>
                </dl>
                <div className={styles.detailGroup}>
                  <div className={styles.groupHeading}><strong>Miembros ({selected.members.length})</strong>
                    <button type="button" onClick={() => setActiveTab('members')}>Ver todos</button></div>
                  <Avatars people={selected.members} max={5}/>
                  {canManage && <button type="button" className={teamCss.manageButton} onClick={() => beginEdit(selected)}>
                    <Glyph name="users" size={17}/> Gestionar miembros</button>}
                </div>
                <div className={styles.detailGroup}>
                  <div className={styles.groupHeading}><strong>Proyectos asignados ({selected.projects.length})</strong>
                    <button type="button" onClick={() => setActiveTab('projects')}>Ver todos</button></div>
                  {selected.projects.slice(0,5).map(project => <div className={styles.detailEntry} key={project.id}>
                    <Glyph name="folder" size={17}/><span>{project.name}</span>
                  </div>)}
                  {!selected.projects.length && <small className={styles.muted}>Sin proyectos asociados.</small>}
                  {canManage && <button type="button" className={teamCss.manageButton} onClick={() => beginEdit(selected)}>
                    <Glyph name="folder" size={17}/> Gestionar proyectos</button>}
                </div>
              </>}
              {activeTab === 'members' && <div className={styles.detailGroup}>
                <div className={styles.groupHeading}><strong>Miembros ({selected.members.length})</strong>
                  {canManage && <button type="button" onClick={() => beginEdit(selected)}>Gestionar</button>}</div>
                {selected.members.map(person => <div className={styles.detailEntry} key={person.id}>
                  <Avatar id={person.id} name={person.name} src={person.avatar_url} size={28}/><span>{person.name}</span>
                </div>)}
                {!selected.members.length && <p className={styles.muted}>Sin miembros.</p>}
              </div>}
              {activeTab === 'projects' && <div className={styles.detailGroup}>
                <div className={styles.groupHeading}><strong>Proyectos ({selected.projects.length})</strong>
                  {canManage && <button type="button" onClick={() => beginEdit(selected)}>Gestionar</button>}</div>
                {selected.projects.map(project => <div className={styles.detailEntry} key={project.id}>
                  <Glyph name="folder"/><span>{project.name}</span></div>)}
                {!selected.projects.length && <p className={styles.muted}>Sin proyectos asociados.</p>}
              </div>}
              {activeTab === 'settings' && <div className={styles.detailGroup}>
                <strong>Ajustes del equipo</strong>
                <p className={styles.muted}>Configura estado, descripción, icono, departamentos, miembros y proyectos.</p>
                {canManage ? <>
                  <button type="button" className={styles.editSmall} onClick={() => beginEdit(selected)}>
                    <EditIcon/> Editar equipo</button>
                  <button type="button" className={styles.dangerLink}
                    onClick={() => setConfirmDeleteIds([selected.id])}><TrashIcon/> Eliminar equipo</button>
                </> : <span className={styles.muted}>Solo lectura.</span>}
              </div>}
            </div>
          </> : <div className={styles.placeholder}><Glyph name="users" size={30}/>
            <strong>Selecciona un equipo</strong><p>Consulta sus miembros y proyectos asociados.</p>
          </div>}
        </aside>
      </div>
    </>}
    {confirmDeleteIds.length > 0 && createPortal(
      <div className={styles.backdrop} onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) setConfirmDeleteIds([])
      }}>
        <div className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-team-title">
          <h2 id="delete-team-title">{confirmDeleteIds.length === 1 ? 'Eliminar equipo' : 'Eliminar equipos'}</h2>
          <p>¿Eliminar {confirmDeleteIds.length === 1
            ? '«' + (data?.teams.find(team => team.id === confirmDeleteIds[0])?.name ?? 'este equipo') + '»'
            : confirmDeleteIds.length + ' equipos'}? Se quitarán sus asociaciones, pero no se eliminarán personas, proyectos ni tareas.</p>
          <div><button type="button" className={styles.subtle} disabled={busy}
            onClick={() => setConfirmDeleteIds([])}>Cancelar</button>
            <button type="button" className={styles.dangerButton} disabled={busy}
              onClick={() => void remove()}>{busy ? 'Eliminando…' : 'Eliminar'}</button></div>
        </div>
      </div>, document.body)}
  </section>
}
