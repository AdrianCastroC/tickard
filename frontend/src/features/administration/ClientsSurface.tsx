import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api'
import { Avatar, formatDateLong } from '../../shared/ui'
import { EditIcon, FilterFunnelIcon, FloppyIcon, PlusIcon, SortIcon, TrashIcon } from '../../shared/icons'
import styles from './DepartmentsDashboard.module.css'
import { AdministrationLoading } from './AdministrationLoading'
import { EntityAppearanceEditor } from './EntityAppearanceEditor'
import teamStyles from './TeamsDashboard.module.css'
import css from './ClientsDashboard.module.css'

type Person = { id: number; name: string; email: string; professional_phone: string | null; avatar_url: string | null }
type ProjectLink = { id: number; name: string }
type ClientType = 'company' | 'self_employed' | 'individual' | 'institution'
type Status = 'active' | 'inactive' | 'archived'
type ClientIcon = 'building' | 'users' | 'folder'
type Client = {
  id: number; name: string; client_type: ClientType; sector: string | null; image_url: string | null; icon: ClientIcon
  description: string | null; status: Status; created_at: string | null; updated_at: string | null
  primary_contact_user_id: number | null; primary_contact: Person | null
  people: Person[]; people_count: number; needs_representative?: boolean; projects: ProjectLink[]; projects_count: number
}
type PendingClient = { id: number; name: string; representative: string | null; created_at: string | null }
type Data = { can_manage: boolean; clients: Client[]; pending_clients: PendingClient[] }
type Tab = 'summary' | 'members' | 'projects'
type Sort = 'name' | 'type' | 'contact' | 'projects' | 'status' | 'recent'
type SortDirection = 'asc' | 'desc'
const labels: Record<ClientType,string> = {
  company: 'Empresa', self_employed: 'Autónomo', individual: 'Particular', institution: 'Institución',
}
const statuses: Record<Status,string> = { active: 'Activo', inactive: 'Inactivo', archived: 'Archivado' }
const collator = new Intl.Collator('es',{sensitivity:'base',numeric:true})

