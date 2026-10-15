import { useCallback, useEffect, useState } from 'react'
import { api, type Profile } from '../../api'

type IncomingInvite = {
  id:number; workspace_id:number; workspace_name:string
  project_id:number|null; project_name:string|null; project_role:string|null
  status:'pending'|'accepted'|'rejected'; inviter:string
  created_at:string; responded_at:string|null
}
export function GlobalHome({ profile }: { profile?: Profile }) {
  return <div className="global-surface"><h1>Inicio</h1><p className="subtitle">Una vista general de tu trabajo</p><div className="global-workspaces"><h2>Tus espacios de trabajo</h2>{profile?.workspaces.map((workspace) => <p key={workspace.id}><strong>{workspace.name}</strong><span className="muted">{workspace.plan}</span></p>)}</div></div>
}

export function InboxSurface({ onAccepted }: { onAccepted: (workspaceId:number)=>Promise<void> }) {
  const [data,setData]=useState<IncomingInvite[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState<number|null>(null)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    const invites=await api<IncomingInvite[]>('/my/invitations')
    setData(invites)
  },[])
  useEffect(()=>{
    let active=true
    void api<IncomingInvite[]>('/my/invitations').then(result=>{if(active)setData(result)})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudieron cargar las invitaciones')})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[])
  async function respond(item:IncomingInvite,action:'accept'|'reject') {
    setBusy(item.id);setError('')
    try{
      await api(`/my/invitations/${item.id}/respond`,{method:'POST',body:JSON.stringify({action})})
      await load()
      if(action==='accept')await onAccepted(item.workspace_id)
    }catch(e){setError(e instanceof Error?e.message:'No se pudo responder a la invitación')}
    finally{setBusy(null)}
  }
  const pending=data.filter(x=>x.status==='pending')
  const answered=data.filter(x=>x.status!=='pending')
  return <div className="global-surface">
    <h1>Bandeja de entrada</h1>
    <p className="subtitle">Invitaciones recibidas en Tickard. Puedes aceptarlas o rechazarlas desde aquí.</p>
    {error&&<p className="error" role="alert">{error}</p>}
    {loading&&<p className="muted">Cargando invitaciones…</p>}
    <div className="global-workspaces">
      <h2>Invitaciones pendientes ({pending.length})</h2>
      {pending.length===0&&!loading&&<p className="muted">No tienes invitaciones pendientes.</p>}
      {pending.map(x=><div key={x.id} style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:10,padding:'12px 0',borderBottom:'1px solid var(--line)'}}>
        <div style={{flex:'1 1 240px'}}>
          <strong>{x.project_name?`Proyecto «${x.project_name}»`:`Workspace «${x.workspace_name}»`}</strong>
          <p className="muted" style={{margin:'4px 0',fontSize:12}}>
            {x.project_name?`En ${x.workspace_name} · Rol: ${x.project_role}`:'Rol: Miembro'}
            {' · '}Invita: {x.inviter}</p>
        </div>
        <button type="button" className="primary" disabled={busy!==null} onClick={()=>void respond(x,'accept')}>Aceptar</button>
        <button type="button" className="ghost" disabled={busy!==null} onClick={()=>void respond(x,'reject')}>Rechazar</button>
      </div>)}
      {answered.length>0&&<><h2 style={{marginTop:20}}>Respondidas</h2>
        {answered.map(x=><p key={x.id} style={{display:'flex',justifyContent:'space-between',gap:12}}>
          <span>{x.project_name??x.workspace_name}</span>
          <span className="muted">{x.status==='accepted'?'Aceptada':'Rechazada'}</span>
        </p>)}
      </>}
    </div>
  </div>
}

