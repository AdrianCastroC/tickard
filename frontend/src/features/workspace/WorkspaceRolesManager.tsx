import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../api'

type Scope = 'workspace' | 'project'
type Role = { id: number; scope: Scope; name: string; description: string | null; permissions: string[] }
type Result = { can_manage: boolean; permissions: Record<Scope, string[]>; roles: Role[] }
const LABELS: Record<string, string> = {
  'workspace.view': 'Ver Workspace', 'workspace.manage': 'Configurar Workspace',
  'workspace.members': 'Administrar miembros', 'workspace.projects': 'Gestionar proyectos',
  'workspace.clients': 'Gestionar clientes', 'workspace.teams': 'Gestionar equipos',
  'workspace.departments': 'Gestionar departamentos',
  'project.view': 'Ver proyecto', 'project.manage': 'Configurar proyecto',
  'project.delete': 'Eliminar proyecto',
  'project.members': 'Gestionar personal', 'boards.manage': 'Gestionar tableros',
  'cards.edit': 'Crear y editar Cards', 'cards.comment': 'Comentar Cards',
  'files.upload': 'Subir archivos',
}
export function WorkspaceRolesManager({ workspaceId }: { workspaceId: number }) {
  const [data, setData] = useState<Result | null>(null)
  const [scope, setScope] = useState<Scope>('project')
  const [selected, setSelected] = useState<number | 'new' | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<string[]>(['project.view'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    setData(null); setSelected(null)
    void api<Result>(`/workspaces/${workspaceId}/roles`)
      .then(next => { if (active) setData(next) })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'No se pudieron cargar los roles.') })
    return () => { active = false }
  }, [workspaceId])
  function edit(role?: Role) {
    const nextScope = role?.scope ?? scope
    setScope(nextScope)
    setSelected(role?.id ?? 'new')
    setName(role?.name ?? '')
    setDescription(role?.description ?? '')
    setPermissions(role?.permissions ?? [nextScope === 'project' ? 'project.view' : 'workspace.view'])
    setError(''); setNotice('')
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data || busy || !selected) return
    setBusy(true); setError(''); setNotice('')
    try {
      const url = selected === 'new' ? `/workspaces/${workspaceId}/roles`
        : `/workspaces/${workspaceId}/roles/${selected}`
      const updated = await api<Role>(url, { method: selected === 'new' ? 'POST' : 'PATCH',
        body: JSON.stringify({ ...(selected === 'new' ? { scope } : {}), name: name.trim(), description: description.trim(), permissions }) })
      setData(old => old && ({ ...old, roles: [...old.roles.filter(role => role.id !== updated.id), updated].sort((a,b) => a.name.localeCompare(b.name)) }))
      setSelected(null); setNotice('Rol guardado.')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el rol.') }
    finally { setBusy(false) }
  }
  async function remove(role: Role) {
    if (busy || !window.confirm(`¿Eliminar el rol «${role.name}»?`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api(`/workspaces/${workspaceId}/roles/${role.id}`, { method: 'DELETE' })
      setData(old => old && ({ ...old, roles: old.roles.filter(item => item.id !== role.id) }))
      setSelected(null); setNotice('Rol eliminado.')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar el rol.') }
    finally { setBusy(false) }
  }
  if (!data) return <p className="workspace-overview-hint" role="status">{error || 'Cargando roles y permisos…'}</p>
  return <div className="tickard-roles">
    <div className="tickard-roles-tabs" role="group" aria-label="Ámbito de los roles">
      <button type="button" className={scope === 'project' ? 'on' : ''} onClick={() => {setScope('project');setSelected(null)}}>Proyecto</button>
      <button type="button" className={scope === 'workspace' ? 'on' : ''} onClick={() => {setScope('workspace');setSelected(null)}}>Workspace</button>
    </div>
    <p className="workspace-overview-hint">Los permisos personalizados pertenecen únicamente a este Workspace. El Owner conserva siempre el control. El acceso de clientes se gestiona por separado.</p>
    {data.roles.filter(role => role.scope === scope).map(role =>
      <div className="tickard-role-item" key={role.id}>
        <div><strong>{role.name}</strong><small>{role.description || `${role.permissions.length} permisos`}</small></div>
        {data.can_manage && <div className="tickard-role-actions">
          <button type="button" className="ghost" onClick={() => edit(role)}>Editar</button>
          <button type="button" className="ghost" disabled={busy} onClick={() => void remove(role)}>Eliminar</button>
        </div>}
      </div>)}
    {!data.roles.some(role => role.scope === scope) && <p className="workspace-overview-hint">Todavía no hay roles personalizados.</p>}
    {data.can_manage && <button type="button" className="ghost" onClick={() => edit()}>+ Crear rol</button>}
    {selected !== null && <form className="tickard-role-form" onSubmit={event => void save(event)}>
      <label>Nombre del rol<input required maxLength={80} minLength={2} value={name} disabled={busy}
        onChange={event => setName(event.target.value)}/></label>
      <label>Descripción<input maxLength={255} value={description} disabled={busy}
        onChange={event => setDescription(event.target.value)}/></label>
      <strong>Permisos</strong>
      <div className="tickard-role-permissions">{data.permissions[scope].map(permission =>
        <label key={permission} className="project-settings-toggle">
          <span><strong>{LABELS[permission] || permission}</strong></span>
          <input type="checkbox" disabled={busy || permission === (scope === 'project' ? 'project.view' : 'workspace.view')}
            checked={permissions.includes(permission)}
            onChange={event => setPermissions(old => event.target.checked ? [...old, permission] : old.filter(p => p !== permission))}/>
        </label>)}</div>
      <div className="tickard-role-actions"><button type="button" className="ghost" onClick={() => setSelected(null)} disabled={busy}>Cancelar</button>
        <button type="submit" className="primary" disabled={busy || !name.trim()}>{busy ? 'Guardando…' : 'Guardar rol'}</button></div>
    </form>}
    {error && <p role="alert" className="workspace-overview-alert">{error}</p>}
    {notice && <p role="status" className="workspace-overview-notice">{notice}</p>}
  </div>
}
