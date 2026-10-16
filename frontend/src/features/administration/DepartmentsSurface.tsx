import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api'
import { Avatar, formatDateLong } from '../../shared/ui'
import { EditIcon, FilterFunnelIcon, FloppyIcon, PlusIcon, TrashIcon } from '../../shared/icons'
import styles from './DepartmentsDashboard.module.css'
import { AdministrationLoading } from './AdministrationLoading'
import { EntityAppearanceEditor, EntityVisual } from './EntityAppearanceEditor'
import { MemberRoster } from './MemberRoster'
import { AssociationRoster } from './AssociationRoster'

type Person = { id: number; name: string; avatar_url: string | null }
type Linked = { id: number; name: string }
type TeamOption = Linked & { members_count: number }
type IconName = 'layers' | 'code' | 'palette' | 'megaphone' | 'settings' | 'chart' | 'users' | 'box'
type Department = {
  id: number; name: string; description: string | null; status: 'active' | 'inactive'
  icon: IconName; image_url: string | null; lead_user_id: number | null
  created_at: string | null; updated_at: string | null
  members: Person[]; teams: Linked[]; projects: Linked[]
}
type Data = { can_manage: boolean; departments: Department[]; people: Person[]; teams: TeamOption[]; projects: Linked[] }
type PanelTab = 'summary' | 'members' | 'teams' | 'projects'
type Sort = 'name' | 'members' | 'recent'
type Editor = 'create' | 'edit' | null
type Mark = IconName | 'folder' | 'search' | 'grid' | 'list' | 'check' | 'calendar'

const icons: IconName[] = ['layers', 'code', 'palette', 'megaphone', 'settings', 'chart', 'users', 'box']
const iconNames: Record<IconName, string> = {
  layers: 'Capas', code: 'Desarrollo', palette: 'Diseño', megaphone: 'Marketing',
  settings: 'Operaciones', chart: 'Ventas', users: 'Personas', box: 'General',
}
const tones = ['mint', 'blue', 'purple', 'orange', 'rose', 'teal'] as const
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })
const tabs: { id: PanelTab; label: string }[] = [
  { id: 'summary', label: 'Resumen' }, { id: 'teams', label: 'Equipos' },
  { id: 'members', label: 'Miembros' }, { id: 'projects', label: 'Proyectos' },
]

