import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import { Avatar } from '../../shared/ui'
import { ProjectLoadingIndicator } from '../workspace/ProjectLoadingIndicator'
import { WorkspaceInvitations } from '../workspace/WorkspaceInvitations'
import styles from './MembersSurface.module.css'

type Linked = { id: number; name: string }
type Member = {
  id: number; name: string; handle: string; avatar_url: string | null
  role: string; is_client: boolean
  departments: Linked[]; teams: Linked[]; projects: Linked[]
}
type MemberData = {
  members: Member[]
  member_count: number
  member_limit: number | null
  pending_invitations: number
  can_manage_roles: boolean
}
type Filter = 'all' | 'owner' | 'admin' | 'member' | 'client'
type Panel = 'members' | 'invitations'

const labels: Record<string, string> = {
  owner: 'Owner', admin: 'Administrador', member: 'Miembro', client: 'Cliente',
  responsable: 'Miembro', editor: 'Miembro', lector: 'Miembro', cliente: 'Cliente',
}
const roleTitle = (role: string) => labels[role] ?? role
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

function MemberLinks({ title, items }: { title: string; items: Linked[] }) {
  return <section className={styles.linkGroup}>
    <div className={styles.linkHeading}><strong>{title}</strong><span>{items.length}</span></div>
    {items.length ? <div className={styles.linkTags}>{items.map(item =>
      <span key={item.id} title={item.name}>{item.name}</span>)}</div>
      : <p>Sin vinculaciones</p>}
  </section>
}

