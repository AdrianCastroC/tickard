import { useEffect, useState } from 'react'
import { api } from '../../api'

type StorageSummary = {
  used_bytes: number; limit_bytes: number | null; is_account_shared: boolean
  projects: { id: number; name: string; used_bytes: number }[]
}
const size = (bytes: number) => bytes >= 1024 ** 3
  ? (bytes / 1024 ** 3).toLocaleString('es-ES', {maximumFractionDigits:2}) + ' GB'
  : (bytes / 1024 ** 2).toLocaleString('es-ES', {maximumFractionDigits:1}) + ' MB'

export function WorkspaceStorageSettings({ workspaceId }: { workspaceId: number }) {
  const [data, setData] = useState<StorageSummary | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    void api<StorageSummary>(`/workspaces/${workspaceId}/storage`)
      .then(result => { if (live) setData(result) })
      .catch(cause => { if (live) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el almacenamiento.') })
    return () => { live = false }
  }, [workspaceId])

  if (error) return <p className="workspace-overview-alert" role="alert">{error}</p>
  if (!data) return <p className="workspace-overview-hint" role="status">Cargando almacenamiento…</p>
  const available = data.limit_bytes === null ? null : Math.max(0, data.limit_bytes - data.used_bytes)
  return <>
    <div className="workspace-settings-section-heading">
      <h3>Almacenamiento</h3>
      <p>Consumo real del Workspace y de sus proyectos.</p>
    </div>
    <section className="workspace-overview-section">
      <div className="workspace-overview-section-title"><h2>Cuota asignada</h2></div>
      <p><strong>{size(data.used_bytes)}</strong> utilizados
        {data.limit_bytes !== null ? ` de ${size(data.limit_bytes)}` : ' · Sin límite configurado'}.</p>
      {data.limit_bytes !== null && <progress style={{width:'100%'}} max={Math.max(1,data.limit_bytes)}
        value={Math.min(data.used_bytes,data.limit_bytes)} />}
      {available !== null && <p className="workspace-overview-hint">{size(available)} disponibles.</p>}
      {data.is_account_shared && <p className="workspace-overview-hint">La cuota de este Workspace se distribuye desde Mi cuenta → Almacenamiento. No se modifica aquí.</p>}
    </section>
    <section className="workspace-overview-section">
      <div className="workspace-overview-section-title"><h2>Consumo por proyecto</h2></div>
      {data.projects.map(project => <div key={project.id} style={{
        display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'12px 0',borderBottom:'1px solid var(--line)',gap:12,
      }}><span>{project.name}</span><strong>{size(project.used_bytes)}</strong></div>)}
      {!data.projects.length && <p className="workspace-overview-hint">No hay proyectos todavía.</p>}
    </section>
  </>
}
