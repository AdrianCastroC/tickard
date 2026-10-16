import { useEffect, useState, type FormEvent } from 'react'
import { api, type Profile, type Project } from '../../../api'
import { NavIcon, PlusIcon } from '../../../shared/icons'
import { ProjectItem } from './ProjectItem'

type Props = { profile: Profile; workspaceId: number | null; mini: boolean; onOpenProject: (project: Project) => void; onProjectsChanged: () => Promise<Profile> }

export function ProjectsSection({ profile, workspaceId, mini, onOpenProject, onProjectsChanged }: Props) {
  const [open, setOpen] = useState(true)
  const [newProject, setNewProject] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const workspaceClientsEnabled = profile.workspaces.some(w => w.id === workspaceId && w.show_clients)
  const [clients, setClients] = useState<{id:number;name:string}[]>([])
  useEffect(() => {
    if (!newProject || !workspaceClientsEnabled || !workspaceId) return
    let active = true
    void api<{clients:{id:number;name:string}[]}>(`/clients?workspace_id=${workspaceId}`)
      .then(result => { if (active) setClients(result.clients.map(c => ({id:c.id,name:c.name}))) })
      .catch(() => { if (active) setClients([]) })
    return () => { active = false }
  }, [newProject, workspaceId, workspaceClientsEnabled])

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const clientId = Number(form.get('client_company_id')) || null
    const clientAccess = form.get('client_access_enabled') === 'on' && clientId !== null
    if (!name || saving) return
    setSaving(true)
    try {
      const created = await api<Project>('/projects', { method: 'POST', body: JSON.stringify({ workspace_id: workspaceId, name, client_company_id: workspaceClientsEnabled ? clientId : null, client_access_enabled: workspaceClientsEnabled && clientAccess }) })
      const data = await onProjectsChanged()
      setNewProject(false)
      onOpenProject(data.projects.find((project) => project.id === created.id) ?? created)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear el proyecto.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <button type="button" className="nav-item side-section-toggle" title="Proyectos" onClick={() => setOpen((current) => !current)}><NavIcon><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 0 2 2v2" /><circle cx="14" cy="15" r="1" /></NavIcon><span className="side-label-text">Proyectos</span><span className={`side-section-chevron${open ? ' open' : ''}`}>›</span></button>
    {open && <><span className="mini-section-indicator" aria-hidden="true" /><div className="projects">{profile.projects.map((project) => <ProjectItem key={project.id} project={project} onOpen={() => onOpenProject(project)} />)}{profile.projects.length === 0 && <p className="muted side-label-text">Todavía no hay proyectos.</p>}{profile.user.is_admin && !newProject && <button className="add-project" type="button" title="Nuevo proyecto" onClick={() => setNewProject(true)}><PlusIcon /><span className="side-label-text">Nuevo proyecto</span></button>}</div>{profile.user.is_admin && newProject && !mini && <form onSubmit={createProject} className="field" noValidate><input name="name" placeholder="Nombre del proyecto" />{workspaceClientsEnabled && <><select name="client_company_id" defaultValue="" aria-label="Empresa cliente (opcional)">
      <option value="">Sin empresa cliente</option>
      {clients.map(client => <option value={client.id} key={client.id}>{client.name}</option>)}
    </select><label><input type="checkbox" name="client_access_enabled"/> Permitir acceso de clientes</label></>}<div className="row"><button className="primary" type="submit" disabled={saving}>Crear</button><button className="ghost" type="button" onClick={() => setNewProject(false)}>Cancelar</button></div></form>}{error && <p className="error">{error}</p>}</>}
  </>
}
