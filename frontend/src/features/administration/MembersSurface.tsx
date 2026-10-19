import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api'
import { Avatar, formatDateLong } from '../../shared/ui'
import { EditIcon, FilterFunnelIcon, SortIcon, TrashIcon } from '../../shared/icons'
import { ProjectContentLoading } from '../workspace/ProjectContentLoading'
import { WorkspaceInvitations } from '../workspace/WorkspaceInvitations'
import styles from './MembersSurface.module.css'

type Linked = { id: number; name: string; is_lead?: boolean; role?: string }
type Member = {
  id: number; name: string; handle: string; email: string; job_title: string | null
  professional_phone: string | null; joined_at: string | null; avatar_url: string | null
  role: string; is_client: boolean
  departments: Linked[]; teams: Linked[]; projects: Linked[]
}
type MemberData = {
  members: Member[]; member_count: number; member_limit: number | null
  pending_invitations: number; can_manage_roles: boolean; can_manage_jobs: boolean
  can_remove_members: boolean
}
type Filter = 'all' | 'owner' | 'admin' | 'member' | 'client'
type Panel = 'members' | 'invitations'
type Tab = 'summary' | 'projects' | 'teams' | 'permissions' | 'activity'
type View = 'list' | 'grid'
type SortKey = 'name' | 'job' | 'assignment' | 'role' | 'projects' | 'joined'
type IconName = 'people' | 'teams' | 'departments' | 'roles' | 'search' | 'plus' | 'list' | 'grid' | 'folder' | 'close' | 'chevron-left' | 'chevron-right' | 'mail' | 'phone' | 'calendar' | 'shield'
const roleLabels: Record<string, string> = {
  owner: 'Owner', admin: 'Administrador', member: 'Miembro', client: 'Cliente',
  responsable: 'Responsable', editor: 'Editor', lector: 'Lector', cliente: 'Cliente',
}
const roleLabel = (role: string) => roleLabels[role] ?? role
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })
const tabs: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Resumen' },
  { id: 'projects', label: 'Proyectos' },
  { id: 'teams', label: 'Equipos' },
  { id: 'permissions', label: 'Permisos' },
  { id: 'activity', label: 'Actividad' },
]

