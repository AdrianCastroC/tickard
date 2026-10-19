import { useCallback, useEffect, useState } from 'react'
import { api, type Project } from '../../api'
import { ProjectCubeIcon } from '../../shared/icons'
import { ProjectContentLoading } from '../workspace/ProjectContentLoading'

type VisibilityKey = 'description' | 'assignee' | 'due_date' | 'priority' | 'labels' | 'comments'
type ProjectSettingsPayload = {
  id: number
  name: string
  image_url: string | null
  description: string | null
  client_company_id: number | null
  client_access_enabled: boolean
  workspace_clients_enabled: boolean
  clients: { id: number; name: string }[]
  visibility: Record<VisibilityKey, boolean>
}

const VISIBILITY_FIELDS: { key: VisibilityKey; label: string; description: string }[] = [
  { key: 'description', label: 'Descripción', description: 'Contenido y detalles de las tareas' },
  { key: 'assignee', label: 'Personas asignadas', description: 'Responsables que aparecen en las Cards' },
  { key: 'due_date', label: 'Fechas límite', description: 'Plazos previstos de las tareas' },
  { key: 'priority', label: 'Prioridad', description: 'Nivel de prioridad de las Cards' },
  { key: 'labels', label: 'Etiquetas', description: 'Clasificación mediante etiquetas' },
  { key: 'comments', label: 'Comentarios', description: 'Conversaciones y anotaciones de las tareas' },
]

