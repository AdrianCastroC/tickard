import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { api, type Profile, type WorkspaceRef } from '../../api'
import { ProjectContentLoading } from './ProjectContentLoading'
import { Avatar, formatRelative } from '../../shared/ui'
import { NavIcon } from '../../shared/icons'
import { DeleteWorkspaceModal } from '../sidebar/WorkspaceSelector/DeleteWorkspaceModal'

type Section = 'members' | 'departments' | 'teams' | 'clients'
type DashboardProject = {
  id: number; name: string; description: string | null; total: number; completed: number
  latest_due_date: string | null; member_count: number
  members: { id: number; name: string; avatar_url: string | null }[]
}
type DashboardTask = { id: number; title: string; project_id: number; project_name: string; board_id: number; due_date: string | null; state: string }
type DashboardActivity = { id: number; type: string; user_id: number | null; user_name: string; avatar_url: string | null; created_at: string; card_id: number; card_title: string; board_id: number; project_id: number; project_name: string }
type DashboardEntity = { id: number; name: string; members: number }
type WorkspaceDashboard = {
  cards: { total: number; completed: number }
  projects: DashboardProject[]
  tasks: DashboardTask[]
  activity: DashboardActivity[]
  members: { id: number; name: string; avatar_url: string | null }[]
  teams: DashboardEntity[]
  departments: DashboardEntity[]
  clients: { id: number; name: string; projects: number }[]
}
type WorkspaceSummary = {
  id: number
  name: string
  role: WorkspaceRef['role']
  plan: WorkspaceRef['plan']
  can_manage: boolean
  can_view_personnel: boolean
  can_delete: boolean
  show_birthdays: boolean
  show_clients: boolean
  stats: { projects: number; members: number | null; departments: number | null; teams: number | null; clients: number | null }
  dashboard: WorkspaceDashboard
}

const PLAN_LABEL: Record<WorkspaceRef['plan'], string> = {
  free: 'Free', base: 'Base', pro: 'Pro', business: 'Business',
}

type Props = {
  profile: Profile
  workspaceId: number | null
  onProfileRefresh: () => Promise<unknown>
  onOpenSection: (section: Section) => void
  openProjectList?: boolean
  onProjectListOpened?: () => void
  onOpenProject: (id: number) => void
  onOpenTask: (task: Pick<DashboardTask, 'id' | 'board_id' | 'project_id'>) => void
  onOpenTasks: () => void
  onCreatedProject: (id: number) => Promise<void>
  onInviteMembers: () => void
  onCreateClient: () => void
  onDeleted: (workspaceId: number) => Promise<void>
}

