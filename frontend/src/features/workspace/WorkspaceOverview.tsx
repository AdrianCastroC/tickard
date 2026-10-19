import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type Profile, type WorkspaceRef } from '../../api'
import { ProjectContentLoading } from './ProjectContentLoading'
import { DeleteWorkspaceModal } from '../sidebar/WorkspaceSelector/DeleteWorkspaceModal'

type Section = 'members' | 'departments' | 'teams' | 'clients'
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
}

const PLAN_LABEL: Record<WorkspaceRef['plan'], string> = {
  free: 'Free', base: 'Base', pro: 'Pro', business: 'Business',
}

type Props = {
  profile: Profile
  workspaceId: number | null
  onProfileRefresh: () => Promise<unknown>
  onOpenSection: (section: Section) => void
  onDeleted: (workspaceId: number) => Promise<void>
}

export function WorkspaceOverview({ profile, workspaceId, onProfileRefresh, onOpenSection, onDeleted }: Props) {
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [removalOpen, setRemovalOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [removing, setRemoving] = useState(false)
  const [removalError, setRemovalError] = useState('')

  const fetchSummary = useCallback(async () => {
    if (workspaceId === null) throw new Error('No hay un Workspace seleccionado.')
    return api<WorkspaceSummary>('/workspaces/' + workspaceId + '/overview')
  }, [workspaceId])

  useEffect(() => {
    let mounted = true
    setLoading(true); setError(''); setNotice(''); setSummary(null)
    setRemovalOpen(false); setConfirmation('')
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

  const metrics = [
    { key: 'projects', label: 'Proyectos', count: summary.stats.projects },
    ...(summary.can_view_personnel ? [
      { key: 'members', label: 'Miembros', count: summary.stats.members },
      { key: 'departments', label: 'Departamentos', count: summary.stats.departments },
      { key: 'teams', label: 'Equipos', count: summary.stats.teams },
      ...(summary.show_clients ? [{ key: 'clients', label: 'Clientes', count: summary.stats.clients }] : []),
    ] : []),
  ]

  return <section className="workspace-overview workspace-overview-page">
    <header className="workspace-overview-header">
      <div>
        <h1>{summary.name}</h1>
        <p>Vista general del Workspace · Plan {PLAN_LABEL[summary.plan]}</p>
      </div>
      <span className="workspace-overview-role">{summary.role === 'owner' ? 'Propietario' : summary.role === 'admin' ? 'Administrador' : summary.role === 'client' ? 'Cliente' : 'Miembro'}</span>
    </header>

    {error && <p className="workspace-overview-alert" role="alert">{error}</p>}
    {notice && <p className="workspace-overview-notice" role="status">{notice}</p>}

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

    {removalOpen && <DeleteWorkspaceModal workspace={currentWorkspace}
      confirmation={confirmation} onChange={setConfirmation}
      busy={removing} error={removalError}
      onClose={() => { if (!removing) { setRemovalOpen(false); setRemovalError('') } }}
      onConfirm={() => void deleteWorkspace()}/>}
  </section>
}
