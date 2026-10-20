import { useEffect, useState } from 'react'
import { api } from '../../api'

type ProjectStorage = { id:number; name:string; used_bytes:number; allocation_mb:number|null }
type StorageSummary = {
  used_bytes:number; limit_bytes:number|null; is_account_shared:boolean; can_allocate:boolean
  projects:ProjectStorage[]
}
const MB = 1024 * 1024
const size = (bytes:number) => bytes >= 1024**3
  ? (bytes/1024**3).toLocaleString('es-ES',{maximumFractionDigits:2})+' GB'
  : (bytes/MB).toLocaleString('es-ES',{maximumFractionDigits:1})+' MB'

export function WorkspaceStorageSettings({workspaceId}:{workspaceId:number}) {
  const [data,setData] = useState<StorageSummary|null>(null)
  const [allocations,setAllocations] = useState<Record<number,number|null>>({})
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [busy,setBusy] = useState(false)
  useEffect(()=>{
    let live=true
    void api<StorageSummary>(`/workspaces/${workspaceId}/storage`).then(result=>{
      if(!live)return
      setData(result)
      setAllocations(Object.fromEntries(result.projects.map(p=>[p.id,p.allocation_mb])))
    }).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'No se pudo cargar el almacenamiento.')})
    return ()=>{live=false}
  },[workspaceId])
  if(error&&!data)return <p className="workspace-overview-alert" role="alert">{error}</p>
  if(!data)return <p className="workspace-overview-hint" role="status">Cargando almacenamiento…</p>

  const totalMb=data.limit_bytes===null?null:Math.floor(data.limit_bytes/MB)
  const reserved=data.projects.reduce((sum,p)=>sum+(allocations[p.id]??0),0)
  const automaticCount=data.projects.filter(p=>allocations[p.id]===null).length
  const automaticMb=totalMb===null?null:automaticCount?Math.floor(Math.max(0,totalMb-reserved)/automaticCount):0
  const exceed=totalMb!==null&&reserved>totalMb
  const insufficient=data.projects.some(p=>{
    const mb=allocations[p.id]===null?automaticMb:allocations[p.id]
    return mb!==null&&mb!==undefined&&mb*MB<p.used_bytes
  })
  const changed=data.projects.some(p=>allocations[p.id]!==p.allocation_mb)
  async function save(){
    if(busy||exceed||insufficient)return
    setBusy(true);setError('');setNotice('')
    try{
      const next=await api<StorageSummary>(`/workspaces/${workspaceId}/storage`,{
        method:'PATCH',body:JSON.stringify({allocations}),
      })
      setData(next);setAllocations(Object.fromEntries(next.projects.map(p=>[p.id,p.allocation_mb])))
      setNotice('Cuotas de los proyectos actualizadas.')
    }catch(cause){setError(cause instanceof Error?cause.message:'No se pudieron guardar las cuotas.')}
    finally{setBusy(false)}
  }
  return <>
    <div className="workspace-settings-section-heading"><h3>Almacenamiento</h3>
      <p>Distribuye la cuota del Workspace entre sus proyectos.</p></div>
    <section className="workspace-overview-section">
      <div className="workspace-overview-section-title"><h2>Cuota del Workspace</h2></div>
      <p><strong>{size(data.used_bytes)}</strong> utilizados
        {data.limit_bytes!==null?` de ${size(data.limit_bytes)}`:' · Sin límite configurado'}.</p>
      {data.limit_bytes!==null&&<progress style={{width:'100%'}} max={Math.max(1,data.limit_bytes)}
        value={Math.min(data.used_bytes,data.limit_bytes)}/>}
      {data.limit_bytes!==null&&<p className="workspace-overview-hint">{size(Math.max(0,data.limit_bytes-data.used_bytes))} disponibles.</p>}
      {data.is_account_shared&&<p className="workspace-overview-hint">La cuota global se asigna en Mi cuenta → Almacenamiento; aquí se distribuye entre proyectos.</p>}
    </section>
    <section className="workspace-overview-section">
      <div className="workspace-overview-section-title"><h2>Distribución entre proyectos</h2></div>
      {data.projects.map(project=>{
        const allocation=allocations[project.id]
        const effectiveMb=allocation===null?automaticMb:allocation
        const maxMb=totalMb===null?Math.max(20480,allocation??0):Math.max(Math.ceil(project.used_bytes/MB),totalMb-reserved+(allocation??0))
        return <div key={project.id} className="workspace-storage-project">
          <strong>{project.name}</strong>
          <p className="workspace-overview-hint">Utilizado: {size(project.used_bytes)} · Cuota: {effectiveMb===null?'Sin límite':size((effectiveMb??0)*MB)}</p>
          {data.can_allocate&&<div className="workspace-storage-controls">
            <label className="workspace-storage-auto">Reparto automático
              <input type="checkbox" checked={allocation===null} disabled={busy}
                onChange={e=>setAllocations(old=>({...old,[project.id]:e.target.checked?null:Math.max(Math.ceil(project.used_bytes/MB),automaticMb??0)}))}/>
            </label>
            <div className="workspace-storage-range-row">
              <input type="range" aria-label={'Cuota de '+project.name}
                min={Math.ceil(project.used_bytes/MB)} max={maxMb} step={1}
                disabled={busy||allocation===null||totalMb===null}
                value={effectiveMb??0}
                onChange={e=>setAllocations(old=>({...old,[project.id]:Number(e.target.value)}))}/>
              <label className="workspace-storage-number">MB
                <input type="number" aria-label={'Cuota numérica de '+project.name}
                  min={Math.ceil(project.used_bytes/MB)} max={maxMb} step={1}
                  disabled={busy||allocation===null||totalMb===null}
                  value={allocation??(effectiveMb??0)}
                  onChange={e=>setAllocations(old=>({...old,[project.id]:Number(e.target.value)}))}/>
              </label>
            </div>
          </div>}
        </div>
      })}
      {!data.projects.length&&<p className="workspace-overview-hint">No hay proyectos todavía.</p>}
      {data.can_allocate&&totalMb!==null&&<>
        <p className="workspace-overview-hint">Asignado manualmente: {size(reserved*MB)} · Capacidad sin reservar: {size(Math.max(0,totalMb-reserved)*MB)}</p>
        {exceed&&<p className="workspace-overview-alert" role="alert">Las cuotas superan la capacidad del Workspace.</p>}
        {insufficient&&<p className="workspace-overview-alert" role="alert">La cuota no puede ser inferior al espacio utilizado.</p>}
        {error&&<p className="workspace-overview-alert" role="alert">{error}</p>}
        {notice&&<p className="workspace-overview-notice" role="status">{notice}</p>}
        <button type="button" className="primary" disabled={busy||!changed||exceed||insufficient}
          onClick={()=>void save()}>{busy?'Guardando…':'Guardar distribución'}</button>
      </>}
      {totalMb===null&&<p className="workspace-overview-hint">Este Workspace no tiene una cuota máxima definida. El reparto manual estará disponible cuando se configure.</p>}
    </section>
  </>
}