function Glyph({ name, size = 18 }: { name: IconName; size?: number }) {
  const icons: Record<IconName, ReactNode> = {
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5"/></>,
    teams: <><circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M1 20v-2a6 6 0 0 1 12 0v2M11 20v-2a6 6 0 0 1 12 0v2"/></>,
    departments: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h2M15 7h.01M9 11h2M15 11h.01M9 15h2M15 15h.01M11 21v-4h3v4"/></>,
    roles: <><path d="m12 3 8 4v6c0 5-4 7-8 9-4-2-8-4-8-9V7l8-4Z"/><path d="m9 12 2 2 4-4"/></>,
    search: <><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    list: <><path d="M9 5h12M9 12h12M9 19h12M3 5h2M3 12h2M3 19h2"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>,
    close: <path d="m5 5 14 14M19 5 5 19"/>,
    'chevron-left': <path d="m15 6-6 6 6 6"/>,
    'chevron-right': <path d="m9 6 6 6-6 6"/>,
    mail: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="m2 7 10 7 10-7"/></>,
    phone: <path d="M7 3H4a2 2 0 0 0-2 2c0 9.4 7.6 17 17 17a2 2 0 0 0 2-2v-3l-6-3-2 3a15 15 0 0 1-6-6l3-2-3-6Z"/>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18"/></>,
    shield: <><path d="m12 2 9 5v6c0 5-4 8-9 9-5-1-9-4-9-9V7l9-5Z"/><path d="m9 12 2 2 4-4"/></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {icons[name]}
  </svg>
}

function Role({ role }: { role: string }) {
  return <span className={styles.role} data-role={role}>
    {role === 'owner' && <span aria-hidden="true">♛</span>}
    {role === 'admin' && <Glyph name="shield" size={13}/>}
    {roleLabel(role)}
  </span>
}

function Links({ title, items, onMore }: { title: string; items: Linked[]; onMore?: () => void }) {
  return <section className={styles.linkGroup}>
    <div className={styles.sectionHeading}><strong>{title} ({items.length})</strong>
      {onMore && items.length > 0 && <button type="button" onClick={onMore}>Ver todos</button>}
    </div>
    {items.length ? <div className={styles.linkList}>
      {items.slice(0, onMore ? 4 : undefined).map(item => <div key={item.id} className={styles.linkItem}>
        <span className={styles.linkMarker}><Glyph name={title.startsWith('Proyecto') ? 'folder' : 'teams'} size={16}/></span>
        <span className={styles.linkName} title={item.name}>{item.name}</span>
        {item.is_lead && <small className={styles.leadBadge}>Responsable</small>}
        {item.role && <small className={styles.linkRole}>{roleLabel(item.role)}</small>}
      </div>)}
    </div> : <p className={styles.muted}>Sin vinculaciones</p>}
  </section>
}

function Metric({ icon, tone, count, label, detail }: {
  icon: IconName; tone: string; count: string | number; label: string; detail: string
}) {
  return <div className={styles.metric}>
    <span className={styles.metricIcon} data-tone={tone}><Glyph name={icon} size={24}/></span>
    <div className={styles.metricCopy}><strong>{count}</strong><span>{label}</span><small>{detail}</small></div>
  </div>
}

export function MembersSurface({ workspaceId, workspaceName, openInvitations = false, onQuickActionConsumed }: {
  workspaceId: number | null; workspaceName: string
  openInvitations?: boolean; onQuickActionConsumed?: () => void
}) {
  const [data, setData] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Filter>('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [panel, setPanel] = useState<Panel>('members')
  const [tab, setTab] = useState<Tab>('summary')
  const [view, setView] = useState<View>('list')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const [editingMember, setEditingMember] = useState(false)
  const [editError, setEditError] = useState('')
  const [draftJob, setDraftJob] = useState('')
  const [draftRole, setDraftRole] = useState<'admin' | 'member'>('member')
  const [saving, setSaving] = useState(false)
  const [savingJob, setSavingJob] = useState(false)
  const [removingMember, setRemovingMember] = useState<Member | null>(null)
  const [removalBusy, setRemovalBusy] = useState(false)
  const [removalError, setRemovalError] = useState('')

  const load = useCallback(async () => {
    if (workspaceId === null) return
    const result = await api<MemberData>('/workspaces/' + workspaceId + '/members')
    setData(result)
    setSelectedId(id => id !== null && result.members.some(member => member.id === id)
      ? id : result.members[0]?.id ?? null)
  }, [workspaceId])

  useEffect(() => {
    let alive = true
    setLoading(true); setData(null); setSelectedId(null); setSelectedIds([]); setPanel('members')
    setError(''); setNotice(''); setRemovingMember(null); setRemovalError(''); setSearch(''); setRoleFilter('all'); setDepartmentFilter('all'); setTeamFilter('all'); setFiltersOpen(false); setSortKey('name'); setSortDirection('asc')
    if (workspaceId === null) { setLoading(false); return }
    void api<MemberData>('/workspaces/' + workspaceId + '/members')
      .then(result => { if (alive) { setData(result); setSelectedId(result.members[0]?.id ?? null) } })
      .catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los miembros.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [workspaceId])

  useEffect(() => {
    if (openInvitations && data?.can_manage_roles) {
      setPanel('invitations')
      onQuickActionConsumed?.()
    }
  }, [openInvitations, data?.can_manage_roles, onQuickActionConsumed])

  const selected = data?.members.find(member => member.id === selectedId) ?? null
  useEffect(() => {
    setDraftRole(selected?.role === 'admin' ? 'admin' : 'member')
  }, [selected?.id, selected?.role])

  useEffect(() => { setDraftJob(selected?.job_title ?? ''); setEditingMember(false); setEditError('') }, [selected?.id, selected?.job_title])
  const canEditJob = !!(selected && data?.can_manage_jobs && !selected.is_client)
  const canEditRole = !!(selected && data?.can_manage_roles && selected.role !== 'owner' && selected.role !== 'client')
  const canRemoveMember = !!(selected && data?.can_remove_members && selected.role !== 'owner' && !selected.is_client && selected.role !== 'client')
  function beginEditMember() {
    if (!selected || (!canEditJob && !canEditRole)) return
    setDraftJob(selected.job_title ?? '')
    setDraftRole(selected.role === 'admin' ? 'admin' : 'member')
    setEditError('')
    setEditingMember(true)
  }
  useEffect(() => {
    if (!editingMember) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingJob) { setEditingMember(false); setEditError('') }
    }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [editingMember, savingJob])

  useEffect(() => {
    if (!filtersOpen) return
    const dismiss = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFiltersOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFiltersOpen(false) }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', dismiss); document.removeEventListener('keydown', escape) }
  }, [filtersOpen])

  const departments = useMemo(() => Array.from(new Map<number, string>((data?.members ?? [])
    .flatMap(member => member.departments).map(item => [item.id, item.name] as const)).entries())
    .sort((a, b) => collator.compare(a[1], b[1])), [data])
  const teams = useMemo(() => Array.from(new Map<number, string>((data?.members ?? [])
    .flatMap(member => member.teams).map(item => [item.id, item.name] as const)).entries())
    .sort((a, b) => collator.compare(a[1], b[1])), [data])

  const filtered = useMemo(() => (data?.members ?? []).filter(member => {
    const needle = search.trim().toLocaleLowerCase('es')
    return (roleFilter === 'all' || (roleFilter === 'member'
      ? !['owner', 'admin', 'client'].includes(member.role) : member.role === roleFilter))
      && (departmentFilter === 'all' || member.departments.some(item => String(item.id) === departmentFilter))
      && (teamFilter === 'all' || member.teams.some(item => String(item.id) === teamFilter))
      && (!needle || [member.name, member.handle, member.email].some(value => value.toLocaleLowerCase('es').includes(needle)))
  }).sort((a, b) => {
    const value = (m: Member): string | number => {
      switch (sortKey) {
        case 'name': return m.name
        case 'job': return m.job_title ?? ''
        case 'assignment': return [...m.departments.map(x => x.name), ...m.teams.map(x => x.name)].join(' ')
        case 'role': return m.role
        case 'projects': return m.projects.length
        case 'joined': return m.joined_at ?? ''
      }
    }
    const left = value(a), right = value(b)
    // Keep missing job titles or dates at the end in either direction.
    if (left === '' && right !== '') return 1
    if (right === '' && left !== '') return -1
    const order = typeof left === 'number' && typeof right === 'number'
      ? left - right : collator.compare(String(left), String(right))
    return (sortDirection === 'asc' ? order : -order) || collator.compare(a.name, b.name)
  }), [data, search, roleFilter, departmentFilter, teamFilter, sortKey, sortDirection])

  const displayed = filtered
  const allOnPage = displayed.length > 0 && displayed.every(member => selectedIds.includes(member.id))
  const activeFilters = Number(roleFilter !== 'all') + Number(departmentFilter !== 'all') + Number(teamFilter !== 'all')
  const editableSelected = (data?.members ?? []).filter(member =>
    selectedIds.includes(member.id) && (member.role === 'admin' || member.role === 'member'))
  const rolesCount = new Set((data?.members ?? []).map(member => member.role)).size
  const clientCount = data?.members.filter(member => member.role === 'client').length ?? 0
  const internalCount = (data?.member_count ?? 0) - clientCount

  function changeFilter(action: () => void) {
    action(); setSelectedIds([])
  }
  function toggleSelected(id: number, checked: boolean) {
    setSelectedIds(previous => checked
      ? [...new Set([...previous, id])] : previous.filter(value => value !== id))
  }
  function chooseMember(id: number) { setSelectedId(id); setTab('summary') }
  function changeSort(key: SortKey) {
    if (sortKey === key) setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDirection('asc') }
  }
  function sortHeading(key: SortKey, title: string) {
    return <th key={key} aria-sort={sortKey === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={styles.sortButton} onClick={() => changeSort(key)}
        title={'Ordenar por ' + title}>
        {title}<SortIcon direction={sortKey === key ? sortDirection : null} className={styles.sortIcon}/>
      </button>
    </th>
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (workspaceId === null || !selected || savingJob || saving) return
    const nextJob = draftJob.trim()
    const jobChanged = canEditJob && nextJob !== (selected.job_title ?? '')
    const roleChanged = canEditRole && draftRole !== selected.role
    if (!jobChanged && !roleChanged) { setEditingMember(false); return }
    if (nextJob.length > 120) { setEditError('El cargo no puede superar los 120 caracteres.'); return }
    setSavingJob(true); setEditError(''); setError(''); setNotice('')
    try {
      if (jobChanged) {
        await api('/workspaces/' + workspaceId + '/members/' + selected.id + '/job-title', {
          method: 'PATCH', body: JSON.stringify({ job_title: nextJob || null }),
        })
      }
      if (roleChanged) {
        await api('/workspaces/' + workspaceId + '/members/' + selected.id + '/role', {
          method: 'PATCH', body: JSON.stringify({ role: draftRole }),
        })
      }
      await load()
      setEditingMember(false)
      setNotice('Miembro actualizado.')
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'No se pudo actualizar el miembro.')
    } finally { setSavingJob(false) }
  }

  function openRemoveMember(member: Member) {
    if (!data?.can_remove_members || member.role === 'owner' || member.role === 'client' || member.is_client) return
    setRemovalError('')
    setRemovingMember(member)
  }

  async function confirmRemoveMember() {
    if (!removingMember || workspaceId === null || !data?.can_remove_members || removalBusy) return
    setRemovalBusy(true); setRemovalError(''); setNotice(''); setError('')
    try {
      await api('/workspaces/' + workspaceId + '/members/' + removingMember.id, { method: 'DELETE' })
      const removedId = removingMember.id
      setSelectedIds(previous => previous.filter(id => id !== removedId))
      setSelectedId(previous => previous === removedId ? null : previous)
      setRemovingMember(null)
      setTab('summary')
      setNotice('Miembro retirado del Workspace. Se han revocado sus accesos y asignaciones; se conserva el historial.')
      try {
        await load()
      } catch {
        setError('La baja se ha completado, pero no se pudo actualizar el listado. Recarga la vista para verlo.')
      }
    } catch (cause) {
      setRemovalError(cause instanceof Error ? cause.message : 'No se pudo dar de baja al miembro.')
    } finally { setRemovalBusy(false) }
  }

  useEffect(() => {
    if (!removingMember) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !removalBusy) {
        setRemovingMember(null)
        setRemovalError('')
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [removingMember, removalBusy])

  async function updateRoles(ids: number[], role: 'admin' | 'member') {
    if (!data?.can_manage_roles || workspaceId === null || saving || !ids.length) return
    if (ids.length > 1 && !window.confirm('¿Cambiar el rol de ' + ids.length + ' miembros a ' + roleLabel(role) + '?')) return
    setSaving(true); setError(''); setNotice('')
    let successes = 0
    try {
      const errors: string[] = []
      for (const id of ids) {
        try {
          await api('/workspaces/' + workspaceId + '/members/' + id + '/role', {
            method: 'PATCH', body: JSON.stringify({ role }),
          })
          successes++
        } catch (cause) {
          errors.push(cause instanceof Error ? cause.message : 'No se pudo actualizar un miembro.')
        }
      }
      if (successes) {
        await load()
        setSelectedIds([])
        setNotice(successes === 1 ? 'Rol actualizado.' : 'Roles actualizados: ' + successes + '.')
      }
      if (errors.length) setError(errors.join(' · '))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron actualizar los roles.')
    } finally { setSaving(false) }
  }

  return <section className={styles.root + ' workspace-members-view'} aria-label="Miembros del Workspace"
    data-invites={panel === 'invitations'}>
    <header className={styles.header}>
      <span className={styles.headerIcon}><Glyph name="people" size={27}/></span>
      <div className={styles.headerCopy}><h1>Miembros</h1>
        <p>Gestiona los miembros de {workspaceName}, sus permisos y asignaciones.</p></div>

    </header>

    {loading ? <div className={styles.loadingOverlay}>
      <ProjectContentLoading title="Cargando Miembros"
        description="Preparando miembros, cargos y asignaciones del Workspace…">
        <div className={styles.loading}>
          <div className={styles.loadingMetrics} aria-hidden="true">{[0, 1, 2, 3].map(x => <span key={x}/>)}</div>
          <div className={styles.loadingList} aria-hidden="true">
            {[0, 1, 2, 3, 4].map(x => <span key={x}/>)}
          </div>
          <div className={styles.loadingDetail} aria-hidden="true"/>
        </div>
      </ProjectContentLoading>
    </div> : <>
      {data && <div className={styles.metrics}>
        <Metric icon="people" tone="blue" count={data.member_count} label="Miembros"
          detail={internalCount + ' internos · ' + clientCount + ' clientes'}/>
        <Metric icon="teams" tone="purple" count={teams.length} label="Equipos"
          detail="con miembros vinculados"/>
        <Metric icon="departments" tone="mint" count={departments.length} label="Departamentos"
          detail="con miembros vinculados"/>
        <Metric icon="roles" tone="orange" count={rolesCount} label="Roles"
          detail="en uso en el Workspace"/>
      </div>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      {data && panel === 'invitations' && data.can_manage_roles ? <div className={styles.invitationArea}>
        <div className={styles.inviteToolbar}><button type="button" className={styles.primary}
          onClick={() => { setPanel('members'); setError(''); setNotice('') }}>
          <Glyph name="chevron-left" size={17}/> Volver a miembros
        </button></div>
        <WorkspaceInvitations workspaceId={workspaceId ?? undefined} workspaceName={workspaceName} showMembers={false}/>
      </div> : data && <div className={styles.main}>
        <div className={styles.toolbar}>
          <label className={styles.search}><Glyph name="search" size={17}/>
            <input type="search" placeholder="Buscar miembros..." aria-label="Buscar miembros"
              value={search} onChange={event => changeFilter(() => setSearch(event.target.value))}/>
          </label>
          <div className={styles.filterControls} ref={filterRef}>
            <button type="button" className={`icon-button board-filter-trigger ${styles.filterTrigger}${filtersOpen || activeFilters ? ' on' : ''}`}
              aria-label={activeFilters ? 'Filtros: ' + activeFilters + ' activos' : 'Filtros de miembros'}
              title="Filtros" aria-haspopup="dialog" aria-expanded={filtersOpen}
              aria-controls={filtersOpen ? 'members-filters-popover' : undefined}
              onClick={() => setFiltersOpen(open => !open)}>
              <FilterFunnelIcon/>
              {activeFilters > 0 && <span className="board-filter-active-dot" aria-hidden="true"/>}
            </button>
            {filtersOpen && <div id="members-filters-popover" className={styles.filterPopover}
              role="dialog" aria-label="Filtros de miembros">
              <div className={styles.filterPopoverHeader}><strong>Filtros</strong>
                {activeFilters > 0 && <button type="button" onClick={() => {
                  setRoleFilter('all'); setDepartmentFilter('all'); setTeamFilter('all'); setSelectedIds([])
                }}>Limpiar</button>}
              </div>
              <label>Departamento
                <select value={departmentFilter} onChange={event => changeFilter(() => setDepartmentFilter(event.target.value))}>
                  <option value="all">Todos</option>
                  {departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
              <label>Equipo
                <select value={teamFilter} onChange={event => changeFilter(() => setTeamFilter(event.target.value))}>
                  <option value="all">Todos</option>
                  {teams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
              <label>Rol
                <select value={roleFilter} onChange={event => changeFilter(() => setRoleFilter(event.target.value as Filter))}>
                  <option value="all">Todos</option><option value="owner">Owner</option>
                  <option value="admin">Administrador</option><option value="member">Miembro</option>
                  <option value="client">Cliente</option>
                </select>
              </label>
            </div>}
          </div>
          <div className={styles.viewSwitch} role="group" aria-label="Vista de miembros">
            <button type="button" aria-pressed={view === 'grid'} title="Vista en tarjetas"
              className={view === 'grid' ? styles.viewActive : undefined}
              onClick={() => setView('grid')}><Glyph name="grid" size={17}/></button>
            <button type="button" aria-pressed={view === 'list'} title="Vista en tabla"
              className={view === 'list' ? styles.viewActive : undefined}
              onClick={() => setView('list')}><Glyph name="list" size={18}/></button>
          </div>
          {data.can_manage_roles && <button type="button" className={styles.primary}
            onClick={() => { setPanel('invitations'); setError(''); setNotice('') }}>
            <Glyph name="plus" size={18}/> Invitar miembros
          </button>}
        </div>

        {selectedIds.length > 0 && <div className={styles.selectionBar}>
          <span>{selectedIds.length} seleccionados</span>
          {data.can_manage_roles && editableSelected.length > 0 && <>
            <button type="button" disabled={saving} onClick={() => void updateRoles(editableSelected.map(member => member.id), 'member')}>
              Asignar Miembro
            </button>
            <button type="button" disabled={saving} onClick={() => void updateRoles(editableSelected.map(member => member.id), 'admin')}>
              Asignar Administrador
            </button>
          </>}
          <button type="button" disabled={saving} onClick={() => setSelectedIds([])}>Limpiar selección</button>
        </div>}

        {view === 'list' ? <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr>
              <th className={styles.checkCol}><input type="checkbox" aria-label="Seleccionar todos los miembros filtrados"
                checked={allOnPage} disabled={!displayed.length}
                onChange={event => setSelectedIds(previous => event.target.checked
                  ? [...new Set([...previous, ...displayed.map(member => member.id)])]
                  : previous.filter(id => !displayed.some(member => member.id === id)))}/></th>
              {sortHeading('name', 'Miembro')}{sortHeading('job', 'Cargo')}
              {sortHeading('assignment', 'Departamento / Equipo')}{sortHeading('role', 'Rol')}
              {sortHeading('projects', 'Proyectos')}{sortHeading('joined', 'Incorporación')}
            </tr></thead>
            <tbody>{displayed.map(member => <tr key={member.id} data-selected={member.id === selectedId}>
              <td className={styles.checkCol}><input type="checkbox" aria-label={'Seleccionar ' + member.name}
                checked={selectedIds.includes(member.id)}
                onChange={event => toggleSelected(member.id, event.target.checked)}/></td>
              <td><button type="button" className={styles.tableName} onClick={() => chooseMember(member.id)}>
                <Avatar id={member.id} name={member.name} src={member.avatar_url} size={32}/>
                <span><strong title={member.name}>{member.name}</strong></span>
              </button></td>
              <td className={styles.jobCell} title={member.job_title ?? 'Cargo sin especificar'}>
                {member.job_title || 'Sin especificar'}</td>
              <td><button type="button" className={styles.badgeList} onClick={() => chooseMember(member.id)}
                aria-label={'Ver equipos y departamentos de ' + member.name}>
                {member.departments.slice(0, 1).map(item => <span key={item.id} className={styles.departmentBadge}>{item.name}</span>)}
                {member.teams.slice(0, 2).map(item => <span key={item.id} className={styles.teamBadge}>{item.name}</span>)}
                {(member.departments.length + member.teams.length > 3) &&
                  <span className={styles.extraBadge}>+{member.departments.length + member.teams.length - 3}</span>}
                {member.departments.length + member.teams.length === 0 && <small>Sin asignar</small>}
              </button></td>
              <td><Role role={member.role}/></td>
              <td className={styles.countCell}>{member.projects.length}</td>
              <td className={styles.dateCell}>{member.joined_at ? formatDateLong(member.joined_at) : '—'}</td>
            </tr>)}</tbody>
          </table>
          {!displayed.length && <p className={styles.empty}>No hay miembros que coincidan con los filtros.</p>}
        </div> : <div className={styles.cardScroll}><div className={styles.memberGrid}>
          {displayed.map(member => <button type="button" key={member.id} className={styles.memberCard}
            data-selected={member.id === selectedId} onClick={() => chooseMember(member.id)}>
            <Avatar id={member.id} name={member.name} src={member.avatar_url} size={46}/>
            <strong>{member.name}</strong>
            <span className={styles.cardJob}>{member.job_title || 'Cargo sin especificar'}</span>
            <Role role={member.role}/>
            <span className={styles.cardMeta}>{member.teams.length} equipos · {member.projects.length} proyectos</span>
          </button>)}
          {!displayed.length && <p className={styles.empty}>No hay miembros que coincidan con los filtros.</p>}
        </div></div>}

      </div>}

      {data && panel === 'members' && <aside className={styles.inspector} aria-label="Ficha del miembro">
        {selected ? <>
          <header className={styles.memberHead}>
            <Avatar id={selected.id} name={selected.name} src={selected.avatar_url} size={60}/>
            <div className={styles.memberHeadText}>
              <strong>{selected.name}</strong><small>{selected.email}</small>
              <Role role={selected.role}/>
            </div>
            <button type="button" className={styles.close} title="Cerrar ficha" aria-label="Cerrar ficha"
              onClick={() => setSelectedId(null)}><Glyph name="close" size={17}/></button>
          </header>
          <nav className={styles.tabs} aria-label="Apartados del miembro">
            {tabs.map(item => <button type="button" key={item.id} aria-current={tab === item.id ? 'page' : undefined}
              className={tab === item.id ? styles.tabActive : undefined} onClick={() => setTab(item.id)}>
              {item.label}
            </button>)}
          </nav>
          <div className={styles.detailScroll}>
            {tab === 'summary' && <>
              <section className={styles.detailGroup}>
                <div className={styles.sectionHeading}><strong>Información</strong>
                  {(canEditJob || canEditRole) && <button type="button" onClick={beginEditMember}>
                    <EditIcon/> Editar
                  </button>}
                </div>
                <dl className={styles.info}>
                  <dt>Nombre</dt><dd>{selected.name}</dd>
                  <dt>Correo</dt><dd title={selected.email}>{selected.email}</dd>
                  <dt>Cargo</dt><dd>{selected.job_title || 'Sin especificar'}</dd>
                  <dt>Identificador</dt><dd>{selected.handle}</dd>
                  <dt>Teléfono</dt><dd>{selected.professional_phone || 'No indicado'}</dd>
                  <dt>Departamento</dt><dd>{selected.departments.map(x => x.name).join(', ') || 'Sin asignar'}</dd>
                  <dt>Equipos</dt><dd>{selected.teams.map(x => x.name).join(', ') || 'Sin asignar'}</dd>
                  <dt>Incorporación</dt><dd>{selected.joined_at ? formatDateLong(selected.joined_at) : 'Sin fecha'}</dd>
                </dl>
              </section>
              {selected && canRemoveMember && <section className={styles.removeSection}>
                <strong>Dar de baja del Workspace</strong>
                <p>Retira sus accesos y asignaciones sin eliminar su cuenta ni el historial de trabajo.</p>
                <button type="button" className={styles.removeAction} onClick={() => openRemoveMember(selected)}>
                  <TrashIcon/> Quitar del Workspace
                </button>
              </section>}
              <section className={styles.detailGroup}>
                <div className={styles.sectionHeading}><strong>Roles y permisos</strong>
                  <button type="button" onClick={() => setTab('permissions')}>Ver permisos</button></div>
                <Role role={selected.role}/>
              </section>
              <Links title="Equipos" items={selected.teams} onMore={() => setTab('teams')}/>
              <Links title="Proyectos" items={selected.projects} onMore={() => setTab('projects')}/>
            </>}
            {tab === 'projects' && <>
              <div className={styles.sectionHeading}><strong>Proyectos asignados ({selected.projects.length})</strong></div>
              <Links title="Proyectos" items={selected.projects}/>
              <p className={styles.muted}>Los roles de proyecto se administran desde Personal del proyecto correspondiente.</p>
            </>}
            {tab === 'teams' && <>
              <Links title="Equipos" items={selected.teams}/>
              <Links title="Departamentos" items={selected.departments}/>
              <p className={styles.muted}>Las asignaciones se gestionan en Departamentos y Equipos.</p>
            </>}
            {tab === 'permissions' && <section className={styles.detailGroup}>
              <div className={styles.sectionHeading}><strong>Permisos del Workspace</strong></div>
              <Role role={selected.role}/>
              <p>El rol del Workspace es independiente de los permisos en cada proyecto.</p>
              {canEditRole && <div className={styles.sectionHeading}>
                <button type="button" onClick={beginEditMember}><EditIcon/> Editar rol</button>
              </div>}
              {!canEditRole && <p>{selected.role === 'owner'
                ? 'El Owner no puede cambiarse desde esta ficha.'
                : selected.role === 'client' ? 'Los accesos de cliente se administran desde Clientes.'
                  : 'Solo el Owner puede asignar roles de administración.'}</p>}
            </section>}
            {tab === 'activity' && <section className={styles.detailGroup}>
              <div className={styles.sectionHeading}><strong>Actividad</strong></div>
              <p>El historial de actividad y la última conexión todavía no están disponibles.</p>
              {selected.joined_at && <div className={styles.activityItem}><Glyph name="calendar" size={16}/>
                <span>Incorporación al Workspace: {formatDateLong(selected.joined_at)}</span></div>}
            </section>}
          </div>
        </> : <div className={styles.inspectorEmpty}>
          <Glyph name="people" size={30}/>
          <p>Selecciona un miembro para ver su ficha.</p>
        </div>}
      </aside>}
    </>}
    {editingMember && selected && (canEditJob || canEditRole) && createPortal(
      <div className={styles.editorBackdrop} onMouseDown={event => {
        if (event.target === event.currentTarget && !savingJob) { setEditingMember(false); setEditError('') }
      }}>
        <div className={styles.editorModal} role="dialog" aria-modal="true" aria-labelledby="member-editor-title">
          <form onSubmit={saveMember} className={styles.editorForm}>
            <header className={styles.editorHeader}>
              <div><h2 id="member-editor-title">Editar miembro</h2><p>{selected.name}</p></div>
              <button type="button" className={styles.close} aria-label="Cerrar edición"
                disabled={savingJob} onClick={() => { setEditingMember(false); setEditError('') }}>
                <Glyph name="close" size={19}/>
              </button>
            </header>
            <div className={styles.editorFields}>
              {canEditJob && <label className={styles.field}>Cargo en el Workspace
                <input autoFocus maxLength={120} value={draftJob} disabled={savingJob}
                  placeholder="Ej.: Programador junior" onChange={event => setDraftJob(event.target.value)}/>
              </label>}
              {canEditRole && <label className={styles.field}>Rol en el Workspace
                <select autoFocus={!canEditJob} value={draftRole} disabled={savingJob}
                  onChange={event => setDraftRole(event.target.value as 'admin' | 'member')}>
                  <option value="member">Miembro</option><option value="admin">Administrador</option>
                </select>
              </label>}
              {canEditRole && <p className={styles.muted}>Los permisos del Workspace son independientes de los roles de cada proyecto.</p>}
              {editError && <p className={styles.editorError} role="alert">{editError}</p>}
            </div>
            <footer className={styles.editorFooter}>
              <button type="button" className={styles.editorCancel} disabled={savingJob}
                onClick={() => { setEditingMember(false); setEditError('') }}>Cancelar</button>
              <button type="submit" className={styles.primary}
                disabled={savingJob || saving || !(
                  (canEditJob && draftJob.trim() !== (selected.job_title ?? ''))
                  || (canEditRole && draftRole !== selected.role)
                )}>{savingJob ? 'Guardando…' : 'Guardar cambios'}</button>
            </footer>
          </form>
        </div>
      </div>,
      document.body,
    )}
    {removingMember && createPortal(
      <div className={styles.editorBackdrop} onMouseDown={event => {
        if (event.target === event.currentTarget && !removalBusy) {
          setRemovingMember(null); setRemovalError('')
        }
      }}>
        <div className={styles.removeDialog} role="alertdialog" aria-modal="true"
          aria-labelledby="remove-workspace-member-title" aria-describedby="remove-workspace-member-description">
          <div className={styles.removeDialogHeader}>
            <h2 id="remove-workspace-member-title">Quitar miembro del Workspace</h2>
            <button type="button" className={styles.close} aria-label="Cerrar confirmación"
              disabled={removalBusy} onClick={() => setRemovingMember(null)}>
              <Glyph name="close" size={19}/>
            </button>
          </div>
          <div className={styles.removeDialogBody} id="remove-workspace-member-description">
            <p>¿Quieres retirar a <strong>{removingMember.name}</strong> de <strong>{workspaceName}</strong>?</p>
            <ul>
              <li>Perderá su acceso a este Workspace y sus proyectos.</li>
              <li>Dejará de pertenecer a sus equipos y departamentos.</li>
              <li>Sus tareas y elementos de checklist quedarán sin su asignación, conservando a los demás responsables.</li>
              <li>Su cuenta de Tickard, comentarios e historial seguirán existiendo.</li>
              <li>También se cancelarán las invitaciones pendientes a este Workspace.</li>
            </ul>
            {(removingMember.departments.some(item => item.is_lead)
              || removingMember.teams.some(item => item.is_lead)) && <p className={styles.removeLeadWarning}>
              Es responsable de equipos o departamentos. Quedarán sin responsable hasta que asignes otro desde su ficha.
            </p>}
            {removalError && <p className={styles.removeError} role="alert">{removalError}</p>}
          </div>
          <footer className={styles.editorFooter}>
            <button type="button" className={styles.editorCancel} disabled={removalBusy}
              onClick={() => { setRemovingMember(null); setRemovalError('') }}>Cancelar</button>
            <button type="button" className={styles.removeConfirm} disabled={removalBusy}
              onClick={() => void confirmRemoveMember()}>
              <TrashIcon/>{removalBusy ? 'Retirando…' : 'Quitar miembro'}
            </button>
          </footer>
        </div>
      </div>,
      document.body,
    )}
  </section>
}
