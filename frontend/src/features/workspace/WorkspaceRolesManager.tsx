import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../api'

type Scope = 'workspace' | 'project' | 'both'
type Role = { id: number; scope: Scope; name: string; description: string | null; permissions: string[]; enabled: boolean }
type Result = { can_manage: boolean; permissions: Record<Scope, string[]>; roles: Role[]; builtin_roles: {key:string;name:string;scope:'workspace'|'project';locked:boolean;enabled:boolean}[] }
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

const GROUPS = [
  { id: 'workspace', name: 'Workspace', description: 'Organización, miembros, equipos y clientes', prefix: 'workspace.' },
  { id: 'project', name: 'Proyectos', description: 'Acceso, configuración y personal del proyecto', prefix: 'project.' },
  { id: 'boards', name: 'Tableros', description: 'Administración de tableros y columnas', prefix: 'boards.' },
  { id: 'cards', name: 'Tareas', description: 'Edición y colaboración en Cards', prefix: 'cards.' },
  { id: 'files', name: 'Archivos', description: 'Archivos y adjuntos del proyecto', prefix: 'files.' },
] as const
const BUILTIN_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  admin: ['workspace.view','workspace.members','workspace.projects','workspace.clients','workspace.teams','workspace.departments'],
  member: ['workspace.view'],
  responsable: ['project.view','project.manage','project.delete','project.members','boards.manage','cards.edit','cards.comment','files.upload'],
  editor: ['project.view','cards.edit','cards.comment','files.upload'],
  lector: ['project.view','cards.comment'],
  cliente: ['project.view','cards.comment'],
}
export function WorkspaceRolesManager({ workspaceId }: { workspaceId: number }) {
  const [data, setData] = useState<Result | null>(null)
  const [scope, setScope] = useState<Scope>('project')
  const [enabled, setEnabled] = useState(true)
  const [selected, setSelected] = useState<number | 'new' | null>(null)
  const [selectedBuiltin, setSelectedBuiltin] = useState<string | null>('owner')
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
    setSelectedBuiltin(null)
    setSelected(role?.id ?? 'new')
    setName(role?.name ?? '')
    setDescription(role?.description ?? '')
    setEnabled(role?.enabled ?? true)
    setPermissions(role?.permissions ?? (nextScope === 'both' ? ['workspace.view', 'project.view'] : [nextScope === 'project' ? 'project.view' : 'workspace.view']))
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
        body: JSON.stringify({ ...(selected === 'new' ? { scope } : {}), name: name.trim(), description: description.trim(), permissions, enabled }) })
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
  async function toggleBuiltin(key: string, next: boolean) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api(`/workspaces/${workspaceId}/roles/builtin/${key}`, {method:'PATCH', body: JSON.stringify({enabled:next})})
      setData(old => old && ({...old,builtin_roles:old.builtin_roles.map(role=>role.key===key?{...role,enabled:next}:role)}))
      setNotice('Disponibilidad del rol actualizada. Las asignaciones existentes se mantienen.')
    } catch (e) {setError(e instanceof Error ? e.message : 'No se pudo actualizar el rol.')}
    finally {setBusy(false)}
  }
  if (!data) return <p className="workspace-overview-hint" role="status">{error || 'Cargando roles y permisos…'}</p>
  return <div className="tickard-roles">
    <div className="tickard-roles-intro"><h3>Roles del Workspace</h3><p>Selecciona un rol para revisar sus permisos y ámbitos de aplicación.</p></div>
    <div className="tickard-roles-workspace">
      <div className="tickard-roles-catalog">
    <strong>Roles preestablecidos</strong>
    {data.builtin_roles.map(role => <div className={`tickard-role-item${selectedBuiltin === role.key ? ' is-selected' : ''}`} key={role.key}>
      <div><button type="button" className="tickard-role-name" onClick={() => {setSelected(null);setSelectedBuiltin(role.key)}}>{role.name}</button><small>{role.scope === 'workspace' ? 'Workspace' : 'Proyecto'} · {role.locked ? 'Protegido' : role.enabled ? 'Activo' : 'Inactivo'}</small></div>
      {data.can_manage && <label className="tickard-role-availability">
        <span>{role.enabled ? 'Activo' : 'Inactivo'}</span>
        <input type="checkbox" checked={role.enabled} disabled={role.locked || busy}
          onChange={event => void toggleBuiltin(role.key, event.target.checked)}/>
      </label>}
    </div>)}
    <div className="tickard-role-actions" style={{justifyContent:'space-between'}}>
      <strong>Roles personalizados</strong>
      {data.can_manage && <button type="button" className="ghost" onClick={() => edit()}>+ Crear rol</button>}
    </div>
    {data.roles.map(role => <div className="tickard-role-item" key={role.id}>
      <div><strong>{role.name}</strong><small>{role.scope === 'both' ? 'Workspace y Proyecto' : role.scope === 'workspace' ? 'Workspace' : 'Proyecto'} · {role.enabled ? 'Activo' : 'Inactivo'} · {role.description || role.permissions.length + ' permisos'}</small></div>
      {data.can_manage && <div className="tickard-role-actions">
        <button type="button" className="ghost" onClick={() => edit(role)}>Editar</button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void remove(role)}>Eliminar</button>
      </div>}
    </div>)}
    {!data.roles.length && <p className="workspace-overview-hint">Todavía no hay roles personalizados.</p>}
      </div>
      <div className="tickard-roles-detail">
      {selectedBuiltin && (() => {
        const builtin = data.builtin_roles.find(item => item.key === selectedBuiltin)
        if (!builtin) return null
        const allPermissions = [...data.permissions.workspace, ...data.permissions.project]
        const granted = BUILTIN_PERMISSIONS[builtin.key] ?? []
        return <section className="tickard-roles-builtin-detail">
          <div className="tickard-roles-detail-head"><div><h3>{builtin.name}</h3><p>{builtin.locked ? 'Rol protegido del sistema' : 'Rol preestablecido'} · {builtin.scope === 'workspace' ? 'Workspace' : 'Proyecto'}</p></div><span className="tickard-roles-system-label">Rol del sistema</span></div>
          <div className="tickard-roles-detail-tabs"><strong>Permisos</strong><span>Ámbito: {builtin.scope === 'workspace' ? 'Workspace' : 'Proyectos'}</span></div>
          <div className="tickard-roles-category-grid">
            {GROUPS.map(item => {
              const rows = allPermissions.filter(permission => permission.startsWith(item.prefix))
              return <section className="tickard-roles-category-card" key={item.id}>
                <h4>{item.name}</h4><p>{item.description}</p>
                {rows.map(permission => <label key={permission} className="tickard-roles-category-check">
                  <input type="checkbox" disabled checked={granted.includes('*') || granted.includes(permission)}/>
                  <span>{LABELS[permission] ?? permission}</span>
                </label>)}
              </section>
            })}
          </div>
          <p className="workspace-overview-hint">Puedes {builtin.locked ? 'consultar' : 'activar o desactivar'} este rol sin modificar los permisos de los miembros que ya lo tienen asignado.</p>
        </section>
      })()}
      {selected === null && !selectedBuiltin && <p className="workspace-overview-hint">Selecciona un rol para ver sus permisos o crea uno nuevo.</p>}
      {selected !== null && <form className="tickard-role-form" onSubmit={event => void save(event)}>
      <label>Nombre del rol<input required maxLength={80} minLength={2} value={name} disabled={busy}
        onChange={event => setName(event.target.value)}/></label>
      <label>Descripción<input maxLength={255} value={description} disabled={busy}
        onChange={event => setDescription(event.target.value)}/></label>
      <label>Vigencia
        <select value={scope} disabled={busy || selected !== 'new'} onChange={event => {
          const value = event.target.value as Scope
          setScope(value)
          setPermissions(old => {
            const allowed = value === 'both' ? [...data.permissions.workspace,...data.permissions.project] : data.permissions[value]
            const required = value === 'both' ? ['workspace.view','project.view'] : [value === 'workspace' ? 'workspace.view' : 'project.view']
            return [...new Set([...old.filter(item=>allowed.includes(item)),...required])]
          })
        }}>
          <option value="workspace">Workspace</option>
          <option value="project">Proyecto</option>
          <option value="both">Workspace y Proyecto</option>
        </select>
      </label>
      <label className="tickard-role-availability"><span>Rol activo</span><input type="checkbox" checked={enabled} disabled={busy} onChange={event=>setEnabled(event.target.checked)}/></label>
      <strong>Permisos por categoría</strong>
      <div className="tickard-roles-category-grid">
        {GROUPS.map(item => {
          const allowed = scope === 'both' ? [...data.permissions.workspace, ...data.permissions.project] : data.permissions[scope]
          const rows = allowed.filter(permission => permission.startsWith(item.prefix))
          if (!rows.length) return null
          return <section className="tickard-roles-category-card" key={item.id}>
            <h4>{item.name}</h4><p>{item.description}</p>
            {rows.map(permission => <label key={permission} className="tickard-roles-category-check">
              <input type="checkbox" disabled={busy || permission === 'project.view' || permission === 'workspace.view'}
                checked={permissions.includes(permission)}
                onChange={event=>setPermissions(old=>event.target.checked?[...old,permission]:old.filter(value=>value!==permission))}/>
              <span>{LABELS[permission] ?? permission}</span>
            </label>)}
          </section>
        })}
      </div>
      <div className="tickard-role-actions"><button type="button" className="ghost" onClick={() => setSelected(null)} disabled={busy}>Cancelar</button>
        <button type="submit" className="primary" disabled={busy || !name.trim()}>{busy ? 'Guardando…' : 'Guardar rol'}</button></div>
    </form>}
      </div>
    </div>
    {error && <p role="alert" className="workspace-overview-alert">{error}</p>}
    {notice && <p role="status" className="workspace-overview-notice">{notice}</p>}
  </div>
}
