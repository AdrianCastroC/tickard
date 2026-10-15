import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../../api'
import { Avatar } from '../../shared/ui'
import styles from './WorkspaceInvitations.module.css'

type Member = { id: number; name: string; email: string; role: 'owner' | 'member'; avatar_url: string | null }
type Invitation = {
  id: number; email: string | null; type: 'email' | 'link'
  max_uses: number; used_count: number; expires_at: string
}
type Data = {
  members: Member[]; invitations: Invitation[]; member_limit: number | null
  member_count: number; can_invite: boolean
}
type NewInvite = { id: number; url: string; type: 'email' | 'link' }
export function WorkspaceInvitations({ workspaceId, workspaceName }: { workspaceId: number; workspaceName: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'email' | 'link'>('email')
  const [email, setEmail] = useState('')
  const [expires, setExpires] = useState(7)
  const [uses, setUses] = useState(1)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [created, setCreated] = useState<NewInvite | null>(null)

  const load = useCallback(async () => {
    const result = await api<Data>(`/workspaces/${workspaceId}/members-invitations`)
    setData(result)
  }, [workspaceId])

  useEffect(() => {
    let alive = true
    setData(null)
    setLoading(true)
    setCreated(null)
    setFeedback('')
    void api<Data>(`/workspaces/${workspaceId}/members-invitations`).then(result => {
      if (alive) setData(result)
    }).catch(error => {
      if (alive) setFeedback(error instanceof Error ? error.message : 'No se pudo cargar la sección.')
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [workspaceId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')
    setCreated(null)
    setPending(true)
    try {
      const response = await api<NewInvite>(`/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ mode, email: mode === 'email' ? email.trim() : null, expires_days: expires, max_uses: mode === 'email' ? 1 : uses }),
      })
      setCreated(response)
      setEmail('')
      setFeedback(mode === 'email' ? 'Invitación enviada. Puedes copiar el enlace como alternativa.' : 'Enlace creado. Cópialo para compartirlo.')
      await load()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear la invitación.')
    } finally {
      setPending(false)
    }
  }

  async function revoke(id: number) {
    setPending(true)
    setFeedback('')
    try {
      await api(`/workspaces/${workspaceId}/invitations/${id}`, { method: 'DELETE' })
      if (created?.id === id) setCreated(null)
      await load()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo cancelar.')
    } finally {
      setPending(false)
    }
  }

  async function copyLink() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.url)
      setFeedback('Enlace copiado al portapapeles.')
    } catch {
      setFeedback('No se pudo copiar automáticamente. Selecciona el enlace y cópialo.')
    }
  }

  return <div className={styles.root}>
    <div className={styles.topline}><div><h2>Miembros e invitaciones</h2>
      <p>Administra quién pertenece a {workspaceName}. La pertenencia no concede acceso a sus proyectos automáticamente.</p>
    </div><span className={styles.count}>{data ? `${data.member_count} / ${data.member_limit ?? '∞'} plazas` : 'Cargando plazas…'}</span></div>
    {loading && <p className={styles.muted}>Cargando miembros e invitaciones…</p>}
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    {data && <>
      <div className={styles.columns}>
        <section className={styles.panel}>
          <h3>Invitar a un usuario</h3>
          <div className={styles.switch}><button type="button" className={mode === 'email' ? styles.active : ''} onClick={() => { setMode('email'); setCreated(null) }}>Por correo</button>
            <button type="button" className={mode === 'link' ? styles.active : ''} onClick={() => { setMode('link'); setCreated(null) }}>Enlace compartible</button></div>
          <form onSubmit={submit} className={styles.form}>
            {mode === 'email' ? <label>Correo del destinatario
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" maxLength={255}/>
            </label> : <p className={styles.muted}>Cualquier usuario con este enlace podrá solicitar la incorporación hasta agotar los usos o caducar.</p>}
            <div className={styles.two}>
              <label>Caducidad
                <select value={expires} onChange={e => setExpires(Number(e.target.value))}>
                  <option value={1}>1 día</option><option value={3}>3 días</option><option value={7}>7 días</option>
                  <option value={14}>14 días</option><option value={30}>30 días</option>
                </select>
              </label>
              {mode === 'link' && <label>Número máximo de usos
                <input type="number" min={1} max={50} value={uses} onChange={e => setUses(Number(e.target.value))}/>
              </label>}
            </div>
            <button className={styles.primary} type="submit" disabled={!data.can_invite || pending}>
              {pending ? 'Procesando…' : mode === 'email' ? 'Enviar invitación' : 'Generar enlace'}
            </button>
            {!data.can_invite && <p className={styles.muted}>No quedan plazas en este Workspace. Las invitaciones existentes podrán necesitar una ampliación.</p>}
          </form>
          {created && <div className={styles.linkBox}>
            <label>Enlace de invitación
              <input value={created.url} readOnly onFocus={e => e.target.select()}/>
            </label>
            <button type="button" onClick={() => void copyLink()}>Copiar enlace</button>
          </div>}
        </section>
        <section className={styles.panel}>
          <h3>Invitaciones pendientes <span>{data.invitations.length}</span></h3>
          <div className={styles.list}>{data.invitations.map(item => <div key={item.id} className={styles.listRow}>
            <div className={styles.person}><strong>{item.email ?? 'Enlace compartible'}</strong>
              <small>{item.used_count}/{item.max_uses} usos · caduca {new Date(item.expires_at).toLocaleDateString('es-ES')}</small></div>
            <button type="button" className={styles.danger} disabled={pending} onClick={() => void revoke(item.id)}>Cancelar</button>
          </div>)}</div>
          {!data.invitations.length && <p className={styles.muted}>No hay invitaciones pendientes.</p>}
        </section>
      </div>
      <section className={styles.panel}>
        <h3>Miembros actuales <span>{data.member_count}</span></h3>
        <div className={styles.members}>{data.members.map(member => <div key={member.id} className={styles.member}>
          <Avatar id={member.id} name={member.name} src={member.avatar_url} size={34}/>
          <div><strong>{member.name}</strong><small>{member.email}</small></div>
          <span className={styles.role}>{member.role === 'owner' ? 'Propietario' : 'Miembro'}</span>
        </div>)}</div>
      </section>
    </>}
  </div>
}