export function WorkspaceOverview({ profile, workspaceId, onProfileRefresh, onOpenSection, openProjectList = false, onProjectListOpened, onOpenProject, onOpenTask, onOpenTasks, onCreatedProject, onInviteMembers, onCreateClient, onDeleted }: Props) {
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null)
  const [mode, setMode] = useState<'dashboard' | 'settings'>('dashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [removalOpen, setRemovalOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [removing, setRemoving] = useState(false)
  const [removalError, setRemovalError] = useState('')
  const [newProject, setNewProject] = useState(false)
  const [allProjectsOpen, setAllProjectsOpen] = useState(false)
  useEffect(() => {
    if (openProjectList) {
      setAllProjectsOpen(true)
      onProjectListOpened?.()
    }
  }, [openProjectList, onProjectListOpened])
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectError, setNewProjectError] = useState('')

  const fetchSummary = useCallback(async () => {
    if (workspaceId === null) throw new Error('No hay un Workspace seleccionado.')
    return api<WorkspaceSummary>('/workspaces/' + workspaceId + '/overview')
  }, [workspaceId])

  useEffect(() => {
    let mounted = true
    setLoading(true); setError(''); setNotice(''); setSummary(null)
    setRemovalOpen(false); setConfirmation(''); setMode('dashboard')
    setNewProject(false); setAllProjectsOpen(false); setNewProjectError('')
    void fetchSummary().then(data => {
      if (!mounted) return
      setSummary(data)
      setDraftName(data.name)
    }).catch(cause => {
      if (mounted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el Workspace.')
    }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [fetchSummary])

  async function save(changes: Record<string, string | boolean>, path: string, success: string) {
    if (!summary || !summary.can_manage || saving) return
    setSaving(true); setError(''); setNotice('')
    let saved = false
    try {
      await api(path, { method: 'PATCH', body: JSON.stringify(changes) })
      saved = true
      const refreshed = await fetchSummary()
      setSummary(refreshed); setDraftName(refreshed.name)
      await onProfileRefresh()
      setNotice(success)
    } catch (cause) {
      setError(saved
        ? 'Se han guardado los cambios, pero no se pudo actualizar la vista. Vuelve a cargarla.'
        : cause instanceof Error ? cause.message : 'No se pudo guardar la configuración.')
    } finally { setSaving(false) }
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!summary) return
    const name = draftName.trim()
    if (!name || name === summary.name) return
    await save({ name }, '/workspaces/' + summary.id, 'Nombre del Workspace actualizado.')
  }

  async function deleteWorkspace() {
    if (!summary || !summary.can_delete || confirmation !== summary.name || removing) return
    setRemoving(true); setRemovalError('')
    try {
      await api('/workspaces/' + summary.id, {
        method: 'DELETE', body: JSON.stringify({ confirmation_name: confirmation }),
      })
      setRemovalOpen(false)
      await onDeleted(summary.id)
    } catch (cause) {
      setRemovalError(cause instanceof Error ? cause.message : 'No se pudo eliminar el Workspace.')
    } finally { setRemoving(false) }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!summary || !summary.can_manage || creatingProject || !projectName.trim()) return
    setCreatingProject(true); setNewProjectError('')
    try {
      const created = await api<{ id: number }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: summary.id,
          name: projectName.trim(), description: projectDescription.trim() || null,
        }),
      })
      await onCreatedProject(created.id)
      setNewProject(false)
      setProjectName(''); setProjectDescription('')
    } catch (cause) {
      setNewProjectError(cause instanceof Error ? cause.message : 'No se pudo crear el proyecto.')
    } finally { setCreatingProject(false) }
  }

  if (!summary) return <section className="workspace-overview workspace-overview-page">
    {loading
      ? <ProjectContentLoading title="Cargando Workspace" description="Preparando el resumen y la configuración del Workspace…">
          <div className="workspace-overview-skeleton" aria-hidden="true">
            <div/><div/><div/><div/><div/><div/>
          </div>
        </ProjectContentLoading>
      : <div className="workspace-overview-load-error" role="alert">
          <p>{error || 'No se pudo cargar el Workspace.'}</p>
          <button type="button" className="ghost" onClick={() => {
            setLoading(true); setError('')
            void fetchSummary().then(data => { setSummary(data); setDraftName(data.name) })
              .catch(cause => setError(cause instanceof Error ? cause.message : 'No se pudo cargar el Workspace.'))
              .finally(() => setLoading(false))
          }}>Reintentar</button>
        </div>}
  </section>

  const currentWorkspace: WorkspaceRef = profile.workspaces.find(item => item.id === summary.id)
    ?? { id: summary.id, name: summary.name, role: summary.role, plan: summary.plan,
      show_birthdays: summary.show_birthdays, show_clients: summary.show_clients }

  const dashboard = summary.dashboard
  const metrics = [
    { key: 'projects', label: 'Proyectos', count: summary.stats.projects, detail: 'En este Workspace', color: 'blue' },
    { key: 'tasks', label: 'Tareas', count: dashboard.cards.total, detail: `${dashboard.cards.total ? Math.round(dashboard.cards.completed * 100 / dashboard.cards.total) : 0}% completadas`, color: 'green' },
    ...(summary.can_view_personnel ? [
      { key: 'members', label: 'Miembros', count: summary.stats.members, detail: 'Personas del Workspace', color: 'purple' },
      { key: 'teams', label: 'Equipos', count: summary.stats.teams, detail: `${summary.stats.departments ?? 0} departamentos`, color: 'orange' },
      ...(summary.show_clients ? [{ key: 'clients', label: 'Clientes', count: summary.stats.clients, detail: 'Empresas registradas', color: 'red' }] : []),
    ] : []),
  ]
  const progress = (completed: number, total: number) => total ? Math.round(100 * completed / total) : 0
  const STATES: Record<string, string> = {
    pending: 'Por hacer', in_progress: 'En progreso', review: 'En revisión',
    done: 'Completado', backlog: 'Backlog',
  }
  const ACTIVITY: Record<string, string> = {
    created: 'creó', commented: 'comentó en', moved: 'movió',
    updated: 'actualizó', assigned: 'asignó', completed: 'completó',
  }
  const formatDue = (date: string | null) => date
    ? new Date(date.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : 'Sin fecha'
  const cardAction = (entry: Pick<DashboardTask, 'id' | 'board_id' | 'project_id'>) =>
    onOpenTask(entry)

  return <section className="workspace-overview workspace-overview-page">
    <header className="wd-header">
      <div className="wd-brand-tile" aria-hidden="true">{summary.name.charAt(0).toUpperCase()}</div>
      <div className="wd-heading">
        <span className="wd-eyebrow">WORKSPACE · PLAN {PLAN_LABEL[summary.plan]}</span>
        <h1>{summary.name}</h1>
        <p>Gestiona tus proyectos, tareas y equipos desde un solo lugar.</p>
      </div>
      {summary.can_manage && <button type="button" className="wd-settings-btn"
        onClick={() => setMode(current => current === 'dashboard' ? 'settings' : 'dashboard')}>
        <NavIcon><path d="M4 7h16M4 17h16M8 4v6M16 14v6"/></NavIcon>
        {mode === 'dashboard' ? 'Configuración' : 'Volver al resumen'}
      </button>}
    </header>

    {error && <p className="workspace-overview-alert" role="alert">{error}</p>}
    {notice && <p className="workspace-overview-notice" role="status">{notice}</p>}

    {mode === 'dashboard' ? <div className="wd-dashboard">
      <div className="wd-content">
      <div className="wd-metrics">
        {metrics.map(metric => <div key={metric.key} className={`wd-metric wd-${metric.color}`}>
          <div className="wd-metric-icon" aria-hidden="true">
            {metric.key === 'projects' ? <NavIcon><path d="M3 7h7l2 3h9v10H3z"/><path d="M3 7V4h7"/></NavIcon>
            : metric.key === 'tasks' ? <NavIcon><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></NavIcon>
            : metric.key === 'members' ? <NavIcon><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m4-13a3 3 0 0 1 0 6m1 7v-2a6 6 0 0 0-3-5"/></NavIcon>
            : metric.key === 'teams' ? <NavIcon><circle cx="8" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m1-6a6 6 0 0 1 7 6"/></NavIcon>
            : <NavIcon><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h6"/></NavIcon>}
          </div>
          <div><strong className="wd-metric-count">{metric.count ?? '—'}</strong>
            <span className="wd-metric-label">{metric.label}</span>
            <small>{metric.detail}</small>
          </div>
          {metric.key === 'tasks' && <div className="wd-mini-progress"><span style={{width: progress(dashboard.cards.completed,dashboard.cards.total)+'%'}}/></div>}
        </div>)}
      </div>
      <div className="wd-primary">
          <section className="wd-panel">
            <header className="wd-panel-head"><h2>Proyectos recientes</h2>
              <div className="wd-project-actions">
                <button type="button" className="wd-project-all"
                  onClick={() => setAllProjectsOpen(true)}>Ver todos →</button>
                {summary.can_manage && <button type="button" className="wd-new-project"
                  onClick={() => { setNewProjectError(''); setProjectName(''); setProjectDescription(''); setNewProject(true) }}>
                  <NavIcon><path d="M12 5v14M5 12h14"/></NavIcon> Nuevo proyecto
                </button>}
              </div>
            </header>
            <div className="wd-projects">
              {dashboard.projects.length ? dashboard.projects.slice(0,4).map((project,i) =>
                <button key={project.id} type="button" className="wd-project" onClick={() => onOpenProject(project.id)}>
                  <span className="wd-project-intro">
                    <span className={`wd-project-logo wd-project-logo-${i%4}`}>
                      <NavIcon><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/></NavIcon>
                    </span>
                    <span className="wd-project-heading">
                      <strong title={project.name}>{project.name}</strong>
                      <small title={project.description ?? undefined}>
                        {project.description || 'Sin descripción general'}
                      </small>
                    </span>
                  </span>
                  <span className="wd-project-progress" aria-label={`Progreso: ${progress(project.completed,project.total)}%`}>
                    <b>{progress(project.completed,project.total)}%</b>
                    <span><i style={{width:progress(project.completed,project.total)+'%'}}/></span>
                  </span>
                  <span className="wd-project-footer">
                    <span className="wd-project-task-count">
                      <NavIcon><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16"/></NavIcon>
                      {project.total} tareas
                    </span>
                    <span className="wd-project-avatars" title={`${project.member_count} miembros`}>
                      {project.members.map(member =>
                        <Avatar key={member.id} id={member.id} name={member.name} src={member.avatar_url} size={24}/>)}
                      {project.member_count > project.members.length &&
                        <span className="wd-project-more">+{project.member_count - project.members.length}</span>}
                      {project.member_count === 0 && <small>Sin miembros</small>}
                    </span>
                    <span className="wd-project-deadline"
                      title="Fecha máxima entre los vencimientos de las tareas del proyecto">
                      <NavIcon><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></NavIcon>
                      {formatDue(project.latest_due_date)}
                    </span>
                  </span>
                </button>
              ) : <p className="wd-empty">Todavía no hay proyectos en este Workspace.</p>}
            </div>
          </section>
          <div className="wd-pair">
            <section className="wd-panel">
              <header className="wd-panel-head"><h2>Tareas del Workspace</h2>
                <button type="button" onClick={onOpenTasks}>Ver mis tareas →</button></header>
              <div className="wd-tasks">
                {dashboard.tasks.length ? dashboard.tasks.map(task =>
                  <button type="button" className="wd-task" key={task.id} onClick={() => cardAction(task)}>
                    <span className="wd-task-check" aria-hidden="true"/>
                    <span className="wd-task-name" title={task.title}>{task.title}</span>
                    <span className="wd-task-project" title={task.project_name}>{task.project_name}</span>
                    <span className={`wd-state wd-state-${task.state}`}>{STATES[task.state] ?? task.state}</span>
                    <span className="wd-task-date">{formatDue(task.due_date)}</span>
                  </button>
                ) : <p className="wd-empty">No hay tareas pendientes que mostrar.</p>}
              </div>
            </section>
            <section className="wd-panel">
              <header className="wd-panel-head"><h2>Actividad reciente</h2></header>
              <div className="wd-activities">
                {dashboard.activity.length ? dashboard.activity.map(item =>
                  <button type="button" className="wd-activity" key={item.id}
                    onClick={() => cardAction({id:item.card_id,board_id:item.board_id,project_id:item.project_id})}>
                    <Avatar id={item.user_id ?? 'sistema'} name={item.user_name} src={item.avatar_url} size={32}/>
                    <span><strong>{item.user_name}</strong> {ACTIVITY[item.type] ?? 'intervino en'} una tarea
                      <small>{item.card_title} · {item.project_name}</small></span>
                    <time>{formatRelative(item.created_at)}</time>
                  </button>
                ) : <p className="wd-empty">Todavía no hay actividad reciente.</p>}
              </div>
            </section>
          </div>
          {summary.can_view_personnel && <div className="wd-pair">
            <section className="wd-panel">
              <header className="wd-panel-head"><h2>Equipos</h2><button type="button" onClick={() => onOpenSection('teams')}>Ver todos →</button></header>
              <div className="wd-entity-grid">
                {dashboard.teams.length ? dashboard.teams.map(team =>
                  <button type="button" className="wd-entity" key={team.id} onClick={() => onOpenSection('teams')}>
                    <span className="wd-entity-icon">⌘</span><strong>{team.name}</strong><small>{team.members} miembros</small>
                  </button>) : <p className="wd-empty">Sin equipos registrados.</p>}
              </div>
            </section>
            <section className="wd-panel">
              <header className="wd-panel-head"><h2>Departamentos</h2><button type="button" onClick={() => onOpenSection('departments')}>Ver todos →</button></header>
              <div className="wd-departments">
                {dashboard.departments.length ? dashboard.departments.map(dept =>
                  <button type="button" className="wd-department" key={dept.id} onClick={() => onOpenSection('departments')}>
                    <span className="wd-entity-icon">▦</span><span><strong>{dept.name}</strong><small>{dept.members} miembros</small></span>
                  </button>) : <p className="wd-empty">Sin departamentos registrados.</p>}
              </div>
            </section>
          </div>}
        </div>
      </div>
      {summary.can_view_personnel && <aside className="wd-rail">
      {summary.can_view_personnel && <section className="wd-panel wd-members-top">
        <header className="wd-panel-head">
          <h2>Miembros del Workspace</h2>
          <button type="button" onClick={() => onOpenSection('members')}>Ver todos →</button>
        </header>
        <div className="wd-avatar-viewport">
          <button type="button" className="wd-avatar-group"
            onClick={() => onOpenSection('members')} aria-label="Ver miembros">
            {dashboard.members.slice(0, 5).map(member =>
              <Avatar key={member.id} id={member.id} name={member.name} src={member.avatar_url} size={38}/>)}
            {(summary.stats.members ?? 0) > Math.min(5, dashboard.members.length) &&
              <span className="wd-extra">+{(summary.stats.members ?? 0) - Math.min(5, dashboard.members.length)}</span>}
          </button>
        </div>
        <div className="wd-rail-list">
          {dashboard.departments.length ? dashboard.departments.slice(0, 3).map((dept, i) =>
            <button type="button" key={dept.id} onClick={() => onOpenSection('departments')}>
              <span className={`wd-dot wd-dot-${i % 5}`}/><span>{dept.name}</span>
              <small>{dept.members} miembros</small>
            </button>) : <p className="wd-empty">Sin departamentos.</p>}
        </div>
        {summary.can_manage && <button type="button" className="wd-panel-add" onClick={onInviteMembers}>
          <NavIcon><path d="M12 5v14M5 12h14"/></NavIcon> Invitar miembros
        </button>}
      </section>}
          {summary.show_clients && <section className="wd-panel">
            <header className="wd-panel-head"><h2>Clientes</h2><button type="button" onClick={() => onOpenSection('clients')}>Ver todos →</button></header>
            <div className="wd-client-list">
              {dashboard.clients.length ? dashboard.clients.map((client,i) =>
                <button type="button" key={client.id} onClick={() => onOpenSection('clients')}>
                  <span className={`wd-client-logo wd-client-logo-${i%4}`}>{client.name.charAt(0).toUpperCase()}</span>
                  <strong>{client.name}</strong>
                  <small>{client.projects} proyectos</small>
                </button>) : <p className="wd-empty">No hay empresas cliente registradas.</p>}
            </div>
            {summary.can_view_personnel && <button type="button" className="wd-panel-add" onClick={onCreateClient}>
              <NavIcon><path d="M12 5v14M5 12h14"/></NavIcon> Añadir cliente
            </button>}
          </section>}
          <section className="wd-panel">
            <header className="wd-panel-head"><h2>Anuncios del Workspace</h2></header>
            <p className="wd-empty">Todavía no hay anuncios publicados. Esta funcionalidad estará disponible próximamente.</p>
          </section>
      </aside>}
    </div> : <>
    <div className="wd-settings-heading"><h2>Configuración del Workspace</h2>
      <button className="ghost" type="button" onClick={() => setMode('dashboard')}>Volver al resumen</button>
    </div>
    <div className="workspace-overview-metrics">
      {metrics.map(metric => <article key={metric.key} className="workspace-overview-metric">
        <span>{metric.label}</span>
        <strong>{metric.count ?? '—'}</strong>
      </article>)}
    </div>

    {summary.can_view_personnel && <section className="workspace-overview-section">
      <div className="workspace-overview-section-title">
        <h2>Organización del personal</h2>
        <p>Accede a las áreas de gestión de este Workspace.</p>
      </div>
      <div className="workspace-overview-shortcuts">
        {(['members', 'departments', 'teams', ...(summary.show_clients ? ['clients'] : [])] as Section[]).map(key => {
          const labels: Record<Section, string> = {
            members: 'Miembros', departments: 'Departamentos', teams: 'Equipos', clients: 'Clientes',
          }
          return <button key={key} type="button" onClick={() => onOpenSection(key)}>
            <span>{labels[key]}</span><span aria-hidden="true">→</span>
          </button>
        })}
      </div>
    </section>}

    {!summary.can_manage && <section className="workspace-overview-section">
      <div className="workspace-overview-section-title">
        <h2>Información del Workspace</h2>
        <p>Los ajustes de administración solo están disponibles para el propietario.</p>
      </div>
      <p className="workspace-overview-hint">Los proyectos a los que tienes acceso aparecen en el menú lateral.</p>
    </section>}

    {summary.can_manage && <>
      <section className="workspace-overview-section">
        <div className="workspace-overview-section-title">
          <h2>Datos generales</h2>
          <p>Identificación del Workspace y nombre que se muestra a sus integrantes.</p>
        </div>
        <form className="workspace-overview-rename" onSubmit={event => void rename(event)}>
          <label htmlFor="workspace-overview-name">Nombre del Workspace</label>
          <div>
            <input id="workspace-overview-name" type="text" value={draftName}
              required maxLength={100} disabled={saving}
              onChange={event => setDraftName(event.target.value)}/>
            <button type="submit" className="primary"
              disabled={saving || !draftName.trim() || draftName.trim() === summary.name}>
              {saving ? 'Guardando…' : 'Guardar nombre'}
            </button>
          </div>
        </form>
      </section>

      <section className="workspace-overview-section">
        <div className="workspace-overview-section-title">
          <h2>Configuración del Workspace</h2>
          <p>Estas preferencias se aplican únicamente a este Workspace.</p>
        </div>
        <div className="workspace-overview-toggles">
          <label className="workspace-birthday-toggle">
            <span><strong>Mostrar cumpleaños</strong>
              <small>Mostrar en los calendarios los cumpleaños que los miembros decidan compartir.</small></span>
            <input type="checkbox" checked={summary.show_birthdays} disabled={saving}
              onChange={event => void save({ show_birthdays: event.target.checked },
                '/workspaces/' + summary.id + '/birthday-settings', 'Configuración de cumpleaños actualizada.')}/>
          </label>
          <label className="workspace-birthday-toggle">
            <span><strong>Habilitar Clientes</strong>
              <small>Permite gestionar empresas cliente. Desactivarlo no elimina empresas, proyectos ni permisos existentes; impide el acceso externo mientras esté desactivado.</small></span>
            <input type="checkbox" checked={summary.show_clients} disabled={saving}
              onChange={event => void save({ show_clients: event.target.checked },
                '/workspaces/' + summary.id + '/client-settings', 'Configuración de clientes actualizada.')}/>
          </label>
        </div>
      </section>

      <section className="workspace-overview-section workspace-overview-danger">
        <div className="workspace-overview-section-title">
          <h2>Zona de peligro</h2>
          <p>Eliminar un Workspace borra sus proyectos, tableros, tareas y datos asociados. Requiere escribir su nombre para confirmar.</p>
        </div>
        <button type="button" className="danger" disabled={!summary.can_delete || saving}
          onClick={() => { setRemovalError(''); setConfirmation(''); setRemovalOpen(true) }}>
          Eliminar Workspace
        </button>
        {!summary.can_delete && <p className="workspace-overview-hint">
          No puedes eliminar tu único Workspace propio. Crea otro antes de eliminar este.
        </p>}
      </section>
    </>}

    </>}
    {allProjectsOpen && createPortal(
      <div className="wd-modal-back" onMouseDown={event => {
        if (event.target === event.currentTarget) setAllProjectsOpen(false)
      }}>
        <div className="wd-modal" role="dialog" aria-modal="true" aria-labelledby="wd-project-list-title">
          <div className="wd-modal-head">
            <h2 id="wd-project-list-title">Proyectos del Workspace</h2>
            <button type="button" aria-label="Cerrar listado" onClick={() => setAllProjectsOpen(false)}>×</button>
          </div>
          <div className="wd-project-list">
            {profile.projects.filter(project => project.workspace_id === summary.id).length > 0
              ? profile.projects.filter(project => project.workspace_id === summary.id).map(project =>
                <button key={project.id} type="button" onClick={() => {
                  setAllProjectsOpen(false); onOpenProject(project.id)
                }}>
                  <NavIcon><rect x="4" y="5" width="16" height="15" rx="2"/>
                    <path d="M7 9h10m-10 4h10"/></NavIcon>
                  <span>{project.name}</span><span aria-hidden="true">→</span>
                </button>)
              : <p className="wd-empty">No tienes proyectos disponibles en este Workspace.</p>}
          </div>
          <div className="wd-modal-footer">
            <button type="button" className="ghost" onClick={() => setAllProjectsOpen(false)}>Cerrar</button>
          </div>
        </div>
      </div>,
      document.body,
    )}
    {newProject && createPortal(
      <div className="wd-modal-back" onMouseDown={event => {
        if (event.target === event.currentTarget && !creatingProject) setNewProject(false)
      }}>
        <div className="wd-modal" role="dialog" aria-modal="true" aria-labelledby="wd-new-project-title">
          <form onSubmit={event => void createProject(event)}>
            <header className="wd-modal-head">
              <h2 id="wd-new-project-title">Nuevo proyecto</h2>
              <button type="button" disabled={creatingProject} onClick={() => setNewProject(false)}
                aria-label="Cerrar">×</button>
            </header>
            <div className="wd-modal-fields">
              <label>Nombre del proyecto
                <input autoFocus required maxLength={120} value={projectName}
                  disabled={creatingProject} placeholder="Nombre del proyecto"
                  onChange={event => setProjectName(event.target.value)}/>
              </label>
              <label>Descripción general (opcional)
                <textarea maxLength={2000} rows={4} value={projectDescription}
                  disabled={creatingProject} placeholder="Objetivo y alcance del proyecto…"
                  onChange={event => setProjectDescription(event.target.value)}/>
              </label>
              {newProjectError && <p role="alert" className="workspace-overview-alert">{newProjectError}</p>}
            </div>
            <footer className="wd-modal-footer">
              <button type="button" className="ghost" disabled={creatingProject}
                onClick={() => setNewProject(false)}>Cancelar</button>
              <button type="submit" className="primary" disabled={creatingProject || !projectName.trim()}>
                {creatingProject ? 'Creando…' : 'Crear proyecto'}
              </button>
            </footer>
          </form>
        </div>
      </div>,
      document.body,
    )}
    {removalOpen && <DeleteWorkspaceModal workspace={currentWorkspace}
      confirmation={confirmation} onChange={setConfirmation}
      busy={removing} error={removalError}
      onClose={() => { if (!removing) { setRemovalOpen(false); setRemovalError('') } }}
      onConfirm={() => void deleteWorkspace()}/>}
  </section>
}
