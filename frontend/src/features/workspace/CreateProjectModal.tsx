import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api'
import { ProjectCubeIcon } from '../../shared/icons'

type VisibilityKey = 'description' | 'assignee' | 'due_date' | 'priority' | 'labels' | 'comments'
const fields: { key: VisibilityKey; label: string; description: string }[] = [
  { key: 'description', label: 'Descripción', description: 'Detalles de las tareas' },
  { key: 'assignee', label: 'Personas asignadas', description: 'Responsables de las Cards' },
  { key: 'due_date', label: 'Fechas límite', description: 'Plazos previstos' },
  { key: 'priority', label: 'Prioridad', description: 'Prioridad de las Cards' },
  { key: 'labels', label: 'Etiquetas', description: 'Clasificación de tareas' },
  { key: 'comments', label: 'Comentarios', description: 'Conversaciones y anotaciones' },
]
type Client = { id: number; name: string }
type Props = {
  workspaceId: number
  clientsEnabled: boolean
  onCreated: (id: number) => Promise<void>
  onClose: () => void
}
export function CreateProjectModal({ workspaceId, clientsEnabled, onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [clientAccess, setClientAccess] = useState(false)
  const [visibility, setVisibility] = useState<Record<VisibilityKey, boolean>>({
    description: true, assignee: true, due_date: true, priority: true, labels: true, comments: true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clientsError, setClientsError] = useState('')

  useEffect(() => {
    if (!image) { setPreview(null); return }
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])
  useEffect(() => {
    if (!clientsEnabled) return
    let active = true
    void api<{ clients: Client[] }>('/clients?workspace_id=' + workspaceId)
      .then(result => { if (active) setClients(result.clients) })
      .catch(() => { if (active) setClientsError('No se pudieron cargar los clientes.') })
    return () => { active = false }
  }, [workspaceId, clientsEnabled])

  function selectImage(file: File | undefined) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('Selecciona un JPG, PNG o WebP de hasta 2 MB.')
      return
    }
    setImage(file)
    setError('')
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true); setError('')
    try {
      const body = new FormData()
      body.append('workspace_id', String(workspaceId))
      body.append('name', name.trim())
      body.append('description', description.trim())
      if (image) body.append('image', image)
      if (clientsEnabled) {
        if (clientId) body.append('client_company_id', clientId)
        body.append('client_access_enabled', clientAccess ? '1' : '0')
      }
      for (const field of fields) body.append('show_' + field.key, visibility[field.key] ? '1' : '0')
      const created = await api<{ id: number }>('/projects', { method: 'POST', body })
      await onCreated(created.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el proyecto.')
    } finally { setBusy(false) }
  }
  return createPortal(
    <div className="wd-modal-back" onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <div className="wd-modal project-settings-modal" role="dialog" aria-modal="true"
        aria-labelledby="new-project-settings-title">
        <header className="wd-modal-head">
          <h2 id="new-project-settings-title">Nuevo proyecto</h2>
          <button type="button" disabled={busy} aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        <form className="new-project-settings-form" onSubmit={event => void submit(event)}>
          <div className="project-settings-modal-body">
            <div className="project-settings-grid">
              <section className="project-settings-section">
                <div className="project-settings-section-title"><h3>General</h3></div>
                <div className="project-settings-logo-editor">
                  <div className="project-settings-logo-preview">
                    {preview ? <img src={preview} alt="Vista previa del logo"/> : <ProjectCubeIcon/>}
                  </div>
                  <div className="project-settings-logo-controls">
                    <strong>Logo del proyecto</strong>
                    <div className="project-settings-logo-actions">
                      <label className={`project-settings-logo-upload${busy ? ' is-disabled' : ''}`}>
                        {image ? 'Cambiar imagen' : 'Subir imagen'}
                        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
                          onChange={event => { selectImage(event.currentTarget.files?.[0]); event.currentTarget.value = '' }}/>
                      </label>
                      {image && <button type="button" className="ghost" disabled={busy}
                        onClick={() => setImage(null)}>Quitar imagen</button>}
                    </div>
                    <small>JPG, PNG o WebP · máximo 2 MB</small>
                  </div>
                </div>
                <label className="project-settings-field">Nombre del proyecto
                  <input autoFocus required maxLength={120} value={name} disabled={busy}
                    placeholder="Nombre del proyecto" onChange={event => setName(event.target.value)}/>
                </label>
                <label className="project-settings-field">Descripción general
                  <textarea rows={3} maxLength={2000} value={description} disabled={busy}
                    placeholder="Objetivo y alcance del proyecto…" onChange={event => setDescription(event.target.value)}/>
                </label>
              </section>
              {clientsEnabled && <section className="project-settings-section">
                <div className="project-settings-section-title"><h3>Acceso de clientes</h3></div>
                <label className="project-settings-field">Empresa cliente
                  <select disabled={busy || !!clientsError} value={clientId}
                    onChange={event => { setClientId(event.target.value); setClientAccess(false) }}>
                    <option value="">Sin empresa cliente</option>
                    {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </label>
                {clientsError && <p role="alert" className="project-settings-alert">{clientsError}</p>}
                <label className="project-settings-toggle">
                  <span><strong>Permitir acceso externo</strong>
                    <small>Solo miembros autorizados de la empresa seleccionada</small></span>
                  <input type="checkbox" disabled={busy || !clientId} checked={clientAccess}
                    onChange={event => setClientAccess(event.target.checked)}/>
                </label>
              </section>}
              <section className="project-settings-section project-settings-wide">
                <div className="project-settings-section-title"><h3>Visibilidad para clientes</h3>
                  <p>Campos visibles para cuentas cliente con acceso autorizado.</p></div>
                <div className="project-settings-visibility">
                  {fields.map(field => <label key={field.key} className="project-settings-toggle">
                    <span><strong>{field.label}</strong><small>{field.description}</small></span>
                    <input type="checkbox" checked={visibility[field.key]} disabled={busy}
                      onChange={event => setVisibility(current => ({ ...current, [field.key]: event.target.checked }))}/>
                  </label>)}
                </div>
              </section>
            </div>
            {error && <p className="project-settings-alert" role="alert">{error}</p>}
          </div>
          <footer className="wd-modal-footer">
            <button type="button" className="ghost" disabled={busy} onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary" disabled={busy || !name.trim()}>
              {busy ? 'Creando…' : 'Crear proyecto'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  )
}