function Logo({client,size='normal'}:{client:Client;size?:'normal'|'large'}) {
  const initials = client.name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()
  return <span className={size==='large'?css.logoLarge:css.logo} aria-hidden="true">
    {client.image_url ? <img src={client.image_url} alt=""/> : client.icon
      ? <LineIcon name={client.icon}/> : initials}
  </span>
}
function ClientStatus({status}:{status:Status}) {
  return <span className={css.status} data-status={status}><i/>{statuses[status]}</span>
}
function People({users,max=5}:{users:Person[];max?:number}) {
  return <div className={styles.avatars}>
    {users.slice(0,max).map(user=><Avatar key={user.id} id={user.id} name={user.name}
      src={user.avatar_url} size={30} className={styles.avatar}/>)}
    {users.length>max&&<span className={styles.avatarMore}>+{users.length-max}</span>}
    {!users.length&&<span className={styles.muted}>Sin usuarios activos</span>}
  </div>
}
function LineIcon({name}:{name:'folder'|'list'|'grid'|'search'|'users'|'building'}) {
  const paths={
    folder:<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>,
    list:<><path d="M9 5h12M9 12h12M9 19h12M4 5h.01M4 12h.01M4 19h.01"/></>,
    grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    users:<><circle cx="9" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2H2ZM16 5a3 3 0 0 1 0 6M16 15a5 5 0 0 1 6 5"/></>,
    building:<><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M3 21h18M9 7h2M14 7h2M9 11h2M14 11h2M10 21v-6h4v6"/></>,
  }
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function ClientsSurface({workspaceId,openCreate=false,onQuickActionConsumed}:{
  workspaceId:number|null;openCreate?:boolean;onQuickActionConsumed?:()=>void
}) {
  const [data,setData]=useState<Data|null>(null)
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState('')
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [search,setSearch]=useState('')
  const [statusFilter,setStatusFilter]=useState('all')
  const [typeFilter,setTypeFilter]=useState('all')
  const [sort,setSort]=useState<Sort>('name')
  const [sortDirection,setSortDirection]=useState<SortDirection>('asc')
  const [filtersOpen,setFiltersOpen]=useState(false)
  const filterRef=useRef<HTMLDivElement>(null)
  const [layout,setLayout]=useState<'list'|'grid'>('list')
  const [selectedId,setSelectedId]=useState<number|null>(null)
  const [tab,setTab]=useState<Tab>('summary')
  const [editor,setEditor]=useState<'create'|'edit'|null>(null)
  const [selectedRows,setSelectedRows]=useState<number[]>([])
  const [confirmDeleteIds,setConfirmDeleteIds]=useState<number[]>([])
  const [name,setName]=useState('')
  const [description,setDescription]=useState('')
  const [sector,setSector]=useState('')
  const [type,setType]=useState<ClientType>('company')
  const [status,setStatus]=useState<Status>('active')
  const [contactId,setContactId]=useState<number|null>(null)
  const [representative,setRepresentative]=useState('')
  const [icon,setIcon]=useState<ClientIcon>('building')
  const [imageError,setImageError]=useState('')
  const [imageBusy,setImageBusy]=useState(false)

  const path='/clients?workspace_id='+workspaceId
  const reload=useCallback(async()=>{
    if(!workspaceId) return
    const result=await api<Data>(path)
    setData(result)
    setSelectedId(id=>result.clients.some(c=>c.id===id)?id:result.clients[0]?.id??null)
    setSelectedRows(ids=>ids.filter(id=>result.clients.some(c=>c.id===id)))
  },[workspaceId,path])
  useEffect(()=>{
    let active=true
    setLoading(true);setData(null);setLoadError('');setSelectedId(null);setSelectedRows([])
    setEditor(null);setFiltersOpen(false)
    if(!workspaceId){setLoading(false);return}
    void api<Data>(path).then(result=>{
      if(active){setData(result);setSelectedId(result.clients[0]?.id??null)}
    }).catch(e=>{if(active)setLoadError(e instanceof Error?e.message:'No se pudieron cargar los clientes.')})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[workspaceId,path])
  useEffect(()=>{
    if(!filtersOpen)return
    const outside=(event:PointerEvent)=>{
      if(event.target instanceof Node&&!filterRef.current?.contains(event.target))setFiltersOpen(false)
    }
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setFiltersOpen(false)}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
  },[filtersOpen])
  const visible=useMemo(()=>{
    const rows=(data?.clients??[]).filter(c=>
      (statusFilter==='all'||c.status===statusFilter)&&
      (typeFilter==='all'||c.client_type===typeFilter)&&
      (!search.trim()||[c.name,c.sector,c.description,c.primary_contact?.name]
        .some(v=>v?.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')))))
    const value=(c:Client):string|number=>{
      switch(sort){
        case 'type':return labels[c.client_type]
        case 'contact':return c.needs_representative?'':c.primary_contact?.name??''
        case 'projects':return c.projects_count
        case 'status':return statuses[c.status]
        case 'recent':return c.updated_at??''
        default:return c.name
      }
    }
    return rows.sort((a,b)=>{
      const left=value(a),right=value(b)
      // Clients without contacts or dates stay last in either direction.
      if(left===''&&right!=='')return 1
      if(right===''&&left!=='')return -1
      const result=typeof left==='number'&&typeof right==='number'
        ?left-right:collator.compare(String(left),String(right))
      return (sortDirection==='asc'?result:-result)||collator.compare(a.name,b.name)||a.id-b.id
    })
  },[data,search,statusFilter,typeFilter,sort,sortDirection])
  const filterCount=Number(statusFilter!=='all')+Number(typeFilter!=='all')+Number(sort!=='name'||sortDirection!=='asc')
  function changeSort(key:Sort){
    if(sort===key)setSortDirection(direction=>direction==='asc'?'desc':'asc')
    else{setSort(key);setSortDirection('asc')}
  }
  function sortHeading(key:Sort,label:string){
    const active=sort===key
    const next=active&&sortDirection==='asc'?'descendente':'ascendente'
    return <th key={key} aria-sort={active?(sortDirection==='asc'?'ascending':'descending'):'none'}>
      <button type="button" className={teamStyles.sortButton} onClick={()=>changeSort(key)}
        aria-label={`Ordenar ${label} de forma ${next}`} title={`Ordenar ${label} de forma ${next}`}>
        {label}<SortIcon direction={active?sortDirection:null} className={teamStyles.sortIcon}/>
      </button>
    </th>
  }
  const selected=data?.clients.find(c=>c.id===selectedId)??null
  const canManage=data?.can_manage===true
  useEffect(()=>{
    if(openCreate&&canManage){
      beginCreate()
      onQuickActionConsumed?.()
    }
  },[openCreate,canManage,onQuickActionConsumed])
  const allChecked=visible.length>0&&visible.every(c=>selectedRows.includes(c.id))
  const tabs:{id:Tab;label:string}[]=[
    {id:'summary',label:'Resumen'},{id:'members',label:'Miembros'},
    {id:'projects',label:'Proyectos'},
  ]
  function choose(c:Client){setSelectedId(c.id);setEditor(null);setTab('summary');setError('')}
  function beginCreate(){
    setEditor('create');setName('');setDescription('');setSector('');setType('company');setStatus('active')
    setContactId(null);setRepresentative('');setIcon('building');setImageError('');setFiltersOpen(false);setError('');setNotice('')
  }
  function beginEdit(c:Client){
    setSelectedId(c.id);setEditor('edit');setName(c.name);setDescription(c.description??'')
    setSector(c.sector??'');setType(c.client_type);setStatus(c.status)
    setContactId(c.primary_contact_user_id);setRepresentative('');setIcon(c.icon??'building');setImageError('');setError('')
  }
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(!workspaceId||!canManage||busy||imageBusy||!name.trim()||(editor==='create'&&!representative.trim()))return
    setBusy(true);setError('');setNotice('')
    try {
      const payload={workspace_id:workspaceId,name:name.trim(),description:description.trim()||null,
        sector:sector.trim()||null,client_type:type,status,primary_contact_user_id:contactId,icon}
      const created=editor==='create'?await api<{invitation_id:number;status:string}>('/clients',{
        method:'POST',body:JSON.stringify({...payload,representative:representative.trim(),primary_contact_user_id:undefined})}):null
      if(editor==='edit'&&selectedId)await api('/clients/'+selectedId,{
        method:'PATCH',body:JSON.stringify(payload)})
      await reload()
      setSelectedId(created?null:selectedId);setEditor(null);setTab('summary')
      setNotice(created?'Invitación enviada. La empresa se creará cuando el representante acepte.':'Cliente actualizado.')
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el cliente.')}
    finally{setBusy(false)}
  }
  async function cancelPending(id:number) {
    if(!workspaceId||!canManage||busy)return
    setBusy(true);setError('')
    try{
      await api('/clients/pending/'+id,{method:'DELETE',body:JSON.stringify({workspace_id:workspaceId})})
      await reload();setNotice('Invitación cancelada.')
    }catch(e){setError(e instanceof Error?e.message:'No se pudo cancelar la invitación.')}
    finally{setBusy(false)}
  }

  async function remove(){
    if(!workspaceId||!canManage||busy||!confirmDeleteIds.length)return
    setBusy(true);setError('');setNotice('')
    let removed=0
    try{
      for(const id of confirmDeleteIds){
        await api('/clients/'+id,{method:'DELETE',body:JSON.stringify({workspace_id:workspaceId})})
        removed++
      }
      setConfirmDeleteIds([]);setSelectedRows([]);setEditor(null);await reload()
      setNotice(removed===1?'Cliente eliminado.':removed+' clientes eliminados.')
    }catch(e){
      setConfirmDeleteIds([])
      try{await reload()}catch{/* Keep original error. */}
      setError(e instanceof Error?e.message:'No se pudieron eliminar los clientes.')
      if(removed)setNotice(removed+' clientes eliminados antes del error.')
    }finally{setBusy(false)}
  }
  function toggleVisible(checked:boolean){
    const ids=new Set(visible.map(c=>c.id))
    setSelectedRows(current=>checked?[...new Set([...current,...ids])]:current.filter(id=>!ids.has(id)))
  }
  useEffect(() => {
    if (!editor) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && !imageBusy && !(confirmDeleteIds.length > 0)) {
        setEditor(null)
        setError('')
      }
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [editor, busy, imageBusy, confirmDeleteIds.length])

  if(!workspaceId)return <section className={styles.root}>Selecciona un Workspace.</section>

  return <section className={styles.root+' '+css.clientRoot} aria-label="Gestión de clientes">
    <header className={styles.heading}>
      <div className={teamStyles.headline}>
        <span className={css.headerIcon}><LineIcon name="building"/></span>
        <span><h1>Clientes</h1><p>Gestiona los clientes de tu organización y sus proyectos.</p>
          {notice&&<span role="status" className={styles.notice}>{notice}</span>}
          {loadError&&<span className={styles.alert} role="alert">{loadError}
            <button type="button" onClick={()=>{setLoading(true);setLoadError('')
              void reload().catch(e=>setLoadError(e instanceof Error?e.message:'Error de carga.'))
                .finally(()=>setLoading(false))}}>Reintentar</button></span>}
        </span>
      </div>
    </header>
    {loading?<AdministrationLoading section="clients"/>:data&&<div className={styles.workspace}>
      <div className={`${styles.mainColumn} ${css.clientMain}`}>
        <div className={styles.filters}>
          <label className={styles.search}><LineIcon name="search"/>
            <input type="search" aria-label="Buscar clientes" placeholder="Buscar clientes…"
              value={search} onChange={e=>setSearch(e.target.value)}/></label>
          <div className={styles.filterControls} ref={filterRef}>
            <button type="button" title="Filtros" aria-haspopup="dialog" aria-expanded={filtersOpen}
              className={`icon-button board-filter-trigger ${styles.filterTrigger}${filtersOpen||filterCount?' on':''}`}
              onClick={()=>setFiltersOpen(v=>!v)}><FilterFunnelIcon/>
              {filterCount>0&&<span className="board-filter-active-dot" aria-hidden="true"/>}</button>
            {filtersOpen&&<div className={styles.filterPopover} role="dialog" aria-label="Filtros de clientes">
              <div className={styles.filterPopoverHeader}><strong>Filtros</strong>
                {filterCount>0&&<button type="button" onClick={()=>{
                  setStatusFilter('all');setTypeFilter('all');setSort('name');setSortDirection('asc')}}>Limpiar</button>}</div>
              <label>Estado<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
                <option value="all">Todos</option>{Object.entries(statuses).map(([key,label])=>
                <option key={key} value={key}>{label}</option>)}</select></label>
              <label>Tipo<select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
                <option value="all">Todos</option>{Object.entries(labels).map(([key,label])=>
                <option key={key} value={key}>{label}</option>)}</select></label>
              <label>Ordenar por<select value={sort} onChange={e=>{
                const key=e.target.value as Sort
                setSort(key);setSortDirection(['projects','recent'].includes(key)?'desc':'asc')
              }}>
                <option value="name">Nombre</option><option value="type">Tipo</option>
                <option value="contact">Contacto principal</option>
                <option value="projects">Más proyectos</option><option value="status">Estado</option>
                <option value="recent">Más recientes</option></select></label>
            </div>}
          </div>
          <div className={styles.viewSwitcher} role="group" aria-label="Vista de clientes">
            <button type="button" aria-label="Vista de lista" aria-pressed={layout==='list'}
              className={layout==='list'?styles.viewActive:undefined} onClick={()=>setLayout('list')}>
              <LineIcon name="list"/></button>
            <button type="button" aria-label="Vista de tarjetas" aria-pressed={layout==='grid'}
              className={layout==='grid'?styles.viewActive:undefined} onClick={()=>setLayout('grid')}>
              <LineIcon name="grid"/></button>
          </div>
          {canManage&&<button type="button" className={styles.primary} onClick={beginCreate}>
            <PlusIcon/> Nuevo cliente</button>}
        </div>
        {selectedRows.length>0&&<div className={teamStyles.selectionToolbar}>
          <strong>{selectedRows.length} seleccionados</strong>
          <button type="button" onClick={()=>setSelectedRows([])}>Limpiar selección</button>
          {canManage&&<button type="button" onClick={()=>setConfirmDeleteIds([...selectedRows])}>
            <TrashIcon/> Eliminar seleccionados</button>}
        </div>}
        {data.pending_clients.length>0&&<section className={css.pendingArea} aria-label="Clientes pendientes de confirmación">
          <h2>Pendientes de aceptación <span>({data.pending_clients.length})</span></h2>
          {data.pending_clients.map(pending=><div key={pending.id} className={css.pendingRow}>
            <span><strong>{pending.name}</strong><small>Invitación a {pending.representative??'un representante'} · Sin empresa creada todavía</small></span>
            {canManage&&<button type="button" disabled={busy} onClick={()=>void cancelPending(pending.id)}>Cancelar</button>}
          </div>)}
        </section>}
        <div className={teamStyles.tableScroller}>
          {layout==='list'?<table className={teamStyles.table+' '+css.table}>
            <thead><tr><th><input type="checkbox" checked={allChecked} aria-label="Seleccionar clientes visibles"
              onChange={e=>toggleVisible(e.target.checked)}/></th>
              {sortHeading('name','Cliente')}{sortHeading('type','Tipo')}
              {sortHeading('contact','Contacto principal')}{sortHeading('projects','Proyectos')}
              {sortHeading('status','Estado')}
            </tr></thead>
            <tbody>{visible.map(c=><tr key={c.id} data-selected={selectedId===c.id&&editor!=='create'}>
              <td><input type="checkbox" aria-label={'Seleccionar '+c.name}
                checked={selectedRows.includes(c.id)} onChange={e=>setSelectedRows(ids=>
                  e.target.checked?[...new Set([...ids,c.id])]:ids.filter(id=>id!==c.id))}/></td>
              <td><button type="button" className={teamStyles.teamCell} onClick={()=>choose(c)}>
                <Logo client={c}/><span><strong>{c.name}</strong><small>{c.description||c.sector||'Sin descripción'}</small></span>
              </button></td>
              <td><span className={css.typePill}>{labels[c.client_type]}</span></td>
              <td>{c.needs_representative?<span className={css.representativeWarning}>Sin representante</span>:c.primary_contact?<div className={css.contactCell}>
                <Avatar id={c.primary_contact.id} name={c.primary_contact.name} src={c.primary_contact.avatar_url} size={29}/>
                <span><strong>{c.primary_contact.name}</strong><small>{c.primary_contact.email}</small></span>
              </div>:<span className={styles.muted}>Sin asignar</span>}</td>
              <td><button type="button" className={teamStyles.projectCount}
                onClick={()=>{choose(c);setTab('projects')}}><LineIcon name="folder"/>{c.projects_count}</button></td>
              <td><ClientStatus status={c.status}/></td>
            </tr>)}</tbody>
          </table>:<div className={teamStyles.cards}>{visible.map(c=>
            <article className={styles.departmentCard} key={c.id} data-selected={c.id===selectedId}>
              <div className={styles.cardTop}><button type="button" className={styles.cardSelect} onClick={()=>choose(c)}>
                <Logo client={c}/><span className={styles.cardCopy}><strong>{c.name}</strong>
                  <span>{c.description||c.sector||'Sin descripción'}</span></span>
              </button></div>
              <div className={css.cardMeta}><span className={css.typePill}>{labels[c.client_type]}</span>
                <ClientStatus status={c.status}/></div>
              <button className={styles.cardMetrics} type="button" onClick={()=>{choose(c);setTab('projects')}}>
                <span><LineIcon name="folder"/><strong>{c.projects_count}</strong><small>Proyectos</small></span>
                <span><LineIcon name="users"/><strong>{c.people_count}</strong><small>Usuarios</small></span>
              </button>
              {c.primary_contact&&<div className={css.contactCell}>
                <Avatar id={c.primary_contact.id} name={c.primary_contact.name} src={c.primary_contact.avatar_url} size={27}/>
                <span><strong>{c.primary_contact.name}</strong><small>Contacto principal</small></span>
              </div>}
            </article>)}</div>}
          {visible.length===0&&<div className={styles.empty}><LineIcon name="building"/>
            <strong>{data.clients.length?'Sin resultados':'Todavía no hay clientes'}</strong>
            <p>{data.clients.length?'Prueba otros filtros.':'Crea la primera empresa cliente.'}</p></div>}
        </div>
      </div>
      <aside className={`${styles.inspector} ${css.clientInspector}`} aria-label="Ficha del cliente">
        {selected ? <>
          <div className={styles.detailHead}><Logo client={selected} size="large"/>
            <div className={styles.detailTitle}>
              <div className={teamStyles.detailName}><strong>{selected.name}</strong><ClientStatus status={selected.status}/></div>
              <p>{selected.description||selected.sector||'Sin descripción'}</p>
            </div><button type="button" className={styles.close} aria-label="Cerrar ficha"
              onClick={()=>setSelectedId(null)}>×</button>
          </div>
          <nav className={styles.tabs} aria-label="Secciones del cliente">
            {tabs.map(t=><button type="button" key={t.id} className={tab===t.id?styles.activeTab:undefined}
              aria-current={tab===t.id?'page':undefined} onClick={()=>setTab(t.id)}>{t.label}</button>)}
          </nav>
          <div className={styles.detailScroll}>
            {tab==='summary'&&<>
              <div className={styles.overviewSplit}>
                <div className={styles.overviewVisual + " " + css.clientVisual}>
                  <Logo client={selected} size="large"/>
                  <small>{selected.image_url ? 'Logo del cliente' : 'Icono del cliente'}</small>
                </div>
                <div className={styles.overviewInfo}>
              <div className={styles.sectionTitle}><strong>Información</strong>
                {canManage&&<button className={styles.editSmall} type="button" onClick={()=>beginEdit(selected)}><EditIcon/> Editar</button>}</div>
              <dl className={styles.info}><dt>Nombre</dt><dd>{selected.name}</dd>
                <dt>Tipo</dt><dd><span className={css.typePill}>{labels[selected.client_type]}</span></dd>
                <dt>Sector</dt><dd>{selected.sector||'Sin indicar'}</dd>
                <dt>Descripción</dt><dd>{selected.description||'Sin descripción'}</dd>
                <dt>Estado</dt><dd><ClientStatus status={selected.status}/></dd>
                <dt>Creado</dt><dd>{formatDateLong(selected.created_at)}</dd>
                <dt>Actualizado</dt><dd>{formatDateLong(selected.updated_at)}</dd>
              </dl>
                </div>
              </div>
              <div className={styles.detailGroup}>
                <div className={styles.groupHeading}><strong>Contacto principal</strong>
                  {canManage&&<button type="button" onClick={()=>beginEdit(selected)}>Cambiar</button>}</div>
                {selected.primary_contact?<div className={css.contactDetail}>
                  <Avatar id={selected.primary_contact.id} name={selected.primary_contact.name}
                    src={selected.primary_contact.avatar_url} size={37}/>
                  <div><strong>{selected.primary_contact.name}</strong>
                    <a href={'mailto:'+selected.primary_contact.email}>{selected.primary_contact.email}</a>
                    {selected.primary_contact.professional_phone&&<a href={'tel:'+selected.primary_contact.professional_phone}>
                      {selected.primary_contact.professional_phone}</a>}
                  </div>
                </div>:<span className={styles.muted}>No hay contacto principal asignado.</span>}
              </div>
              <div className={styles.detailGroup}>
                <div className={styles.groupHeading}><strong>Usuarios del cliente ({selected.people_count})</strong>
                  <button type="button" onClick={()=>setTab('members')}>Ver todos</button></div>
                <People users={selected.people}/>
              </div>
              <div className={styles.detailGroup}>
                <div className={styles.groupHeading}><strong>Proyectos ({selected.projects_count})</strong>
                  <button type="button" onClick={()=>setTab('projects')}>Ver todos</button></div>
                {selected.projects.slice(0,5).map(project=><div key={project.id} className={styles.detailEntry}>
                  <LineIcon name="folder"/><span>{project.name}</span></div>)}
                {!selected.projects.length&&<small className={styles.muted}>Sin proyectos asociados.</small>}
              </div>
            </>}
            {tab==='members'&&<div className={styles.detailGroup}>
              <strong>Usuarios activos y verificados ({selected.people_count})</strong>
              {selected.people.map(person=><div key={person.id} className={css.memberRow}>
                <Avatar id={person.id} name={person.name} src={person.avatar_url} size={33}/>
                <span><strong>{person.name}</strong><small>{person.email}</small>
                  {person.professional_phone&&<small>{person.professional_phone}</small>}</span>
                {person.id===selected.primary_contact_user_id&&<small>Principal</small>}
              </div>)}
              {!selected.people.length&&<p className={styles.muted}>Esta empresa no tiene usuarios activos y verificados en el Workspace.</p>}
            </div>}
            {tab==='projects'&&<div className={styles.detailGroup}>
              <strong>Proyectos asociados ({selected.projects_count})</strong>
              {selected.projects.map(project=><div key={project.id} className={styles.detailEntry}>
                <LineIcon name="folder"/><span>{project.name}</span></div>)}
              {!selected.projects.length&&<p className={styles.muted}>No hay proyectos asociados.</p>}
              <p className={styles.hint}>Asociar un proyecto a la empresa no concede acceso automáticamente a sus usuarios.</p>
            </div>}
            {error&&<p role="alert" className={styles.formError}>{error}</p>}
          </div>
        </>:<div className={styles.placeholder}><LineIcon name="building"/><strong>Selecciona un cliente</strong>
          <p>Consulta sus usuarios, contacto principal y proyectos asociados.</p></div>}
      </aside>
    </div>}
    {editor && data && createPortal(
      <div className={styles.backdrop} onMouseDown={event => {
        if (event.target === event.currentTarget && !busy && !imageBusy) {
          setEditor(null)
          setError('')
        }
      }}>
        <div className={styles.editorDialog} role="dialog" aria-modal="true" aria-labelledby="clients-editor-title">
          <form className={styles.form} onSubmit={save}>
          <div className={styles.formHeading}><strong id="clients-editor-title">{editor==='create'?'Nuevo cliente':'Editar cliente'}</strong>
            <button type="button" className={styles.close} aria-label="Cancelar edición" onClick={()=>setEditor(null)}>×</button></div>
          <div className={styles.formScroll}>
            <label className={styles.field}>Nombre<input autoFocus required maxLength={120} value={name}
              onChange={e=>setName(e.target.value)}/></label>
            {editor==='create'&&<label className={styles.field}>Primer representante (correo o ID Tickard)
              <input required maxLength={255} value={representative} placeholder="correo@empresa.com o usuario#00001"
                onChange={event=>setRepresentative(event.target.value)}/>
              <small className={styles.hint}>Debe tener cuenta registrada y correo verificado. Recibirá una invitación en Tickard; la empresa solo se creará si acepta.</small>
            </label>}
            <label className={styles.field}>Descripción<textarea rows={3} maxLength={1500}
              value={description} onChange={e=>setDescription(e.target.value)}/></label>
            <label className={styles.field}>Sector o actividad (opcional)<input maxLength={120}
              value={sector} onChange={e=>setSector(e.target.value)}/></label>
            <div className={styles.formRow}>
              <label className={styles.field}>Tipo<select value={type} onChange={e=>setType(e.target.value as ClientType)}>
                {Object.entries(labels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
              <label className={styles.field}>Estado<select value={status} onChange={e=>setStatus(e.target.value as Status)}>
                {Object.entries(statuses).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
            </div>
            {editor==='edit'&&workspaceId&&<EntityAppearanceEditor kind="clients" id={selectedId}
              workspaceId={workspaceId} imageUrl={selected?.image_url??null} icon={icon}
              icons={[{id:'building',label:'Empresa'},{id:'users',label:'Personas'},{id:'folder',label:'Proyectos'}]}
              renderIcon={value=><LineIcon name={value as ClientIcon}/>}
              onIconChange={value=>setIcon(value as ClientIcon)}
              onImageChanged={reload} pendingImage={null} onPendingImageChange={()=>{}}
              error={imageError} onError={setImageError} busy={imageBusy} onBusy={setImageBusy}/>}
            {editor==='create'&&<p className={styles.hint}>Podrás añadir el logo y elegir el icono cuando el representante haya aceptado la invitación.</p>}
            {editor==='edit'&&<label className={styles.field}>Contacto principal
              <select value={contactId??''} onChange={e=>setContactId(e.target.value?Number(e.target.value):null)}>
                <option value="">Sin asignar</option>
                {selected?.people.map(person=><option value={person.id} key={person.id}>{person.name}</option>)}
              </select>
              <small className={styles.hint}>Solo usuarios activos y con correo verificado asociados a este cliente.</small>
            </label>}
            <p className={styles.hint}>Las personas se vinculan a esta empresa mediante sus cuentas de Tickard. No se crea una agenda independiente.</p>
            {editor==='edit'&&selected&&<div className={styles.editDangerZone}>
              <strong>Eliminar cliente</strong>
              <p>Solo se puede eliminar una empresa sin usuarios ni proyectos vinculados.</p>
              <button type="button" className={styles.dangerLink}
                disabled={busy||imageBusy||selected.projects_count>0||selected.people_count>0}
                onClick={()=>setConfirmDeleteIds([selected.id])}><TrashIcon/> Eliminar cliente</button>
              {(selected.projects_count>0||selected.people_count>0)&&<small className={styles.hint}>
                Desvincula primero los proyectos y usuarios de esta empresa.</small>}
            </div>}
          </div>
          {error&&<p className={styles.formError} role="alert">{error}</p>}
          <footer className={styles.formActions}>
            <button type="button" className={styles.subtle} disabled={busy} onClick={()=>setEditor(null)}>Cancelar</button>
            <button type="submit" className={styles.primary} disabled={busy||imageBusy||!name.trim()||(editor==='create'&&!representative.trim())}>
              <FloppyIcon/>{busy?'Guardando…':editor==='create'?'Enviar invitación':'Guardar'}</button>
          </footer>
        </form>
        </div>
      </div>,
      document.body,
    )}
    {confirmDeleteIds.length>0&&createPortal(<div className={styles.backdrop} onMouseDown={e=>{
      if(e.target===e.currentTarget&&!busy)setConfirmDeleteIds([])
    }}><div className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-client-title">
      <h2 id="delete-client-title">{confirmDeleteIds.length===1?'Eliminar cliente':'Eliminar clientes'}</h2>
      <p>Solo se eliminarán los clientes sin proyectos ni usuarios asociados. Esta acción no se puede deshacer.</p>
      <div><button type="button" className={styles.subtle} disabled={busy} onClick={()=>setConfirmDeleteIds([])}>Cancelar</button>
        <button type="button" className={styles.dangerButton} disabled={busy} onClick={()=>void remove()}>
          {busy?'Eliminando…':'Eliminar'}</button></div>
    </div></div>,document.body)}
  </section>
}
