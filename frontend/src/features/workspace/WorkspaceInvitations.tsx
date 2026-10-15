import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../api'
import { Avatar } from '../../shared/ui'
import styles from './WorkspaceInvitations.module.css'

type Invite = {
  id: number; user: string; handle: string; status: 'pending'|'accepted'|'rejected'
  project_role: 'responsable'|'editor'|'lector'|null
  project_name: string|null; created_at: string; responded_at: string|null
}
type Member = { id: number; name: string; handle: string; avatar_url: string|null; role: string }
type Data = { members?: Member[]; invitations: Invite[]; member_count?: number; member_limit?: number|null }
type Result = { created: Invite[]; errors: { value: string; reason: string }[] }
export function WorkspaceInvitations({ workspaceId, workspaceName, projectId, onAdded }:
  { workspaceId?: number; workspaceName?: string; projectId?: number; onAdded?: () => void }) {
  const base = projectId ? `/projects/${projectId}/invitations` : `/workspaces/${workspaceId}/invitations`
  const listPath = projectId ? base : `/workspaces/${workspaceId}/members-invitations`
  const [data,setData] = useState<Data|null>(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [input,setInput] = useState('')
  const [role,setRole] = useState<'responsable'|'editor'|'lector'>('editor')
  const [status,setStatus] = useState<'all'|'pending'|'accepted'|'rejected'>('all')
  const [selected,setSelected] = useState<number[]>([])
  const [busy,setBusy] = useState(false)

  const load = useCallback(async () => {
    const result = await api<Data>(listPath)
    setData(result)
  }, [listPath])
  useEffect(() => {
    let active=true
    setLoading(true);setData(null);setSelected([]);setError('')
    void api<Data>(listPath).then(x=>{if(active)setData(x)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Error al cargar invitaciones')})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[listPath])
  const filtered=useMemo(()=>data?.invitations.filter(x=>status==='all'||x.status===status)??[],[data,status])
  const removable=filtered.filter(x=>x.status!=='accepted')
  const chosen=selected.filter(id=>removable.some(x=>x.id===id))
  async function send(event:FormEvent) {
    event.preventDefault()
    const recipients=[...new Set(input.split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean))]
    if(!recipients.length)return
    setBusy(true);setError('')
    try {
      const response=await api<Result>(base,{method:'POST',body:JSON.stringify({recipients,...(projectId?{role}:{})})})
      await load()
      if(response.created.length) setInput('')
      setError(`${response.created.length} invitación(es) enviada(s).`+
        (response.errors.length?' No enviadas: '+response.errors.map(x=>x.value+' ('+x.reason+')').join('; '):''))
    }catch(e){setError(e instanceof Error?e.message:'No se pudieron enviar las invitaciones')}
    finally{setBusy(false)}
  }
  async function remove(ids:number[]) {
    if(!ids.length||!window.confirm(`¿Eliminar ${ids.length} invitación(es)? Las pendientes dejarán de poder aceptarse.`))return
    setBusy(true);setError('')
    try {
      await api(`${base}/delete`,{method:'POST',body:JSON.stringify({ids})})
      setSelected([]);await load()
    }catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar la selección')}
    finally{setBusy(false)}
  }
  return <div className={`${styles.root}${projectId ? '' : ` ${styles.workspaceRoot}`}`}>
    <div className={styles.topline}><div>
      <h2>{projectId?'Invitaciones al proyecto':'Miembros e invitaciones'}</h2>
      <p>Invita a cuentas existentes por correo o identificador nick#ID.{workspaceName?' · '+workspaceName:''}</p>
    </div>{data?.member_count!==undefined&&<span className={styles.count}>{data.member_count} / {data.member_limit??'∞'} plazas</span>}</div>
    <div className={styles.columns}>
      <section className={styles.panel}>
        <h3>Enviar invitaciones</h3>
        <form onSubmit={e=>void send(e)} className={styles.form}>
          <label>Destinatarios (varios separados por coma o línea)
            <textarea value={input} onChange={e=>setInput(e.target.value)} rows={4} required
              placeholder={'maria#123456, pedro@empresa.com\nsofia#654321'} disabled={busy}
              style={{width:'100%',resize:'vertical',padding:'10px',borderRadius:8,background:'var(--surface)',color:'var(--ink)',border:'1px solid var(--line)'}}/>
          </label>
          {projectId&&<label>Rol que tendrán al aceptar
            <select value={role} onChange={e=>setRole(e.target.value as typeof role)} disabled={busy}>
              <option value="responsable">Responsable</option><option value="editor">Editor</option><option value="lector">Lector</option>
            </select>
          </label>}
          <button type="submit" className={styles.primary} disabled={busy||!input.trim()}>{busy?'Enviando…':'Enviar invitaciones'}</button>
          <p className={styles.muted}>Solo usuarios registrados. {projectId?'Los externos entrarán también en el Workspace.':'El rol inicial será Miembro; los proyectos se asignan aparte.'}</p>
        </form>
      </section>
      <section className={styles.panel}>
        <h3>Historial de invitaciones <span>{data?.invitations.length??0}</span></h3>
        <div className={styles.switch}>
          {(['all','pending','accepted','rejected'] as const).map(x=><button key={x} type="button"
            className={status===x?styles.active:''} onClick={()=>{setStatus(x);setSelected([])}}>
            {{all:'Todas',pending:'Pendientes',accepted:'Aceptadas',rejected:'Rechazadas'}[x]}
          </button>)}
        </div>
        {removable.length>0&&<label style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
          <input type="checkbox" checked={removable.every(x=>selected.includes(x.id))}
            onChange={e=>setSelected(e.target.checked?removable.map(x=>x.id):[])}/> Seleccionar todas las eliminables
        </label>}
        <div className={styles.list}>{filtered.map(x=><div key={x.id} className={styles.listRow}>
          {x.status!=='accepted'&&<input type="checkbox" checked={selected.includes(x.id)}
            onChange={e=>setSelected(v=>e.target.checked?[...v,x.id]:v.filter(y=>y!==x.id))}/>}
          <div className={styles.person}>
            <strong>{x.user} · {x.handle}</strong>
            <small>{x.status==='pending'?'Pendiente':x.status==='accepted'?'Aceptada':'Rechazada'} · {new Date(x.created_at).toLocaleDateString('es-ES')}{x.project_role?' · '+x.project_role:''}</small>
          </div>
          {x.status!=='accepted'&&<button className={styles.danger} type="button" disabled={busy}
            onClick={()=>void remove([x.id])}>Eliminar</button>}
        </div>)}</div>
        {!loading&&!filtered.length&&<p className={styles.muted}>No hay invitaciones en este estado.</p>}
        {chosen.length>0&&<button type="button" className={styles.danger} disabled={busy}
          onClick={()=>void remove(chosen)}>Eliminar seleccionadas ({chosen.length})</button>}
        <p className={styles.muted}>Las aceptadas se eliminan automáticamente del historial cinco días después.</p>
      </section>
    </div>
    {loading&&<p className={styles.muted}>Cargando…</p>}
    {error&&<p role="status" className={styles.feedback}>{error}</p>}
    {!projectId&&!!data?.members?.length&&<section className={`${styles.panel} ${styles.membersPanel}`}>
      <div className={styles.membersHeader}>
        <h3>Miembros actuales <span>{data.members.length}</span></h3>
      </div>
      <div className={styles.membersGrid} aria-label="Miembros actuales">
        {data.members.map(x=><div key={x.id} className={styles.memberCard}>
          <Avatar id={x.id} name={x.name} src={x.avatar_url} size={32}/>
          <div className={styles.memberInfo}>
            <strong title={x.name}>{x.name}</strong>
            <small title={x.handle}>{x.handle}</small>
          </div>
          <span className={styles.role}>{x.role==='owner'?'Propietario':'Miembro'}</span>
        </div>)}
      </div>
    </section>}
    {onAdded&&<button type="button" className="ghost" onClick={onAdded}>Volver a Personal</button>}
  </div>
}
