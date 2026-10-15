import { cachedProjectRequest } from '../../shared/projectRequestCache'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { api, type Profile, type Project, type Role } from '../../api'
import { WorkspaceInvitations } from './WorkspaceInvitations'
import { Avatar } from '../../shared/ui'
import { FilterFunnelIcon } from '../../shared/icons'
import styles from './ProjectPersonnel.module.css'
import { ProjectSectionLoading } from './ProjectSectionLoading'

type StateKey = 'backlog' | 'pending' | 'in_progress' | 'review' | 'done'
type Stats = Record<StateKey | 'total' | 'overdue', number>
type Group = { id: number; name: string }
type Assignment = {
  id: number
  title: string
  board_id: number
  board_name: string
  due_date: string | null
  workflow_state: StateKey
  column_id: number
  column_name: string
  is_milestone: boolean
  overdue: boolean
  updated_at: string | null
}
type Member = {
  id: number; name: string; email: string | null; avatar_url: string | null; role: Role; is_workspace_owner: boolean
  teams: Group[]; departments: Group[]; stats: Stats; column_counts: Record<number, number>; tasks: Assignment[]
}
type PersonnelColumn = {
  id: number; name: string; color: string | null; workflow_state: StateKey
  position: number; board_id: number; board_name: string
}
type ColumnGroup = {
  key: string; name: string; workflow_state: StateKey; color: string | null
  columnIds: number[]; boardNames: string[]
}
type PersonnelData = {
  columns: PersonnelColumn[]
  members: Member[]
  summary: Stats & { assigned: number; members: number }
  can_manage: boolean
  teams: (Group & { linked: boolean; members: Group[] })[]
  departments: Group[]
  available_people: (Group & { email: string })[]
}
type ManagementTab = 'teams' | 'people' | 'invite'
type DetailTab = 'summary' | 'tasks' | 'activity'
type SortKey = 'name' | 'role' | 'department' | 'team' | 'tasks' | 'progress' | 'load'
type SortDirection = 'asc' | 'desc'
type SortState = { key: SortKey; direction: SortDirection }
const SORT_COLUMNS: { key: SortKey; label: string; sortName: string }[] = [
  { key: 'name', label: 'Miembro', sortName: 'nombre' },
  { key: 'role', label: 'Rol', sortName: 'rol' },
  { key: 'department', label: 'Departamento', sortName: 'departamento' },
  { key: 'team', label: 'Equipo', sortName: 'equipo' },
  { key: 'tasks', label: 'Tareas por columna', sortName: 'número de tareas' },
  { key: 'progress', label: 'Progreso', sortName: 'progreso' },
  { key: 'load', label: 'Carga relativa', sortName: 'carga' },
]
const memberCollator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })
const DIVIDER_HEIGHT = 12
const MIN_TABLE_HEIGHT = 160
const MIN_CHART_HEIGHT = 96
const STATE_CLASSES: Record<StateKey, string> = {
  backlog: styles.stateBacklog, pending: styles.statePending, in_progress: styles.stateProgress,
  review: styles.stateReview, done: styles.stateDone,
}
const ROLES: { key: Role; name: string }[] = [
  { key: 'responsable', name: 'Responsable' },
  { key: 'editor', name: 'Editor' },
  { key: 'lector', name: 'Lector' },
  { key: 'cliente', name: 'Cliente' },
]
const MANAGE_ROLES = ROLES.filter(({ key }) => key !== 'cliente')
function roleName(role: Role) { return ROLES.find((item) => item.key === role)?.name ?? role }
function dateLabel(value: string | null) {
  return value ? new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'
}
function pct(done: number, total: number) { return total > 0 ? Math.round((done / total) * 100) : 0 }
function initials(items: Group[]) { return items.length ? items.map((item) => item.name).join(', ') : '—' }

function MiniIcon({ name }: { name: 'users' | 'tasks' | 'progress' | 'review' | 'done' | 'overdue' | 'search' | 'close' }) {
  const drawings = {
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2c0-3 3-5 6-5s6 2 6 5v2M17 5c3 1 4 5 1 7m1 2c2 1 3 3 3 6" /></>,
    tasks: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m7 8 1.5 1.5L11 7M13 8h5m-11 6 1.5 1.5L11 13m2 2h5" /></>,
    progress: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4z" /></>,
    review: <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></>,
    done: <><circle cx="12" cy="12" r="9" /><path d="m7.5 12 3 3 6-6" /></>,
    overdue: <><path d="M12 3 2 21h20L12 3zM12 9v5m0 3v.2" /></>,
    search: <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>,
    close: <path d="M5 5 19 19M19 5 5 19" />,
  }
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawings[name]}</svg>
}

