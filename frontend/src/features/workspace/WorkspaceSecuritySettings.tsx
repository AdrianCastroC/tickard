import { useEffect, useState } from 'react'
import { api } from '../../api'
type Event = {id:number;action:string;details:Record<string,string|number>;created_at:string;actor_name:string}
type Result = { owner_only_role_management:boolean; client_access_enabled:boolean; events:Event[] }
const labels:Record<string,string> = {
  'builtin_role.updated':'Permisos de rol preestablecido modificados',
  'custom_role.created':'Rol personalizado creado',
  'custom_role.updated':'Rol personalizado actualizado',
  'custom_role.deleted':'Rol personalizado eliminado',
  'member.role_changed':'Rol de miembro actualizado',
}
export function WorkspaceSecuritySettings({workspaceId}:{workspaceId:number}) {
  const [data,setData] = useState<Result|null>(null)
  const [error,setError] = useState('')
  useEffect(()=>{
    let active=true
    void api<Result>(`/workspaces/${workspaceId}/security`)
      .then(result=>{if(active)setData(result)})
      .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'No se pudo cargar la seguridad.')})
    return ()=>{active=false}
  },[workspaceId])
  if(error)return <p className="workspace-overview-alert" role="alert">{error}</p>
  if(!data)return <p role="status" className="workspace-overview-hint">Cargando seguridad…</p>
  return <>
    <div className="workspace-settings-section-heading"><h3>Seguridad</h3><p>Control de acceso y auditoría del Workspace.</p></div>
    <section className="workspace-overview-section">
      <div className="workspace-overview-section-title"><h2>Políticas actuales</h2></div>
      <p>La administración de roles del Workspace está reservada al propietario.</p>
      <p>Acceso de empresas cliente: <strong>{data.client_access_enabled?'Habilitado':'Deshabilitado'}</strong>. Puedes cambiarlo desde General.</p>
      <p className="workspace-overview-hint">La contraseña y la seguridad de tu sesión se administran desde Mi cuenta, no desde el Workspace.</p>
    </section>
    <section className="workspace-overview-section">
      <div className="workspace-overview-section-title"><h2>Registro de actividad administrativa</h2></div>
      <p className="workspace-overview-hint">Últimos 100 cambios auditados desde la activación del registro.</p>
      {data.events.map(event=><div key={event.id} style={{padding:'12px 0',borderBottom:'1px solid var(--line)'}}>
        <strong>{labels[event.action]??event.action}</strong>
        <p className="workspace-overview-hint">{event.actor_name} · {new Date(event.created_at).toLocaleString('es-ES')}</p>
        {typeof event.details.role==='string' && <small>Rol: {event.details.role}</small>}
      </div>)}
      {!data.events.length&&<p className="workspace-overview-hint">Todavía no hay cambios administrativos registrados.</p>}
    </section>
  </>
}