function Glyph({ name, size = 19 }: { name: Mark; size?: number }) {
  const paths: Record<Mark, ReactNode> = {
    layers: <><path d="m12 2-9 5 9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    code: <><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 2-2c0-1-1-1.6-1-2.4 0-1 1-1.6 2-1.6h2a4 4 0 0 0 4-4 9 9 0 0 0-10-8Z"/><path d="M7 10h.01M11 7h.01M16 8h.01M7 15h.01"/></>,
    megaphone: <><path d="M3 10v4a1 1 0 0 0 1 1h3l3 5h3l-3-5 10 4V5L10 9H4a1 1 0 0 0-1 1Z"/><path d="M21 9a4 4 0 0 1 0 6"/></>,
    settings: <><path d="m10 2-.5 3-2 1-2.6-1.6-2 3.5 2.3 2v2l-2.3 2 2 3.5L7.5 16l2 1 .5 3h4l.5-3 2-1 2.6 1.6 2-3.5-2.3-2v-2l2.3-2-2-3.5L16.5 6l-2-1-.5-3Z"/><circle cx="12" cy="11" r="3"/></>,
    chart: <><path d="M4 20V12h4v8M10 20V8h4v12M16 20V3h4v17M3 20h18"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2H2ZM16 5a3 3 0 0 1 0 6M16 15a5 5 0 0 1 6 5"/></>,
    box: <><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="m3 7 9 5 9-5M12 12v10"/></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    list: <><path d="M9 5h12M9 12h12M9 19h12"/><path d="M4 5h.01M4 12h.01M4 19h.01"/></>,
    check: <path d="m4 12 5 5L20 6"/>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18"/></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function AvatarStack({ people, max = 5 }: { people: Person[]; max?: number }) {
  if (!people.length) return <span className={styles.noPeople}>Sin miembros</span>
  return <div className={`${styles.avatars} ${styles.departmentAvatars}`} aria-label={people.map(p => p.name).join(', ')}>
    {people.slice(0, max).map(person => <Avatar key={person.id} id={person.id}
      name={person.name} src={person.avatar_url} size={30} className={styles.avatar}/>)}
    {people.length > max && <span className={styles.avatarMore}>+{people.length - max}</span>}
  </div>
}

function Stat({ icon, title, value, detail, tone }: {
  icon: Mark; title: string; value: number; detail: string; tone: string
}) {
  return <div className={styles.stat}>
    <span className={styles.statIcon} data-tone={tone}><Glyph name={icon} size={22}/></span>
    <div><strong>{value}</strong><span>{title}</span><small>{detail}</small></div>
  </div>
}

export function DepartmentsSurface({ workspaceId }: { workspaceId: number | null }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState<Sort>('name')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterContainerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<PanelTab>('summary')
  const [editor, setEditor] = useState<Editor>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [icon, setIcon] = useState<IconName>('layers')
  const [memberIds, setMemberIds] = useState<number[]>([])
  const [teamIds, setTeamIds] = useState<number[]>([])
  const [projectIds, setProjectIds] = useState<number[]>([])
  const [leadId, setLeadId] = useState<number | null>(null)
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [imageError, setImageError] = useState('')
  const [imageBusy, setImageBusy] = useState(false)

  const path = '/departments?workspace_id=' + workspaceId
  const load = useCallback(async () => {
    if (!workspaceId) return
    const response = await api<Data>(path)
    setData(response)
    setSelectedId(id => response.departments.some(dep => dep.id === id) ? id : response.departments[0]?.id ?? null)
  }, [workspaceId, path])

  useEffect(() => {
    let active = true
    setLoading(true); setLoadError(''); setData(null); setSelectedId(null); setEditor(null)
    if (!workspaceId) { setLoading(false); return }
    void api<Data>(path).then(result => {
      if (active) { setData(result); setSelectedId(result.departments[0]?.id ?? null) }
    }).catch(cause => {
      if (active) setLoadError(cause instanceof Error ? cause.message : 'No se pudieron cargar los departamentos.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [workspaceId, path])

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es')
    const rows = (data?.departments ?? []).filter(dep =>
      (statusFilter === 'all' || dep.status === statusFilter) &&
      (!query || dep.name.toLocaleLowerCase('es').includes(query) ||
        dep.description?.toLocaleLowerCase('es').includes(query) ||
        dep.members.some(person => person.name.toLocaleLowerCase('es').includes(query))))
    return rows.sort((a, b) =>
      sort === 'members' ? b.members.length - a.members.length || collator.compare(a.name, b.name) :
      sort === 'recent' ? (b.created_at ?? '').localeCompare(a.created_at ?? '') :
      collator.compare(a.name, b.name))
  }, [data, search, statusFilter, sort])

  const stats = useMemo(() => {
    const departments = data?.departments ?? []
    return {
      people: new Set(departments.flatMap(dep => dep.members.map(person => person.id))).size,
      teams: new Set(departments.flatMap(dep => dep.teams.map(item => item.id))).size,
      projects: new Set(departments.flatMap(dep => dep.projects.map(item => item.id))).size,
      active: departments.filter(dep => dep.status === 'active').length,
    }
  }, [data])
  const activeFilterCount = Number(statusFilter !== 'all') + Number(sort !== 'name')
  useEffect(() => {
    if (!filtersOpen) return
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !filterContainerRef.current?.contains(event.target)) {
        setFiltersOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [filtersOpen])

  const selected = data?.departments.find(dep => dep.id === selectedId) ?? null
  const canManage = data?.can_manage === true
  const lead = selected?.members.find(person => person.id === selected.lead_user_id)

  function choose(dep: Department) {
    setSelectedId(dep.id); setEditor(null); setActiveTab('summary')
    setError(''); setNotice('')
  }
  function beginCreate() {
    setEditor('create'); setName(''); setDescription(''); setStatus('active'); setIcon('layers')
    setMemberIds([]); setTeamIds([]); setProjectIds([]); setLeadId(null)
    setPendingImage(null); setImageError('')
    setError(''); setNotice(''); setFiltersOpen(false)
  }
  function beginEdit(dep: Department) {
    setSelectedId(dep.id); setEditor('edit'); setName(dep.name); setDescription(dep.description ?? '')
    setStatus(dep.status); setIcon(dep.icon ?? 'layers')
    setMemberIds(dep.members.map(person => person.id))
    setTeamIds(dep.teams.map(item => item.id))
    setProjectIds(dep.projects.map(item => item.id))
    setLeadId(dep.lead_user_id); setPendingImage(null); setImageError('')
    setError(''); setNotice('')
  }
  function toggle(ids: number[], set: (ids: number[]) => void, id: number, checked: boolean) {
    set(checked ? [...ids, id] : ids.filter(item => item !== id))
    if (!checked && ids === memberIds && leadId === id) setLeadId(null)
  }

  async function updateLinks(values: { member_ids?: number[]; lead_user_id?: number; team_ids?: number[]; project_ids?: number[] }) {
    if (!workspaceId || !selected || !canManage || busy) return
    setBusy(true); setError('')
    try {
      await api('/departments/' + selected.id, {
        method: 'PATCH',
        body: JSON.stringify({
          workspace_id: workspaceId, name: selected.name,
          description: selected.description, status: selected.status, icon: selected.icon,
          member_ids: values.member_ids ?? selected.members.map(person => person.id),
          lead_user_id: values.lead_user_id ?? selected.lead_user_id,
          team_ids: values.team_ids ?? selected.teams.map(team => team.id),
          project_ids: values.project_ids ?? selected.projects.map(project => project.id),
        }),
      })
      await load()
      setNotice('Vinculaciones actualizadas.')
    } catch (cause) {
      throw cause
    } finally { setBusy(false) }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!workspaceId || !canManage || busy || !name.trim() || imageBusy) return
    if (editor === 'create' && (!leadId || !memberIds.includes(leadId))) {
      setError('Selecciona un responsable entre los miembros del departamento.'); return
    }
    setBusy(true); setError(''); setNotice('')
    try {
      const payload = {
        workspace_id: workspaceId, name: name.trim(), description: description.trim() || null,
        status, icon,
        member_ids: editor === 'create' ? memberIds : selected?.members.map(person => person.id) ?? [],
        lead_user_id: editor === 'create' ? leadId : selected?.lead_user_id,
        team_ids: editor === 'create' ? teamIds : selected?.teams.map(item => item.id) ?? [],
        project_ids: editor === 'create' ? projectIds : selected?.projects.map(item => item.id) ?? [],
      }
      const created = editor === 'create' ? await api<{ id: number }>('/departments', {
        method: 'POST', body: JSON.stringify(payload),
      }) : null
      if (editor === 'edit' && selectedId) {
        await api('/departments/' + selectedId, { method: 'PATCH', body: JSON.stringify(payload) })
      }
      const entityId = created?.id ?? selectedId
      if (pendingImage && entityId) {
        const form = new FormData()
        form.append('workspace_id', String(workspaceId))
        form.append('image', pendingImage)
        await api('/departments/' + entityId + '/image', { method: 'POST', body: form })
      }
      setPendingImage(null)
      await load()
      setSelectedId(entityId)
      setEditor(null); setActiveTab('summary')
      setNotice(created ? 'Departamento creado.' : 'Cambios guardados.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el departamento.')
    } finally { setBusy(false) }
  }
  async function remove() {
    if (!workspaceId || !canManage || !selected || busy) return
    setBusy(true); setError('')
    try {
      await api('/departments/' + selected.id, {
        method: 'DELETE', body: JSON.stringify({ workspace_id: workspaceId }),
      })
      setConfirmDelete(false); setEditor(null)
      await load()
      setNotice('Departamento eliminado. Sus integrantes, equipos y proyectos siguen existiendo.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el departamento.')
      setConfirmDelete(false)
    } finally { setBusy(false) }
  }

  if (!workspaceId) return <section className={styles.root}><p>Selecciona un Workspace.</p></section>

  return <section className={styles.root} aria-label="Gestión de departamentos">
    <header className={styles.heading}>
      <div>
        <h1>Departamentos</h1>
        <p>Gestiona los departamentos de tu organización</p>
        {notice && <div role="status" className={styles.notice}>{notice}</div>}
        {loadError && <div role="alert" className={styles.alert}>{loadError}
          <button type="button" onClick={() => { setLoading(true); setLoadError(''); void load()
            .catch(cause => setLoadError(cause instanceof Error ? cause.message : 'Error de carga.'))
            .finally(() => setLoading(false)) }}>Reintentar</button>
        </div>}
      </div>
    </header>
    {loading ? <AdministrationLoading section="departments"/> : data && <>
      <div className={styles.stats}>
        <Stat icon="users" title="Departamentos" value={data.departments.length}
          detail={stats.active + ' activos · ' + (data.departments.length - stats.active) + ' inactivos'} tone="mint"/>
        <Stat icon="users" title="Miembros" value={stats.people} detail="asignados a departamentos" tone="blue"/>
        <Stat icon="layers" title="Equipos" value={stats.teams} detail="vinculados" tone="purple"/>
        <Stat icon="folder" title="Proyectos" value={stats.projects} detail="vinculados" tone="orange"/>
      </div>
      <div className={styles.workspace}>
        <div className={styles.mainColumn}>
          <div className={styles.filters}>
            <label className={styles.search}><Glyph name="search" size={17}/>
              <input type="search" value={search} onChange={event => setSearch(event.target.value)}
                placeholder="Buscar departamentos…" aria-label="Buscar departamentos"/>
            </label>
            <div className={styles.filterControls} ref={filterContainerRef}>
              <button type="button"
                className={`icon-button board-filter-trigger ${styles.filterTrigger}${filtersOpen || activeFilterCount ? ' on' : ''}`}
                title="Filtros" aria-label={activeFilterCount ? `Filtros: ${activeFilterCount} activos` : 'Filtros de departamentos'}
                aria-haspopup="dialog" aria-expanded={filtersOpen}
                aria-controls={filtersOpen ? 'departments-filters-popover' : undefined}
                onClick={() => setFiltersOpen(open => !open)}>
                <FilterFunnelIcon/>
                {activeFilterCount > 0 && <span className="board-filter-active-dot" aria-hidden="true"/>}
              </button>
              {filtersOpen && <div id="departments-filters-popover" className={styles.filterPopover}
                role="dialog" aria-label="Filtros de departamentos">
                <div className={styles.filterPopoverHeader}>
                  <strong>Filtros</strong>
                  {activeFilterCount > 0 && <button type="button" onClick={() => {
                    setStatusFilter('all'); setSort('name')
                  }}>Limpiar</button>}
                </div>
                <label>Estado
                  <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                    <option value="all">Todos</option>
                    <option value="active">Activos</option>
                    <option value="inactive">Inactivos</option>
                  </select>
                </label>
                <label>Ordenar por
                  <select value={sort} onChange={event => setSort(event.target.value as Sort)}>
                    <option value="name">Nombre</option>
                    <option value="members">Más miembros</option>
                    <option value="recent">Más recientes</option>
                  </select>
                </label>
              </div>}
            </div>
            <div className={styles.viewSwitcher} role="group" aria-label="Vista de departamentos">
              <button type="button" aria-label="Vista de tarjetas" aria-pressed={layout === 'grid'}
                className={layout === 'grid' ? styles.viewActive : undefined} onClick={() => setLayout('grid')}>
                <Glyph name="grid" size={16}/></button>
              <button type="button" aria-label="Vista de lista" aria-pressed={layout === 'list'}
                className={layout === 'list' ? styles.viewActive : undefined} onClick={() => setLayout('list')}>
                <Glyph name="list" size={16}/></button>
            </div>
            {canManage && <button type="button" className={styles.primary} onClick={beginCreate}>
              <PlusIcon/> Nuevo departamento
            </button>}
          </div>
          <div className={styles.cardScroller}>
            <div className={layout === 'grid' ? styles.cards : styles.cardsList}>
              {visible.map((dep, i) => <article key={dep.id} className={styles.departmentCard}
                data-selected={dep.id === selectedId && editor !== 'create'} data-layout={layout}>
                <div className={styles.cardTop}>
                  <button type="button" className={styles.cardSelect} onClick={() => choose(dep)}
                    aria-label={'Abrir departamento ' + dep.name}>
                    <span className={styles.cardIcon} data-tone={tones[i % tones.length]}>
                      <EntityVisual url={dep.image_url}><Glyph name={icons.includes(dep.icon) ? dep.icon : 'layers'} size={25}/></EntityVisual></span>
                    <span className={styles.cardCopy}>
                      <strong>{dep.name}</strong>
                      <span>{dep.description || 'Sin descripción'}</span>
                    </span>
                  </button>
                </div>
                <button className={styles.cardMetrics} type="button" onClick={() => choose(dep)}
                  aria-label={'Ver datos de ' + dep.name}>
                  <span><Glyph name="users" size={15}/><strong>{dep.members.length}</strong><small>Miembros</small></span>
                  <span><Glyph name="layers" size={15}/><strong>{dep.teams.length}</strong><small>Equipos</small></span>
                  <span><Glyph name="folder" size={15}/><strong>{dep.projects.length}</strong><small>Proyectos</small></span>
                </button>
                <div className={styles.cardBottom}>
                  <AvatarStack people={dep.members}/>
                  <span className={styles.status} data-status={dep.status}>
                    <span/>{dep.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </article>)}
            </div>
            {visible.length === 0 && <div className={styles.empty}>
              <Glyph name="layers" size={30}/>
              <strong>{data.departments.length ? 'Sin resultados' : 'No hay departamentos todavía'}</strong>
              <p>{data.departments.length ? 'Prueba otros filtros.' : 'Crea el primer departamento para organizar tu equipo.'}</p>
              {canManage && data.departments.length === 0 && <button type="button" className={styles.primary}
                onClick={beginCreate}><PlusIcon/> Nuevo departamento</button>}
            </div>}
          </div>
        </div>
        <aside className={styles.inspector} aria-label="Detalle del departamento">
          {editor ? <form className={styles.form} onSubmit={save}>
            <div className={styles.formHeading}><strong>{editor === 'create' ? 'Nuevo departamento' : 'Editar departamento'}</strong>
              <button type="button" className={styles.close} onClick={() => { setEditor(null); setError('') }}
                aria-label="Cerrar edición">×</button></div>
            <div className={styles.formScroll}>
              <label className={styles.field}>Nombre
                <input required autoFocus maxLength={80} value={name} onChange={event => setName(event.target.value)}/></label>
              <label className={styles.field}>Descripción
                <textarea rows={3} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)}
                  placeholder="¿A qué se dedica este departamento?"/></label>
              <div className={styles.formRow}>
                <label className={styles.field}>Estado
                  <select value={status} onChange={event => setStatus(event.target.value as 'active' | 'inactive')}>
                    <option value="active">Activo</option><option value="inactive">Inactivo</option>
                  </select></label>

              </div>
              {workspaceId && <EntityAppearanceEditor kind="departments"
                id={editor === 'edit' ? selectedId : null} workspaceId={workspaceId}
                imageUrl={editor === 'edit' ? selected?.image_url ?? null : null}
                icon={icon} icons={icons.map(id => ({ id, label: iconNames[id] }))}
                renderIcon={id => <Glyph name={id as IconName} size={26}/>}
                onIconChange={id => setIcon(id as IconName)}
                pendingImage={pendingImage} onPendingImageChange={setPendingImage}
                onImageChanged={load} error={imageError} onError={setImageError}
                busy={imageBusy} onBusy={setImageBusy}/>}
              {editor === 'create' && <><div className={styles.editorSection}><strong>Miembros <small>({memberIds.length})</small></strong>
                <div className={styles.checkList}>{data.people.map(person => <label key={person.id}>
                  <input type="checkbox" checked={memberIds.includes(person.id)}
                    onChange={event => toggle(memberIds, setMemberIds, person.id, event.target.checked)}/>
                  <Avatar id={person.id} name={person.name} src={person.avatar_url} size={26}/>
                  <span>{person.name}</span>
                </label>)}
                {!data.people.length && <small>No hay miembros internos en este Workspace.</small>}</div>
              </div>
              <label className={styles.field}>Responsable
                <select required value={leadId ?? ''} onChange={event => setLeadId(event.target.value ? Number(event.target.value) : null)}>
                  <option value="">Seleccionar responsable</option>
                  {data.people.filter(person => memberIds.includes(person.id)).map(person =>
                    <option key={person.id} value={person.id}>{person.name}</option>)}
                </select></label>
              <div className={styles.editorSection}><strong>Equipos <small>({teamIds.length})</small></strong>
                <div className={styles.checkList}>{data.teams.map(team => <label key={team.id}>
                  <input type="checkbox" checked={teamIds.includes(team.id)}
                    onChange={event => toggle(teamIds, setTeamIds, team.id, event.target.checked)}/>
                  <Glyph name="layers" size={17}/><span>{team.name}</span>
                </label>)}
                {!data.teams.length && <small>Sin equipos creados.</small>}</div>
              </div>
              <div className={styles.editorSection}><strong>Proyectos <small>({projectIds.length})</small></strong>
                <div className={styles.checkList}>{data.projects.map(project => <label key={project.id}>
                  <input type="checkbox" checked={projectIds.includes(project.id)}
                    onChange={event => toggle(projectIds, setProjectIds, project.id, event.target.checked)}/>
                  <Glyph name="folder" size={17}/><span>{project.name}</span>
                </label>)}
                {!data.projects.length && <small>Sin proyectos en este Workspace.</small>}</div>
              </div>
              <p className={styles.hint}>Agrupar personas, equipos y proyectos no modifica sus permisos de acceso.</p></>}
              {editor === 'edit' && selected && <div className={styles.editDangerZone}>
                <strong>Eliminar departamento</strong>
                <p>Los miembros, equipos y proyectos seguirán existiendo, pero dejarán de estar agrupados aquí.</p>
                <button type="button" className={styles.dangerLink} disabled={busy || imageBusy}
                  onClick={() => setConfirmDelete(true)}><TrashIcon/> Eliminar departamento</button>
              </div>}
            </div>
            {error && <p role="alert" className={styles.formError}>{error}</p>}
            <footer className={styles.formActions}>
              <button className={styles.subtle} type="button" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button>
              <button className={styles.primary} type="submit" disabled={busy || imageBusy || !name.trim() || (editor === 'create' && (!leadId || !memberIds.includes(leadId)))}>
                <FloppyIcon/>{busy ? 'Guardando…' : 'Guardar'}
              </button>
            </footer>
          </form> : selected ? <>
            <div className={styles.detailHead}>
              <span className={styles.detailIcon} data-tone={tones[Math.max(0, data.departments.indexOf(selected)) % tones.length]}>
                <EntityVisual url={selected.image_url}><Glyph name={icons.includes(selected.icon) ? selected.icon : 'layers'} size={24}/></EntityVisual></span>
              <div className={styles.detailTitle}><strong>{selected.name}</strong>
                <p>{selected.description || 'Sin descripción'}</p>
              </div>
              <button type="button" title="Cerrar detalle" aria-label="Cerrar detalle" className={styles.close}
                onClick={() => setSelectedId(null)}>×</button>
            </div>
            <nav className={styles.tabs} aria-label="Secciones del departamento">
              {tabs.map(tab => <button type="button" key={tab.id} aria-current={activeTab === tab.id ? 'page' : undefined}
                className={activeTab === tab.id ? styles.activeTab : undefined}
                onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
            </nav>
            <div className={styles.detailScroll}>
              {activeTab === 'summary' && <>
                <div className={styles.overviewSplit}>
                  <div className={styles.overviewVisual}>
                    <EntityVisual url={selected.image_url} large>
                      <Glyph name={icons.includes(selected.icon) ? selected.icon : 'layers'} size={53}/>
                    </EntityVisual>
                    <small>{selected.image_url ? 'Imagen del departamento' : 'Icono del departamento'}</small>
                  </div>
                  <div className={styles.overviewInfo}>
                <div className={styles.sectionTitle}><strong>Información</strong>
                  {canManage && <button type="button" className={styles.editSmall} onClick={() => beginEdit(selected)}>
                    <EditIcon/> Editar</button>}</div>
                <dl className={styles.info}>
                  <dt>Nombre</dt><dd>{selected.name}</dd>
                  <dt>Descripción</dt><dd>{selected.description || 'Sin descripción'}</dd>
                  <dt>Estado</dt><dd><span className={styles.status} data-status={selected.status}><span/>
                    {selected.status === 'active' ? 'Activo' : 'Inactivo'}</span></dd>
                  <dt>Responsable</dt><dd>{lead?.name ?? 'Sin asignar'}</dd>
                  <dt>Fecha de creación</dt><dd>{formatDateLong(selected.created_at)}</dd>
                  <dt>Última actualización</dt><dd>{formatDateLong(selected.updated_at)}</dd>
                </dl>
                  </div>
                </div>
                <div className={styles.detailGroup}>
                  <div className={styles.groupHeading}><strong>Equipos ({selected.teams.length})</strong>
                    <button type="button" onClick={() => setActiveTab('teams')}>Ver todos</button></div>
                  {selected.teams.slice(0, 4).map(team =>
                    <div className={styles.detailEntry} key={team.id}><Glyph name="layers" size={16}/><span>{team.name}</span></div>)}
                  {!selected.teams.length && <small className={styles.muted}>No hay equipos vinculados</small>}
                </div>
                <div className={styles.detailGroup}>
                  <div className={styles.groupHeading}><strong>Miembros ({selected.members.length})</strong>
                    <button type="button" onClick={() => setActiveTab('members')}>Ver todos</button></div>
                  <AvatarStack people={selected.members}/>
                </div>
                <div className={styles.detailGroup}>
                  <div className={styles.groupHeading}><strong>Proyectos ({selected.projects.length})</strong>
                    <button type="button" onClick={() => setActiveTab('projects')}>Ver todos</button></div>
                  {selected.projects.slice(0, 4).map(project =>
                    <div className={styles.detailEntry} key={project.id}><Glyph name="folder" size={16}/>{project.name}</div>)}
                  {!selected.projects.length && <small className={styles.muted}>No hay proyectos vinculados</small>}
                </div>
              </>}
              {activeTab === 'members' && <div className={styles.detailGroup}>

                <MemberRoster entityId={selected.id} current={selected.members} available={data.people}
                  leadId={selected.lead_user_id} busy={busy} canManage={canManage}
                  onSave={(members, lead) => updateLinks({member_ids:members,lead_user_id:lead})}/>
              </div>}
              {activeTab === 'teams' && <div className={styles.detailGroup}>

                <AssociationRoster entityId={selected.id} label="Equipos" current={selected.teams}
                  available={data.teams} canManage={canManage} busy={busy} renderIcon={() => <Glyph name="layers" size={17}/>}
                  onSave={team_ids => updateLinks({team_ids})}/>
              </div>}
              {activeTab === 'projects' && <div className={styles.detailGroup}>

                <AssociationRoster entityId={selected.id} label="Proyectos" current={selected.projects}
                  available={data.projects} canManage={canManage} busy={busy} renderIcon={() => <Glyph name="folder" size={17}/>}
                  onSave={project_ids => updateLinks({project_ids})}/>
              </div>}
            </div>
          </> : <div className={styles.placeholder}>
            <Glyph name="layers" size={30}/><strong>Selecciona un departamento</strong>
            <p>Consulta sus miembros, equipos y proyectos asociados.</p>
          </div>}
        </aside>
      </div>
    </>}
    {confirmDelete && selected && createPortal(<div className={styles.backdrop} onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) setConfirmDelete(false)
    }}>
      <div className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-dep-title">
        <h2 id="delete-dep-title">Eliminar departamento</h2>
        <p>¿Eliminar «{selected.name}»? Los miembros, equipos y proyectos seguirán existiendo, pero dejarán de estar agrupados en este departamento.</p>
        <div><button type="button" className={styles.subtle} disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</button>
          <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void remove()}>
            {busy ? 'Eliminando…' : 'Eliminar departamento'}</button></div>
      </div>
    </div>, document.body)}
  </section>
}