// Font Awesome Free v7.3.1, Copyright 2026 Fonticons, Inc. — Free License.
// Use the original path provided for the project management action.
function ManageMembersIcon() {
  return <svg viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
    <path d="M256.5 72C322.8 72 376.5 125.7 376.5 192C376.5 258.3 322.8 312 256.5 312C190.2 312 136.5 258.3 136.5 192C136.5 125.7 190.2 72 256.5 72zM226.7 368L286.1 368L287.6 368C274.7 394.8 279.8 426.2 299.1 447.5C278.9 469.8 274.3 503.3 289.7 530.9L312.2 571.3C313.1 572.9 314.1 574.5 315.1 576L78.1 576C61.7 576 48.4 562.7 48.4 546.3C48.4 447.8 128.2 368 226.7 368zM432.6 311.6C432.6 298.3 443.3 287.6 456.6 287.6L504.6 287.6C517.9 287.6 528.6 298.3 528.6 311.6L528.6 317.7C528.6 336.6 552.7 350.5 569.1 341.1L574.1 338.2C585.7 331.5 600.6 335.6 607.1 347.3L629.5 387.5C635.7 398.7 632.1 412.7 621.3 419.5L616.6 422.4C600.4 432.5 600.4 462.3 616.6 472.5L621.2 475.4C632 482.2 635.7 496.2 629.5 507.4L607 547.8C600.5 559.5 585.6 563.7 574 556.9L569.1 554C552.7 544.5 528.6 558.5 528.6 577.4L528.6 583.5C528.6 596.8 517.9 607.5 504.6 607.5L456.6 607.5C443.3 607.5 432.6 596.8 432.6 583.5L432.6 577.6C432.6 558.6 408.4 544.6 391.9 554.1L387.1 556.9C375.5 563.6 360.7 559.5 354.1 547.8L331.5 507.4C325.3 496.2 328.9 482.1 339.8 475.3L344.2 472.6C360.5 462.5 360.5 432.5 344.2 422.4L339.7 419.6C328.8 412.8 325.2 398.7 331.4 387.5L353.9 347.2C360.4 335.5 375.3 331.4 386.8 338.1L391.6 340.9C408.1 350.4 432.3 336.4 432.3 317.4L432.3 311.5zM532.5 447.8C532.5 419.1 509.2 395.8 480.5 395.8C451.8 395.8 428.5 419.1 428.5 447.8C428.5 476.5 451.8 499.8 480.5 499.8C509.2 499.8 532.5 476.5 532.5 447.8z" />
  </svg>
}

// Font Awesome Free v7.3.1 — sorting chevrons supplied for Tickard.
// Split the original combined path so the active direction can be highlighted.
function SortIcon({ direction }: { direction: SortDirection | null }) {
  return <svg className={`${styles.sortIcon} ${direction === 'asc' ? styles.sortAscending : direction === 'desc' ? styles.sortDescending : ''}`}
    viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
    <path d="M130.4 268.2C135.4 280.2 147 288 160 288L480 288C492.9 288 504.6 280.2 509.6 268.2C514.6 256.2 511.8 242.5 502.7 233.3L342.7 73.3C330.2 60.8 309.9 60.8 297.4 73.3L137.4 233.3C128.2 242.5 125.5 256.2 130.5 268.2z" />
    <path d="M130.4 371.7C125.4 383.7 128.2 397.4 137.3 406.6L297.3 566.6C309.8 579.1 330.1 579.1 342.6 566.6L502.6 406.6C511.8 397.4 514.5 383.7 509.5 371.7C504.5 359.7 492.9 352 480 352L160 352C147.1 352 135.4 359.8 130.4 371.8z" />
  </svg>
}

// Project columns are grouped only when their name, workflow state and color
// are identical. This avoids duplicate legends across similarly configured boards.
function groupProjectColumns(columns: PersonnelColumn[]): ColumnGroup[] {
  const groups = new Map<string, ColumnGroup>()
  for (const column of columns) {
    const key = JSON.stringify([column.workflow_state, column.name.trim().toLocaleLowerCase('es'), column.color?.toLowerCase() ?? null])
    const group = groups.get(key)
    if (group) {
      group.columnIds.push(column.id)
      if (!group.boardNames.includes(column.board_name)) group.boardNames.push(column.board_name)
    } else {
      groups.set(key, {
        key, name: column.name, workflow_state: column.workflow_state, color: column.color,
        columnIds: [column.id], boardNames: [column.board_name],
      })
    }
  }
  return [...groups.values()]
}

