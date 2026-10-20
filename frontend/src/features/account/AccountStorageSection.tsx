import { useEffect, useState } from 'react'
import { api } from '../../api'
import styles from './AccountModal.module.css'

type WorkspaceStorage = { id: number; name: string; used_bytes: number; limit_bytes: number | null; allocation_mb: number | null }
type StorageResponse = {
  plan: string; can_allocate: boolean; account_limit_bytes: number | null
  account_used_bytes: number; workspaces: WorkspaceStorage[]
}
const formatBytes = (bytes: number) => bytes >= 1024**3
  ? (bytes / 1024**3).toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' GB'
  : (bytes / 1024**2).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' MB'

export function AccountStorageSection() {
  const [data, setData] = useState<StorageResponse | null>(null)
  const [allocations, setAllocations] = useState<Record<string, number | null>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    void api<StorageResponse>('/me/storage').then(next => {
      if (!active) return
      setData(next)
      setAllocations(Object.fromEntries(next.workspaces.map(w => [w.id, w.allocation_mb])))
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el almacenamiento.') })
    return () => { active = false }
  }, [])
  const totalMb = 20480
  const reserved = Object.values(allocations).reduce<number>((sum, v) => sum + (v ?? 0), 0)
  const automaticCount = Object.values(allocations).filter(v => v === null).length
  const automaticMb = automaticCount ? Math.floor(Math.max(0, totalMb - reserved) / automaticCount) : 0
  const overLimit = reserved > totalMb
  const belowUsed = data?.workspaces.some(w =>
    (allocations[w.id] === null ? automaticMb : allocations[w.id] ?? 0) * 1024**2 < w.used_bytes) ?? false
  const changed = data?.workspaces.some(w => allocations[w.id] !== w.allocation_mb) ?? false
  async function save() {
    if (!data || busy || overLimit || belowUsed) return
    setBusy(true); setError(''); setNotice('')
    try {
      const next = await api<StorageResponse>('/me/storage', {
        method:'PATCH', body:JSON.stringify({ allocations }),
      })
      setData(next)
      setAllocations(Object.fromEntries(next.workspaces.map(w => [w.id, w.allocation_mb])))
      setNotice('Distribución de almacenamiento actualizada.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la distribución.') }
    finally { setBusy(false) }
  }

  return <div className={styles.modalBody} style={{overflowY:'auto',padding:20}}>
    {error && <p className="error" role="alert">{error}</p>}
    {!data && !error && <p role="status">Cargando almacenamiento…</p>}
    {data && <>
      <section className={styles.settingsSection}>
        <h3 className={styles.settingsTitle}>Almacenamiento de la cuenta · {data.plan.toUpperCase()}</h3>
        <p className={styles.settingsHint}>Utilizado: {formatBytes(data.account_used_bytes)}
          {data.account_limit_bytes !== null ? ' de ' + formatBytes(data.account_limit_bytes) : ''}.</p>
        {data.account_limit_bytes !== null && <progress value={Math.min(data.account_used_bytes, data.account_limit_bytes)}
          max={data.account_limit_bytes} style={{width:'100%'}} />}
        {data.can_allocate && <p className={styles.settingsHint}>20 GB compartidos entre tus Workspaces. Los que están en automático se reparten a partes iguales la cuota no reservada.</p>}
      </section>
      <section className={styles.settingsSection}>
        <h3 className={styles.settingsTitle}>Distribución por Workspaces</h3>
        {data.workspaces.map(w => {
          const allocation = allocations[w.id]
          const effective = data.can_allocate
            ? (allocation === null ? automaticMb : allocation ?? 0) * 1024**2 : w.limit_bytes
          return <div key={w.id} style={{borderBottom:'1px solid var(--line)',padding:'12px 0'}}>
            <strong>{w.name}</strong>
            <p className={styles.settingsHint}>Usado: {formatBytes(w.used_bytes)} · Cuota: {effective === null ? 'Sin límite configurado' : formatBytes(effective)}</p>
            {data.can_allocate && <label style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <span>Asignación</span>
              <select value={allocation === null ? 'auto' : 'manual'} disabled={busy}
                onChange={event => setAllocations(old => ({...old,[w.id]:event.target.value === 'auto' ? null : Math.max(Math.ceil(w.used_bytes / 1024**2), automaticMb)}))}>
                <option value="auto">Automática</option><option value="manual">Manual</option>
              </select>
              {allocation !== null && <><input type="number" aria-label={'Cuota en MB de '+w.name}
                value={allocation} min={Math.ceil(w.used_bytes/1024**2)} max={totalMb} step={1} disabled={busy}
                style={{width:110}} onChange={event => setAllocations(old => ({...old,[w.id]:Number(event.target.value)}))}/>
                <span>MB</span></>}
            </label>}
          </div>
        })}
        {data.can_allocate && <>
          <p className={styles.settingsHint}>Reservado manualmente: {formatBytes(reserved * 1024**2)} · Sin reservar: {formatBytes(Math.max(0,totalMb-reserved)*1024**2)}</p>
          {overLimit && <p className="error" role="alert">Las cuotas manuales superan los 20 GB.</p>}
          {belowUsed && <p className="error" role="alert">No puedes asignar menos espacio del que está utilizado.</p>}
          {notice && <p role="status">{notice}</p>}
          <button type="button" className="primary" disabled={busy || !changed || overLimit || belowUsed}
            onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar distribución'}</button>
        </>}
      </section>
    </>}
  </div>
}
