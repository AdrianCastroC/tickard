import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import type { MyTask } from './MyTasksSurface'
import styles from './InboxSurface.module.css'

type CardTarget = Pick<MyTask, 'id' | 'board_id' | 'project_id' | 'workspace_id'>
type Invitation = {
  id: number; workspace_id: number; workspace_name: string
  project_id: number | null; project_name: string | null
  project_role: string | null; status: 'pending' | 'accepted' | 'rejected'
  inviter: string | null; created_at: string; responded_at: string | null
}
type Notice = {
  id: number; body: string; kind: string
  read_at: string | null; created_at: string | null
  card: CardTarget | null
}
type Props = {
  onAccepted: (workspaceId: number) => Promise<void>
  onOpenCard: (card: CardTarget) => Promise<void>
  onUnreadChanged: () => Promise<void>
}

const dateLabel = (value: string | null) => value
  ? new Date(value).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : ''

export function InboxSurface({ onAccepted, onOpenCard, onUnreadChanged }: Props) {
  const [invites, setInvites] = useState<Invitation[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [showUnread, setShowUnread] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [invitations, notifications] = await Promise.all([
      api<Invitation[]>('/my/invitations'),
      api<Notice[]>('/notifications'),
    ])
    setInvites(invitations)
    setNotices(notifications)
  }, [])

  useEffect(() => {
    let live = true
    void Promise.all([
      api<Invitation[]>('/my/invitations'),
      api<Notice[]>('/notifications'),
    ]).then(([invitations, notifications]) => {
      if (!live) return
      setInvites(invitations)
      setNotices(notifications)
    }).catch(cause => {
      if (live) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la bandeja.')
    }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

  async function respond(invitation: Invitation, action: 'accept' | 'reject') {
    if (working) return
    setWorking('invitation:' + invitation.id)
    setError('')
    try {
      await api(`/my/invitations/${invitation.id}/respond`, {
        method: 'POST', body: JSON.stringify({ action }),
      })
      await load()
      if (action === 'accept') await onAccepted(invitation.workspace_id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo responder a la invitación.')
    } finally { setWorking(null) }
  }

  async function read(id: number) {
    await api(`/notifications/${id}/read`, { method: 'POST' })
    setNotices(items => items.map(item => item.id === id
      ? { ...item, read_at: new Date().toISOString() } : item))
    await onUnreadChanged()
  }

  async function openNotice(note: Notice) {
    if (working) return
    setWorking('notice:' + note.id)
    setError('')
    try {
      if (!note.read_at) await read(note.id)
      if (note.card) await onOpenCard(note.card)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir este aviso.')
    } finally { setWorking(null) }
  }

  async function markAll() {
    if (working) return
    setWorking('all')
    setError('')
    try {
      await api('/notifications/read', { method: 'POST' })
      setNotices(items => items.map(item => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })))
      await onUnreadChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron marcar los avisos.')
    } finally { setWorking(null) }
  }

  const pending = invites.filter(item => item.status === 'pending')
  const answered = invites.filter(item => item.status !== 'pending')
  const unread = notices.filter(item => !item.read_at).length
  const visibleNotes = showUnread ? notices.filter(item => !item.read_at) : notices

  return <section className={`${styles.root} inbox-view`} aria-label="Bandeja de entrada">
    <header className={styles.heading}>
      <div><h1>Bandeja de entrada</h1><p>Invitaciones y actividad que requiere tu atención.</p></div>
      <span className={styles.count}>{pending.length} invitaciones · {unread} sin leer</span>
    </header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.scroll}>
      {(loading || pending.length > 0) && <section className={styles.panel}>
        <div className={styles.panelHeader}><h2>Invitaciones pendientes</h2><span>{pending.length}</span></div>
        {loading && <p className={styles.empty}>Cargando invitaciones…</p>}
        {pending.map(item => <div key={item.id} className={styles.item}>
          <div className={styles.itemBody}>
            <strong>{item.project_name ? `Proyecto «${item.project_name}»` : `Workspace «${item.workspace_name}»`}</strong>
            <small>{item.project_name
              ? `${item.workspace_name} · ${item.project_role ?? 'Miembro'}`
              : 'Rol: Miembro'} · Invitación de {item.inviter ?? 'un miembro'}</small>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={working !== null}
              onClick={() => void respond(item, 'accept')}>Aceptar</button>
            <button type="button" className={styles.secondary} disabled={working !== null}
              onClick={() => void respond(item, 'reject')}>Rechazar</button>
          </div>
        </div>)}
      </section>}
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.titleGroup}><h2>Actividad</h2><span>{unread} sin leer</span></div>
          <div className={styles.toolbar}>
            <button type="button" className={showUnread ? styles.active : styles.toolbarButton}
              onClick={() => setShowUnread(value => !value)}>
              {showUnread ? 'Mostrar todas' : 'Solo no leídas'}
            </button>
            <button type="button" className={styles.toolbarButton} disabled={unread === 0 || working !== null}
              onClick={() => void markAll()}>Marcar todas como leídas</button>
          </div>
        </div>
        {loading && <p className={styles.empty}>Cargando avisos…</p>}
        {!loading && visibleNotes.length === 0 && <p className={styles.empty}>
          {showUnread ? 'No tienes avisos sin leer.' : 'Todavía no tienes avisos.'}
        </p>}
        {visibleNotes.map(note => <button type="button" key={note.id}
          className={`${styles.item} ${styles.notice} ${!note.read_at ? styles.unread : ''}`}
          disabled={working !== null} onClick={() => void openNotice(note)}
          title={note.card ? 'Abrir Card y marcar como leído' : 'Marcar como leído'}>
          <span className={styles.dot} aria-hidden="true"/>
          <span className={styles.itemBody}>
            <strong>{note.body}</strong>
            <small>{dateLabel(note.created_at)}{note.card ? ' · Abrir Card' : ''}</small>
          </span>
          <span className={styles.readStatus}>{note.read_at ? 'Leído' : 'Sin leer'}</span>
        </button>)}
      </section>
      {answered.length > 0 && <section className={styles.panel}>
        <div className={styles.panelHeader}><h2>Invitaciones respondidas</h2><span>{answered.length}</span></div>
        {answered.map(item => <div key={item.id} className={styles.item}>
          <span className={styles.itemBody}><strong>{item.project_name ?? item.workspace_name}</strong>
            <small>{dateLabel(item.responded_at)}</small></span>
          <span className={styles.readStatus}>{item.status === 'accepted' ? 'Aceptada' : 'Rechazada'}</span>
        </div>)}
      </section>}
    </div>
  </section>
}