function StatusBar({ member, groups, compact = false }: { member: Member; groups: ColumnGroup[]; compact?: boolean }) {
  return <div className={`${styles.statusBar} ${compact ? styles.compactBar : ''}`}>
    {groups.map((group) => {
      const count = group.columnIds.reduce((total, id) => total + (member.column_counts[id] ?? 0), 0)
      return count > 0 && <span key={group.key} className={STATE_CLASSES[group.workflow_state]}
        title={`${group.name} · ${count} tareas (${group.boardNames.join(', ')})`}
        style={{ flex: count, backgroundColor: group.color ?? undefined }} />
    })}
    {!member.stats.total && <span className={styles.emptyBar} />}
  </div>
}

function SummaryCard({ icon, title, amount, detail }: { icon: 'users' | 'tasks' | 'progress' | 'review' | 'done' | 'overdue'; title: string; amount: number; detail: string }) {
  return <div className={styles.summaryCard} title={`${title}: ${amount} · ${detail}`}>
    <span className={`${styles.summaryIcon} ${styles['summary_' + icon]}`}><MiniIcon name={icon} /></span>
    <div><small>{title}</small><strong>{amount}</strong></div>
  </div>
}

export function ProjectPersonnel({ project, profile }: { project: Project; profile: Profile }) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [data, setData] = useState<PersonnelData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<Role | 'all'>('all')
  const [teamId, setTeamId] = useState<number | 'all'>('all')
  const [departmentId, setDepartmentId] = useState<number | 'all'>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('summary')
  const [sort, setSort] = useState<SortState | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const viewportRef = useRef<HTMLElement>(null)
  const primaryColumnRef = useRef<HTMLDivElement>(null)
  const chartPanelRef = useRef<HTMLDivElement>(null)
  const splitStorageKey = `tickard:personnel:chart-ratio:${project.id}`
  const [chartRatio, setChartRatio] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(splitStorageKey))
      return Number.isFinite(stored) && stored >= 0.12 && stored <= 0.75 ? stored : 0.24
    } catch {
      return 0.24
    }
  })
  const chartRatioRef = useRef(chartRatio)
  const splitDragRef = useRef<{ id: number; startY: number; startHeight: number } | null>(null)

  function setChartHeight(requested: number) {
    const parentHeight = primaryColumnRef.current?.getBoundingClientRect().height ?? 0
    if (!parentHeight) return
    const maxHeight = Math.max(MIN_CHART_HEIGHT, parentHeight - DIVIDER_HEIGHT - MIN_TABLE_HEIGHT)
    const height = Math.max(MIN_CHART_HEIGHT, Math.min(maxHeight, requested))
    const next = height / parentHeight
    chartRatioRef.current = next
    setChartRatio(next)
  }

  function persistChartHeight() {
    try { localStorage.setItem(splitStorageKey, String(chartRatioRef.current)) }
    catch { /* Optional preference: continue working without browser storage. */ }
  }

  function onSplitPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const chart = chartPanelRef.current
    if (!chart) return
    splitDragRef.current = { id: event.pointerId, startY: event.clientY, startHeight: chart.getBoundingClientRect().height }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function onSplitPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = splitDragRef.current
    if (!drag || drag.id !== event.pointerId) return
    // Moving the separator up expands the chart below, and vice versa.
    setChartHeight(drag.startHeight + drag.startY - event.clientY)
  }

  function finishSplitDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (splitDragRef.current?.id !== event.pointerId) return
    splitDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    persistChartHeight()
  }

  function onSplitKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const currentHeight = chartPanelRef.current?.getBoundingClientRect().height ?? 0
    setChartHeight(currentHeight + (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 48 : 24))
    persistChartHeight()
  }

  const refresh = useCallback(async () => {
    const payload = await api<PersonnelData>(`/projects/${project.id}/personnel`)
    setData(payload)
    setSelectedId((old) => old !== null && payload.members.some((item) => item.id === old) ? old : payload.members[0]?.id ?? null)
    setError(null)
  }, [project.id])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setData(null)
    setError(null)
    setSelectedId(null)
    const path = `/projects/${project.id}/personnel`
    void cachedProjectRequest(path, (signal) => api<PersonnelData>(path, { signal }), controller.signal).then((payload) => {
      if (!active) return
      setData(payload)
      setSelectedId(payload.members[0]?.id ?? null)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar Personal.')
    })
    return () => { active = false; controller.abort() }
  }, [project.id, reload])

  useEffect(() => {
    if (!data || !viewportRef.current) return
    const el = viewportRef.current
    const resize = () => { el.style.height = `${Math.max(360, Math.floor(window.innerHeight - el.getBoundingClientRect().top - 20))}px` }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [data])

  useEffect(() => {
    if (!filtersOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !filtersRef.current?.contains(event.target)) setFiltersOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFiltersOpen(false)
        filterButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [filtersOpen])

  const activeFilterCount = Number(role !== 'all') + Number(teamId !== 'all') + Number(departmentId !== 'all')
  const columnGroups = useMemo(() => groupProjectColumns(data?.columns ?? []), [data])
  const fullLabelsForState = (state: StateKey) => {
    const names = [...new Set(columnGroups.filter((group) => group.workflow_state === state).map((group) => group.name))]
    return names.length ? names : ['Sin columna']
  }
  const labelForState = (state: StateKey) => {
    const names = fullLabelsForState(state)
    return names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0]
  }
  const members = data?.members ?? []
  const filtered = useMemo(() => members.filter((person) =>
    (role === 'all' || person.role === role)
    && (teamId === 'all' || person.teams.some((team) => team.id === teamId))
    && (departmentId === 'all' || person.departments.some((item) => item.id === departmentId))
    && (!query || [person.name, person.email ?? '', ...person.teams.map((item) => item.name)]
      .some((term) => term.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))))
  ), [members, role, teamId, departmentId, query])
  const maxAssigned = Math.max(1, ...members.map((person) => person.stats.total))
  const ordered = useMemo(() => {
    if (!sort) return filtered
    const value = (member: Member): string | number => {
      switch (sort.key) {
        case 'name': return member.name
        case 'role': return member.is_workspace_owner ? 'Owner' : roleName(member.role)
        case 'department': return initials(member.departments)
        case 'team': return initials(member.teams)
        case 'tasks': return member.stats.total
        case 'progress': return pct(member.stats.done, member.stats.total)
        case 'load': return Math.round(member.stats.total / maxAssigned * 100)
      }
    }
    return [...filtered].sort((a, b) => {
      // Unassigned departments/teams remain at the end in both directions.
      if (sort.key === 'department' || sort.key === 'team') {
        const emptyA = sort.key === 'department' ? a.departments.length === 0 : a.teams.length === 0
        const emptyB = sort.key === 'department' ? b.departments.length === 0 : b.teams.length === 0
        if (emptyA !== emptyB) return emptyA ? 1 : -1
      }
      const av = value(a)
      const bv = value(b)
      const result = typeof av === 'number' && typeof bv === 'number'
        ? av - bv : memberCollator.compare(String(av), String(bv))
      if (result !== 0) return sort.direction === 'asc' ? result : -result
      return memberCollator.compare(a.name, b.name) || a.id - b.id
    })
  }, [filtered, sort, maxAssigned])

  function toggleSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current?.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))
  }
  const selected = members.find((person) => person.id === selectedId) ?? null
  const summary = data?.summary
  const client = project.role === 'cliente' && !data?.can_manage

  if (!data && !error) return <ProjectSectionLoading section="personnel" />
  if (!data) return <section className="project-panel" role="alert">
    <p>{error}</p>
    <button type="button" onClick={() => setReload((old) => old + 1)}>Reintentar</button>
  </section>

  if (inviteOpen && data.can_manage) return <section className="project-panel project-invitations-view">
    <button className="ghost" type="button" onClick={() => setInviteOpen(false)}>← Volver a Personal</button>
    <WorkspaceInvitations projectId={project.id} />
  </section>

  return <section ref={viewportRef} className={styles.root} aria-label="Personal del proyecto">
    <div className={styles.toolbar}>
      <div className={styles.summary} role="group" aria-label="Indicadores del personal">
        <SummaryCard icon="users" title="Miembros" amount={summary!.members} detail="En este proyecto" />
        <SummaryCard icon="tasks" title="Tareas asignadas" amount={summary!.assigned} detail={`${summary!.total - summary!.assigned} sin asignar`} />
        <SummaryCard icon="progress" title={labelForState("in_progress")} amount={summary!.in_progress} detail={`${fullLabelsForState('in_progress').join(', ')} · ${pct(summary!.in_progress, summary!.total)}% del total`} />
        <SummaryCard icon="review" title={labelForState("review")} amount={summary!.review} detail={`${fullLabelsForState('review').join(', ')} · ${pct(summary!.review, summary!.total)}% del total`} />
        <SummaryCard icon="done" title={labelForState("done")} amount={summary!.done} detail={`${fullLabelsForState('done').join(', ')} · ${pct(summary!.done, summary!.total)}% del total`} />
        <SummaryCard icon="overdue" title="Retrasadas" amount={summary!.overdue} detail={`${pct(summary!.overdue, summary!.total)}% del total`} />
      </div>
      <div className={styles.toolbarActions}>
        <label className={styles.search}><MiniIcon name="search" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar miembros…" aria-label="Buscar miembros" />
        </label>
        {!client && <div className={styles.filterAnchor} ref={filtersRef}>
          <button ref={filterButtonRef} type="button"
            className={`icon-button board-filter-trigger${filtersOpen || activeFilterCount ? ' on' : ''}`}
            aria-label={activeFilterCount ? `Filtros de personal: ${activeFilterCount} activos` : 'Filtros de personal'}
            title="Filtros" aria-haspopup="dialog" aria-expanded={filtersOpen}
            aria-controls={filtersOpen ? 'personnel-filters' : undefined}
            onClick={() => setFiltersOpen((open) => !open)}>
            <FilterFunnelIcon />
            {activeFilterCount > 0 && <span className="board-filter-active-dot" aria-hidden="true" />}
          </button>
          {filtersOpen && <div id="personnel-filters" className={styles.filterPopover} role="dialog" aria-label="Filtros de personal">
            <div className={styles.filterHeading}>
              <strong>Filtros</strong>
              <button type="button" onClick={() => { setRole('all'); setTeamId('all'); setDepartmentId('all') }}>Restablecer</button>
            </div>
            <label>Rol
              <select value={role} onChange={(event) => setRole(event.target.value as Role | 'all')}>
                <option value="all">Todos los roles</option>
                {ROLES.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
              </select>
            </label>
            <label>Equipo
              <select value={teamId} onChange={(event) => setTeamId(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
                <option value="all">Todos los equipos</option>
                {data.teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>Departamento
              <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
                <option value="all">Todos los departamentos</option>
                {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>}
        </div>}
        {data.can_manage && <button type="button" className={styles.manageButton}
          title="Invitar usuarios" aria-label="Invitar usuarios"
          onClick={() => setInviteOpen(true)}>
          <svg viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
            <path d="M285.7 368C384.2 368 464 447.8 464 546.3C464 562.7 450.7 576 434.3 576L77.7 576C61.3 576 48 562.7 48 546.3C48 447.8 127.8 368 226.3 368L285.7 368zM528 144C541.3 144 552 154.7 552 168L552 216L600 216C613.3 216 624 226.7 624 240C624 253.3 613.3 264 600 264L552 264L552 312C552 325.3 541.3 336 528 336C514.7 336 504 325.3 504 312L504 264L456 264C442.7 264 432 253.3 432 240C432 226.7 442.7 216 456 216L504 216L504 168C504 154.7 514.7 144 528 144zM256 312C189.7 312 136 258.3 136 192C136 125.7 189.7 72 256 72C322.3 72 376 125.7 376 192C376 258.3 322.3 312 256 312z" />
          </svg>
        </button>}
        {data.can_manage && <button type="button" className={styles.manageButton} title="Gestionar miembros"
          aria-label="Gestionar miembros" onClick={() => setManagerOpen(true)}>
          <ManageMembersIcon />
        </button>}
      </div>
    </div>

    <div className={`${styles.workspaceBody} ${selected ? styles.hasDetails : ''}`}>
      <div ref={primaryColumnRef} className={styles.primaryColumn}
        style={{ '--personnel-chart-height': `${chartRatio * 100}%` } as CSSProperties}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr>{SORT_COLUMNS.map((column) => {
              const active = sort?.key === column.key
              const direction = active ? sort.direction : null
              const alphabetic = ['name', 'role', 'department', 'team'].includes(column.key)
              const nextIsAscending = active && direction === 'desc'
              const nextOrder = alphabetic ? (nextIsAscending ? 'A a Z' : 'Z a A') : (nextIsAscending ? 'menor a mayor' : 'mayor a menor')
              return <th key={column.key} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                <button type="button" className={`${styles.sortButton} ${active ? styles.sortButtonActive : ''}`}
                  onClick={() => toggleSort(column.key)}
                  aria-label={`Ordenar por ${column.sortName} de ${nextOrder}`}
                  title={`Ordenar por ${column.sortName} de ${nextOrder}`}>
                  {column.label}<SortIcon direction={direction} />
                </button>
              </th>
            })}</tr></thead>
            <tbody>{ordered.map((person) => {
              const completion = pct(person.stats.done, person.stats.total)
              return <tr key={person.id} className={selectedId === person.id ? styles.selectedRow : ''}>
                <td><button type="button" className={styles.memberButton} onClick={() => { setSelectedId(person.id); setDetailTab('summary') }}>
                  <Avatar id={person.id} name={person.name} src={person.avatar_url} size={34}/>
                  <span><strong>{person.name}{person.id === profile.user.id ? ' (Tú)' : ''}</strong><small>{person.is_workspace_owner ? 'Propietario del Workspace' : (person.email ?? roleName(person.role))}</small></span>
                </button></td>
                <td><span className={`${styles.roleTag} ${person.role === 'responsable' ? styles.responsible : ''}`}>{person.is_workspace_owner ? 'Owner' : roleName(person.role)}</span></td>
                <td title={initials(person.departments)}>{initials(person.departments)}</td>
                <td title={initials(person.teams)}>{initials(person.teams)}</td>
                <td><div className={styles.assignedBar}><StatusBar member={person} groups={columnGroups} compact /><small>{person.stats.total} tareas</small></div></td>
                <td><div className={styles.progressCell}><span className={styles.progressTrack}><i style={{ width: `${completion}%` }} /></span><small>{completion}%</small></div></td>
                <td><div className={styles.progressCell}><span className={styles.loadTrack}><i style={{ width: `${Math.round(person.stats.total / maxAssigned * 100)}%` }} /></span><small>{person.stats.total}</small></div></td>
              </tr>
            })}</tbody>
          </table>
          {filtered.length === 0 && <div className={styles.empty}>No hay miembros que coincidan con los filtros.</div>}
        </div>
        <div className={styles.resizeDivider} role="separator" tabIndex={0}
          aria-label="Ajustar altura de la tabla y el gráfico"
          aria-orientation="horizontal" aria-valuemin={12} aria-valuemax={75}
          aria-valuenow={Math.round(chartRatio * 100)}
          aria-valuetext={`Gráfico: ${Math.round(chartRatio * 100)} % de la altura`}
          title="Arrastra para ajustar el espacio de la tabla y del gráfico. Usa las flechas para ajustar con el teclado."
          onPointerDown={onSplitPointerDown} onPointerMove={onSplitPointerMove}
          onPointerUp={finishSplitDrag} onPointerCancel={finishSplitDrag}
          onLostPointerCapture={finishSplitDrag} onKeyDown={onSplitKeyDown}>
          <span className={styles.resizeGrip} aria-hidden="true" />
        </div>
        <div ref={chartPanelRef} className={styles.chartPanel}>
          <div className={styles.chartHeading}><strong>Distribución de tareas por persona</strong><small>Por columna · cantidad de Cards asignadas</small></div>
          <div className={styles.chartScroll}><div className={styles.chartRows}>
            {ordered.map((person) => <div className={styles.chartRow} key={person.id}>
              <span title={person.name}>{person.name}</span><div className={styles.chartTrack}><div style={{ width: `${Math.round(person.stats.total / maxAssigned * 100)}%` }}><StatusBar member={person} groups={columnGroups} /></div></div><strong>{person.stats.total}</strong>
            </div>)}
            {!filtered.length && <p className={styles.empty}>No hay datos para representar.</p>}
          </div></div>
          <div className={styles.legend} aria-label="Columnas del proyecto">
            {columnGroups.map((group) => <span key={group.key} title={`Tablero(s): ${group.boardNames.join(', ')}`}>
              <i className={STATE_CLASSES[group.workflow_state]} style={{ backgroundColor: group.color ?? undefined }} />{group.name}
            </span>)}
          </div>
        </div>
      </div>
      {selected && <aside className={styles.details}>
        <div className={styles.personHeading}>
          <Avatar id={selected.id} name={selected.name} src={selected.avatar_url} size={52}/>
          <div><strong>{selected.name}</strong><span className={styles.roleTag}>{selected.is_workspace_owner ? 'Propietario del Workspace' : roleName(selected.role)}</span></div>
          <button type="button" aria-label="Cerrar detalle" className={styles.closeDetail} onClick={() => setSelectedId(null)}><MiniIcon name="close" /></button>
        </div>
        <div className={styles.detailTabs}>
          {([{key:'summary',label:'Resumen'},{key:'tasks',label:`Tareas (${selected.stats.total})`},{key:'activity',label:'Actividad'}] as const).map((tab) =>
            <button type="button" key={tab.key} className={detailTab === tab.key ? styles.currentTab : ''} onClick={() => setDetailTab(tab.key)}>{tab.label}</button>)}
        </div>
        {detailTab === 'summary' && <div className={styles.detailScroll}>
          {selected.email && <div className={styles.infoRow}><span>Correo</span><strong>{selected.email}</strong></div>}
          <div className={styles.infoRow}><span>Departamento</span><strong>{initials(selected.departments)}</strong></div>
          <div className={styles.infoRow}><span>Equipo</span><strong>{initials(selected.teams)}</strong></div>
          <div className={styles.statTiles}>
            {(['pending','in_progress','review','done'] as StateKey[]).map((key) => <div key={key} className={styles.statTile}>
              <strong>{selected.stats[key]}</strong><small title={fullLabelsForState(key).join(', ')}>{labelForState(key)}</small>
            </div>)}
          </div>
          <div className={styles.detailMetric}><div><strong>Progreso de tareas</strong><span>{pct(selected.stats.done,selected.stats.total)}%</span></div><StatusBar member={selected} groups={columnGroups}/></div>
          <div className={styles.detailMetric}><div><strong>Carga relativa del equipo</strong><span>{selected.stats.total} tareas</span></div>
            <span className={styles.loadTrack}><i style={{ width: `${Math.round(selected.stats.total / maxAssigned * 100)}%` }}/></span>
          </div>
          <div className={styles.taskHeading}><strong>Próximas tareas</strong><button type="button" onClick={() => setDetailTab('tasks')}>Ver todas</button></div>
          <TaskList tasks={selected.tasks.filter((task) => task.workflow_state !== 'done').slice(0,5)} />
        </div>}
        {detailTab === 'tasks' && <div className={styles.detailScroll}><TaskList tasks={selected.tasks} /></div>}
        {detailTab === 'activity' && <div className={styles.detailScroll}>
          <p className={styles.activityIntro}>Últimas modificaciones de las tareas asignadas, no un registro de acciones personales.</p>
          <TaskList tasks={[...selected.tasks].sort((a,b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).slice(0,15)} showUpdated />
        </div>}
      </aside>}
    </div>
    {managerOpen && data.can_manage && <ManagementModal project={project} data={data} onClose={() => setManagerOpen(false)} onChanged={refresh} />}
  </section>
}

function TaskList({ tasks, showUpdated = false }: { tasks: Assignment[]; showUpdated?: boolean }) {
  if (!tasks.length) return <p className={styles.emptyTasks}>No hay tareas en esta sección.</p>
  return <div className={styles.taskList}>{tasks.map((task) => <div key={task.id} className={styles.taskItem}>
    <div><strong title={task.title}>{task.title}</strong><small>{task.board_name}</small></div>
    <div className={styles.taskMeta}><small>{dateLabel(showUpdated ? task.updated_at : task.due_date)}</small>
      <span className={task.overdue ? styles.overduePill : styles.statePill} title={task.overdue ? `Retrasada · ${task.column_name}` : undefined}>{task.column_name}</span></div>
  </div>)}</div>
}

function ManagementModal({ project, data, onClose, onChanged }: { project: Project; data: PersonnelData; onClose: () => void; onChanged: () => Promise<void> }) {
  const [tab, setTab] = useState<ManagementTab>('teams')
  const [teamId, setTeamId] = useState<number | ''>('')
  const [addRole, setAddRole] = useState<Role>('editor')
  const [userId, setUserId] = useState<number | ''>('')
  const [memberRole, setMemberRole] = useState<Role>('editor')
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('editor')
  const [inviteLink, setInviteLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetTeam = data.teams.find((team) => team.id === teamId)
  const currentIds = new Set(data.members.map((member) => member.id))
  const additions = targetTeam?.members.filter((member) => !currentIds.has(member.id)) ?? []
  const available = data.available_people.filter((person) => !currentIds.has(person.id))

  async function action(body: () => Promise<unknown>) {
    setBusy(true); setError(null)
    try { await body(); await onChanged() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo realizar la operación.') }
    finally { setBusy(false) }
  }
  async function assignTeam() {
    if (!targetTeam || !window.confirm(`Vincular "${targetTeam.name}" a ${project.name} e incorporar ${additions.length} persona(s) nuevas con rol ${roleName(addRole)}?\n\nNuevas: ${additions.map((person) => person.name).join(', ') || 'ninguna'}\n\nLos roles de miembros existentes no cambiarán.`)) return
    await action(async () => {
      await api(`/projects/${project.id}/personnel/teams`, {
        method: 'POST', body: JSON.stringify({
          team_id: targetTeam.id, role: addRole, confirmed_member_ids: targetTeam.members.map((person) => person.id),
        }),
      })
    })
  }
  async function addPerson() {
    if (!userId) return
    await action(async () => {
      await api(`/projects/${project.id}/personnel/members`, {
        method: 'POST', body: JSON.stringify({ user_id: userId, role: memberRole }),
      })
      setUserId('')
    })
  }
  async function changeRole(member: Member, next: Role) {
    if (member.role === next) return
    if (!window.confirm(`¿Cambiar el rol de ${member.name} a ${roleName(next)}?`)) return
    await action(() => api(`/projects/${project.id}/personnel/members/${member.id}`, {
      method: 'PATCH', body: JSON.stringify({ role: next }),
    }))
  }
  async function removeMember(member: Member) {
    if (!window.confirm(`¿Retirar a ${member.name} de ${project.name}? Perderá el acceso al proyecto y sus asignaciones a Cards.`)) return
    await action(() => api(`/projects/${project.id}/personnel/members/${member.id}`, { method: 'DELETE' }))
  }
  async function invite() {
    if (!inviteEmail.trim() || !inviteName.trim()) return
    await action(async () => {
      const response = await api<{ link: string }>(`/projects/${project.id}/invitations`, {
        method: 'POST', body: JSON.stringify({ name: inviteName, email: inviteEmail, role: inviteRole }),
      })
      setInviteLink(response.link)
    })
  }
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Gestionar miembros del proyecto">
      <div className={styles.modalHeader}><div><strong>Gestionar miembros</strong><small>{project.name}</small></div>
        <button type="button" onClick={onClose} aria-label="Cerrar gestión"><MiniIcon name="close" /></button></div>
      <div className={styles.modalTabs}>
        <button type="button" className={tab === 'teams' ? styles.currentTab : ''} onClick={() => {setTab('teams');setError(null)}}>Equipos</button>
        <button type="button" className={tab === 'people' ? styles.currentTab : ''} onClick={() => {setTab('people');setError(null)}}>Personas</button>
        <button type="button" className={tab === 'invite' ? styles.currentTab : ''} onClick={() => {setTab('invite');setError(null)}}>Invitar</button>
      </div>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      {tab === 'teams' && <div className={styles.modalContent}>
        <p>Vincula un equipo del Workspace. Sus integrantes que todavía no pertenezcan al proyecto recibirán el rol seleccionado.</p>
        <label>Equipo
          <select value={teamId} onChange={(event) => setTeamId(event.target.value ? Number(event.target.value) : '')}>
            <option value="">Seleccionar equipo…</option>
            {data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.linked ? ' · Ya vinculado' : ''}</option>)}
          </select>
        </label>
        {targetTeam && <div className={styles.teamPreview}><strong>Miembros del equipo ({targetTeam.members.length})</strong>
          <p>{targetTeam.members.map((person) => person.name).join(', ') || 'Este equipo no tiene integrantes.'}</p>
          <small>{additions.length} se incorporarán · {targetTeam.members.length - additions.length} ya tienen acceso</small>
        </div>}
        <label>Rol para los nuevos integrantes
          <select value={addRole} onChange={(event) => setAddRole(event.target.value as Role)}>
            {MANAGE_ROLES.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
          </select>
        </label>
        <button type="button" className={styles.modalPrimary} disabled={!teamId || busy} onClick={() => void assignTeam()}>Vincular equipo y conceder acceso</button>
        {data.teams.some((team) => team.linked) && <div className={styles.linkedTeams}><strong>Equipos vinculados</strong>
          {data.teams.filter((team) => team.linked).map((team) => <div key={team.id}><span>{team.name}</span>
            <button type="button" disabled={busy} onClick={() => {
              if (!window.confirm(`¿Desvincular ${team.name}? Los miembros conservarán sus permisos individuales.`)) return
              void action(() => api(`/projects/${project.id}/personnel/teams/${team.id}`, {method:'DELETE'}))
            }}>Desvincular</button></div>)}
        </div>}
      </div>}
      {tab === 'people' && <div className={styles.modalContent}>
        <label>Persona del Workspace
          <select value={userId} onChange={(event) => setUserId(event.target.value ? Number(event.target.value) : '')}>
            <option value="">Seleccionar persona…</option>{available.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select></label>
        <label>Rol <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as Role)}>
          {MANAGE_ROLES.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
        </select></label>
        <button type="button" className={styles.modalPrimary} disabled={!userId || busy} onClick={() => void addPerson()}>Añadir miembro</button>
        <strong className={styles.modalSectionTitle}>Miembros actuales</strong>
        <div className={styles.manageMembers}>{data.members.map((member) => <div key={member.id}>
          <Avatar id={member.id} name={member.name} src={member.avatar_url} size={28}/>
          <span>{member.name}</span>
          <select aria-label={`Rol de ${member.name}`} disabled={busy || member.is_workspace_owner} value={member.role} onChange={(event) => void changeRole(member,event.target.value as Role)}>
            {ROLES.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
          </select>
          <button type="button" disabled={busy || member.is_workspace_owner} aria-label={`Retirar a ${member.name}`} onClick={() => void removeMember(member)}>Retirar</button>
        </div>)}</div>
      </div>}
      {tab === 'invite' && <form className={styles.modalContent} onSubmit={(event) => {event.preventDefault();void invite()}}>
        <p>Invita por correo electrónico usando las invitaciones existentes de Tickard.</p>
        <label>Nombre<input required value={inviteName} onChange={(event) => setInviteName(event.target.value)} /></label>
        <label>Correo electrónico<input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label>
        <label>Rol<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Role)}>
          {ROLES.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
        </select></label>
        <button className={styles.modalPrimary} type="submit" disabled={busy}>Generar invitación</button>
        {inviteLink && <div className={styles.inviteResult}><strong>Enlace de invitación</strong><input readOnly value={inviteLink} onFocus={(event) => event.target.select()}/></div>}
      </form>}
    </div>
  </div>
}