export function ProjectSettings({ project, onRefresh, onDelete }: {
  project: Project
  onRefresh: () => Promise<unknown>
  onDelete: () => void
}) {
  const [settings, setSettings] = useState<ProjectSettingsPayload | null>(null)
  const [draftName, setDraftName] = useState(project.name)
  const [draftDescription, setDraftDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const fetchSettings = useCallback(
    () => api<ProjectSettingsPayload>('/projects/' + project.id + '/settings'),
    [project.id],
  )

  useEffect(() => {
    let active = true
    setSettings(null)
    setDraftName(project.name)
    setLoading(true)
    setError('')
    setNotice('')
    void fetchSettings()
      .then(result => {
        if (active) {
          setSettings(result)
          setDraftName(result.name)
          setDraftDescription(result.description ?? '')
        }
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [fetchSettings, project.id])

  async function save(changes: Record<string, string | number | boolean | null>, message: string) {
    if (!settings || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    let saved = false
    try {
      await api('/projects/' + project.id, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
      saved = true
      const fresh = await fetchSettings()
      setSettings(fresh)
      setDraftName(fresh.name)
      setDraftDescription(fresh.description ?? '')
      // Keep the project header, sidebar, selected company and other tabs up to date.
      await onRefresh()
      setNotice(message)
    } catch (cause) {
      setError(saved
        ? 'Se ha guardado el cambio, pero no se pudo actualizar la vista. Vuelve a cargarla.'
        : cause instanceof Error ? cause.message : 'No se pudo guardar la configuración.')
    } finally {
      setBusy(false)
    }
  }

  async function changeImage(file: File | undefined) {
    if (!file || busy) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
        || file.size > 2 * 1024 * 1024) {
      setError('Elige una imagen JPG, PNG o WebP de hasta 2 MB.')
      return
    }
    const body = new FormData()
    body.append('image', file)
    setBusy(true)
    setError('')
    setNotice('')
    let uploaded = false
    try {
      await api('/projects/' + project.id + '/image', { method: 'POST', body })
      uploaded = true
      setSettings(await fetchSettings())
      await onRefresh()
      setNotice('Logo del proyecto actualizado.')
    } catch (cause) {
      setError(uploaded ? 'Logo guardado, pero no se pudo actualizar la vista. Recarga la página.'
        : cause instanceof Error ? cause.message : 'No se pudo subir el logo.')
    } finally {
      setBusy(false)
    }
  }

  async function removeImage() {
    if (busy || !settings?.image_url) return
    setBusy(true)
    setError('')
    setNotice('')
    let removed = false
    try {
      await api('/projects/' + project.id + '/image', { method: 'DELETE' })
      removed = true
      setSettings(await fetchSettings())
      await onRefresh()
      setNotice('Logo eliminado. Se vuelve a mostrar el icono del proyecto.')
    } catch (cause) {
      setError(removed ? 'Logo eliminado, pero no se pudo actualizar la vista. Recarga la página.'
        : cause instanceof Error ? cause.message : 'No se pudo eliminar el logo.')
    } finally {
      setBusy(false)
    }
  }

  if (!settings) return <section className="project-settings-view">
    {loading
      ? <ProjectContentLoading title="Cargando Configuración" description="Preparando los ajustes del proyecto…">
          <div className="project-settings-loading-skeleton" aria-hidden="true">
            <div/><div/><div/><div/>
          </div>
        </ProjectContentLoading>
      : <div className="project-settings-load-error" role="alert">
          <p>{error || 'No se pudo cargar la configuración.'}</p>
          <button type="button" className="ghost" onClick={() => {
            setLoading(true)
            setError('')
            void fetchSettings().then(result => {
              setSettings(result); setDraftName(result.name)
            }).catch(cause => setError(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.'))
              .finally(() => setLoading(false))
          }}>Reintentar</button>
        </div>}
  </section>

  const companySelected = settings.client_company_id !== null
  return <section className="project-settings-view" aria-label="Configuración del proyecto" aria-busy={busy}>
    {error && <p role="alert" className="project-settings-alert">{error}</p>}
    {notice && <p role="status" className="project-settings-notice">{notice}</p>}

    <div className="project-settings-grid">
      <section className="project-settings-section" aria-labelledby="project-settings-general">
        <div className="project-settings-section-title">
          <h3 id="project-settings-general">General</h3>
          <p>Identificación y organización del proyecto.</p>
        </div>
        <div className="project-settings-logo-editor">
          <div className="project-settings-logo-preview" aria-label={settings.image_url ? 'Logo actual' : 'Sin logo personalizado'}>
            {settings.image_url
              ? <img src={settings.image_url} alt={'Logo de ' + settings.name}/>
              : <ProjectCubeIcon/>}
          </div>
          <div className="project-settings-logo-controls">
            <strong>Logo del proyecto</strong>
            <small>Se muestra en la cabecera, la barra lateral y el resumen del Workspace.</small>
            <div className="project-settings-logo-actions">
              <label className={`project-settings-logo-upload${busy ? ' is-disabled' : ''}`}>
                {busy ? 'Guardando…' : settings.image_url ? 'Cambiar imagen' : 'Subir imagen'}
                <input type="file" accept="image/png,image/jpeg,image/webp"
                  disabled={busy} aria-label="Subir logo del proyecto"
                  onChange={event => {
                    void changeImage(event.currentTarget.files?.[0])
                    event.currentTarget.value = ''
                  }}/>
              </label>
              {settings.image_url && <button type="button" className="ghost" disabled={busy}
                onClick={() => void removeImage()}>Quitar imagen</button>}
            </div>
            <small>JPG, PNG o WebP · máximo 2 MB. Imagen completa, sin recortes.</small>
          </div>
        </div>
        <form className="project-settings-name-form" onSubmit={event => {
          event.preventDefault()
          const name = draftName.trim()
          if (name && name !== settings.name) void save({ name }, 'Nombre del proyecto actualizado.')
        }}>
          <label className="project-settings-field" htmlFor="settings-project-name">
            Nombre del proyecto
          </label>
          <div className="project-settings-name-row">
            <input id="settings-project-name" type="text" required maxLength={120}
              value={draftName} disabled={busy}
              onChange={event => setDraftName(event.target.value)}/>
            <button type="submit" className="primary" disabled={busy || !draftName.trim() || draftName.trim() === settings.name}>
              {busy ? 'Guardando…' : 'Guardar nombre'}
            </button>
          </div>
        </form>
        <form className="project-settings-name-form" onSubmit={event => {
          event.preventDefault()
          if (draftDescription.trim() !== (settings.description ?? '')) {
            void save({description: draftDescription.trim() || null}, 'Descripción general actualizada.')
          }
        }}>
          <label className="project-settings-field" htmlFor="settings-project-description">Descripción general</label>
          <textarea id="settings-project-description" maxLength={2000} rows={3}
            placeholder="Describe el objetivo del proyecto…"
            disabled={busy} value={draftDescription} onChange={event => setDraftDescription(event.target.value)}/>
          <button type="submit" className="primary"
            disabled={busy || draftDescription.trim() === (settings.description ?? '')}>Guardar descripción</button>
        </form>
        <p className="project-settings-hint">Los miembros y sus permisos se administran desde la pestaña Personal del proyecto.</p>
      </section>

      <section className="project-settings-section" aria-labelledby="project-settings-clients">
        <div className="project-settings-section-title">
          <h3 id="project-settings-clients">Acceso de clientes</h3>
          <p>Controla si una empresa externa puede acceder al proyecto.</p>
        </div>
        {settings.workspace_clients_enabled
          ? <>
              <label className="project-settings-field">Empresa cliente
                <select value={settings.client_company_id ?? ''} disabled={busy || settings.client_access_enabled}
                  onChange={event => void save({
                    client_company_id: event.target.value ? Number(event.target.value) : null,
                  }, 'Empresa cliente actualizada.')}>
                  <option value="">Sin empresa cliente</option>
                  {settings.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </label>
              <label className="project-settings-toggle">
                <span><strong>Permitir acceso externo</strong>
                  <small>Solo a personas autorizadas de la empresa seleccionada y con permisos de proyecto.</small>
                </span>
                <input type="checkbox" checked={settings.client_access_enabled}
                  disabled={busy || !companySelected}
                  onChange={event => void save({
                    client_access_enabled: event.target.checked,
                  }, event.target.checked ? 'Acceso de clientes habilitado.' : 'Acceso de clientes deshabilitado.')}/>
              </label>
              {settings.client_access_enabled && <p className="project-settings-hint">
                Desactiva el acceso externo antes de cambiar la empresa asociada.
              </p>}
              {!companySelected && <p className="project-settings-hint">
                Selecciona primero una empresa para habilitar el acceso externo.
              </p>}
            </>
          : <p className="project-settings-hint">El módulo Clientes está desactivado en este Workspace.
              Puedes activarlo desde la configuración del Workspace.</p>}
      </section>

      <section className="project-settings-section project-settings-wide" aria-labelledby="project-settings-visibility">
        <div className="project-settings-section-title">
          <h3 id="project-settings-visibility">Visibilidad para clientes</h3>
          <p>Decide qué campos de las Cards públicas pueden ver las cuentas cliente. Se aplica a todos los tableros del proyecto.</p>
        </div>
        <div className="project-settings-visibility">
          {VISIBILITY_FIELDS.map(field => <label key={field.key} className="project-settings-toggle">
            <span><strong>{field.label}</strong><small>{field.description}</small></span>
            <input type="checkbox" checked={settings.visibility[field.key]} disabled={busy}
              onChange={event => void save({
                ['show_' + field.key]: event.target.checked,
              }, 'Visibilidad de ' + field.label.toLowerCase() + ' actualizada.')}/>
          </label>)}
        </div>
        <p className="project-settings-hint">Estos ajustes no conceden acceso por sí mismos ni afectan a la información interna del equipo.</p>
      </section>

      <section className="project-settings-section project-settings-wide project-settings-danger" aria-labelledby="project-settings-danger">
        <div className="project-settings-section-title">
          <h3 id="project-settings-danger">Zona de peligro</h3>
          <p>La eliminación borra el proyecto y sus tableros, Cards y archivos asociados. Esta acción requiere confirmar el nombre del proyecto.</p>
        </div>
        <button type="button" className="danger" disabled={busy} onClick={onDelete}>Eliminar proyecto</button>
      </section>
    </div>
  </section>
}