export function MembersSurface({
  workspaceId, workspaceName,
}: { workspaceId: number | null; workspaceName: string }) {
  const [data, setData] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [panel, setPanel] = useState<Panel>('members')
  const [draftRole, setDraftRole] = useState<'admin' | 'member'>('member')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (workspaceId === null) return
    const result = await api<MemberData>('/workspaces/' + workspaceId + '/members')
    setData(result)
    setSelectedId(id => id !== null && result.members.some(member => member.id === id)
      ? id : result.members[0]?.id ?? null)
  }, [workspaceId])

  useEffect(() => {
    let alive = true
    setLoading(true); setData(null); setSelectedId(null); setPanel('members'); setError(''); setNotice('')
    if (workspaceId === null) { setLoading(false); return }
    void api<MemberData>('/workspaces/' + workspaceId + '/members')
      .then(result => { if (!alive) return; setData(result); setSelectedId(result.members[0]?.id ?? null) })
      .catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los miembros.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [workspaceId])

  const selected = data?.members.find(member => member.id === selectedId) ?? null
  useEffect(() => {
    setDraftRole(selected?.role === 'admin' ? 'admin' : 'member')
  }, [selected?.id, selected?.role])

  const visible = useMemo(() => (data?.members ?? [])
    .filter(member => (filter === 'all' || (filter === 'member'
      ? !['owner', 'admin', 'client'].includes(member.role) : member.role === filter))
      && (member.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))
        || member.handle.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))))
    .sort((a, b) => collator.compare(a.name, b.name)), [data, filter, search])

  const admins = data?.members.filter(member => member.role === 'admin').length ?? 0
  const clients = data?.members.filter(member => member.role === 'client').length ?? 0
  const owner = data?.members.filter(member => member.role === 'owner').length ?? 0
  const internal = (data?.member_count ?? 0) - clients

  async function saveRole() {
    if (workspaceId === null || !selected || !data?.can_manage_roles || saving
      || selected.role === 'owner' || selected.role === 'client' || selected.role === draftRole) return
    setSaving(true); setError(''); setNotice('')
    try {
      await api('/workspaces/' + workspaceId + '/members/' + selected.id + '/role', {
        method: 'PATCH', body: JSON.stringify({ role: draftRole }),
      })
      await load()
      setNotice('Rol actualizado. Los permisos de proyecto se mantienen independientes.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el rol.')
    } finally { setSaving(false) }
  }

  return <section className={styles.root} aria-label="Miembros del Workspace">
    <header className={styles.header}>
      <div><h1>Miembros</h1><p>Gestiona los miembros y permisos de {workspaceName}.</p></div>
      {data?.can_manage_roles && <button type="button" className={styles.primary}
        onClick={() => setPanel(panel === 'invitations' ? 'members' : 'invitations')}>
        {panel === 'invitations' ? 'Volver a miembros' : '+ Invitar miembros'}
      </button>}
    </header>
    {loading ? <div className={styles.loading}><ProjectLoadingIndicator label="Cargando miembros"/></div> : <>
      {data && <div className={styles.metrics}>
        <div><strong>{data.member_count}</strong><span>Miembros del Workspace</span><small>{data.member_limit === null ? 'Sin límite de plazas' : 'Límite: '+data.member_limit}</small></div>
        <div><strong>{admins}</strong><span>Administradores</span><small>{owner} propietario</small></div>
        <div><strong>{internal}</strong><span>Personal interno</span><small>{clients} cuentas de cliente</small></div>
        <div><strong>{data.pending_invitations}</strong><span>Invitaciones pendientes</span><small>{data.can_manage_roles ? 'Gestionadas por el Owner' : 'Solo visibles para el Owner'}</small></div>
      </div>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {data && panel === 'invitations' && data.can_manage_roles
        ? <div className={styles.invitationArea}>
          <WorkspaceInvitations workspaceId={workspaceId ?? undefined} workspaceName={workspaceName}
            showMembers={false}/>
        </div>
        : data && <div className={styles.columns}>
          <div className={styles.main}>
            <div className={styles.toolbar}>
              <label className={styles.search}>
                <span aria-hidden="true">⌕</span>
                <input type="search" aria-label="Buscar miembros" placeholder="Buscar miembros..."
                  value={search} onChange={event => setSearch(event.target.value)}/>
              </label>
              <select aria-label="Filtrar por rol" value={filter}
                onChange={event => setFilter(event.target.value as Filter)}>
                <option value="all">Todos los roles</option>
                <option value="owner">Owner</option>
                <option value="admin">Administradores</option>
                <option value="member">Miembros</option>
                <option value="client">Clientes</option>
              </select>
            </div>
            <div className={styles.list} aria-label="Listado de miembros">
              {visible.map(member => <button type="button" className={styles.member}
                key={member.id} data-selected={member.id === selectedId} onClick={() => setSelectedId(member.id)}>
                <Avatar id={member.id} name={member.name} src={member.avatar_url} size={36}/>
                <span className={styles.memberIdentity}><strong>{member.name}</strong><small>{member.handle}</small></span>
                <span className={styles.role} data-role={member.role}>{roleTitle(member.role)}</span>
                <span className={styles.arrow} aria-hidden="true">›</span>
              </button>)}
              {!visible.length && <p className={styles.empty}>No hay miembros que coincidan con los filtros.</p>}
            </div>
          </div>
          <aside className={styles.inspector} aria-label="Ficha del miembro">
            {selected ? <>
              <div className={styles.memberHead}>
                <Avatar id={selected.id} name={selected.name} src={selected.avatar_url} size={48}/>
                <div><strong>{selected.name}</strong><small>{selected.handle}</small></div>
                <span className={styles.role} data-role={selected.role}>{roleTitle(selected.role)}</span>
              </div>
              <div className={styles.detailScroll}>
                <section className={styles.detailGroup}>
                  <h2>Permisos del Workspace</h2>
                  {data.can_manage_roles && selected.role !== 'owner' && selected.role !== 'client'
                    ? <><label className={styles.field}>Rol
                      <select value={draftRole} disabled={saving}
                        onChange={event => setDraftRole(event.target.value as 'admin' | 'member')}>
                        <option value="member">Miembro</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </label>
                    <p>Este rol controla la administración del Workspace. Los permisos de cada proyecto se gestionan por separado.</p>
                    {draftRole !== selected.role && <button type="button" className={styles.primary}
                      onClick={() => void saveRole()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar rol'}</button>}</>
                    : <><div className={styles.readonlyRole}>{roleTitle(selected.role)}</div>
                      <p>{selected.role === 'owner'
                        ? 'El propietario no se puede modificar desde esta ficha.'
                        : selected.role === 'client'
                          ? 'El acceso de esta cuenta se gestiona desde Clientes.'
                          : 'Solo el Owner puede asignar permisos de administrador.'}</p></>}
                </section>
                <MemberLinks title="Departamentos" items={selected.departments}/>
                <MemberLinks title="Equipos" items={selected.teams}/>
                <MemberLinks title="Proyectos asignados" items={selected.projects}/>
              </div>
            </> : <div className={styles.empty}>Selecciona un miembro para ver su información.</div>}
          </aside>
        </div>}
    </>}
  </section>
}
