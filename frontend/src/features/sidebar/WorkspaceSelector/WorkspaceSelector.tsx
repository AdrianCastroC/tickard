import { type FormEvent, useState } from 'react'
import { api, type Profile, type WorkspaceRef } from '../../../api'
import { DotsIcon, PencilIcon, PlusIcon, TrashIcon, VisibilityIcon, WorkspaceBuildingIcon } from '../../../shared/icons'
import { CreateWorkspaceModal } from './CreateWorkspaceModal'
import { DeleteWorkspaceModal } from './DeleteWorkspaceModal'
import { RenameWorkspaceModal } from './RenameWorkspaceModal'
import styles from './WorkspaceSelector.module.css'

type Props = { profile: Profile; activeWorkspaceId: number | null; mini: boolean; activeContext?: boolean; onOpenOverview: () => void; onWorkspaceChange: (id: number) => void | Promise<void>; onProfileRefresh: (workspaceId?: number | null) => Promise<Profile | undefined> }
export function WorkspaceSelector({ profile, activeWorkspaceId, mini, activeContext = false, onOpenOverview, onWorkspaceChange, onProfileRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<number | null>(null)
  const [rename, setRename] = useState<WorkspaceRef | null>(null)
  const [remove, setRemove] = useState<WorkspaceRef | null>(null)
  const [create, setCreate] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const active = profile.workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? profile.workspaces[0]

  function closeMenu() { setOpen(false); setOptions(null) }
  async function createWorkspace(event: FormEvent<HTMLFormElement>, name: string) {
    event.preventDefault()
    const created = await api<{ id: number }>('/workspaces', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
    setCreate(false); closeMenu(); await onWorkspaceChange(created.id)
  }
  async function renameWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!rename) return
    const name = renameName.trim(); if (!name) return
    await api(`/workspaces/${rename.id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
    setRename(null); setRenameName(''); await onProfileRefresh(activeWorkspaceId)
  }
  async function deleteWorkspace() {
    if (!remove) return
    const deletedId = remove.id
    const wasActive = activeWorkspaceId === deletedId
    await api(`/workspaces/${deletedId}`, { method: 'DELETE', body: JSON.stringify({ confirmation_name: confirmation }) })
    const fallback = profile.workspaces.find((workspace) => workspace.id !== deletedId)
    setRemove(null); setConfirmation(''); closeMenu()
    if (wasActive && fallback) {
      await onWorkspaceChange(fallback.id)
    } else {
      await onProfileRefresh(activeWorkspaceId)
    }
  }

  return <>
    <div className={styles.header}>
      <div className={`${styles.headerMain}${activeContext ? ` ${styles.active}` : ''}`}>
        <div className={styles.trigger}>
        <button type="button" className={styles.selector} title={active?.name ?? 'Workspace'} onClick={onOpenOverview}>
          {active?.image_url
            ? <img src={active.image_url} alt="" className={styles.headerLogo}/>
            : <WorkspaceBuildingIcon className={styles.headerIcon} />}
          {!mini && <span className={styles.headerName}>{active?.name ?? 'Workspace'}</span>}
        </button>
        <button type="button" className={styles.chevron} title="Cambiar workspace" aria-label="Cambiar workspace" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span className={`${styles.headerChevron}${open ? ` ${styles.open}` : ''}`}>›</span></button>
        </div>
      </div>
      {open && <div className={styles.menu}>{profile.workspaces.map((workspace) => { const isActive = workspace.id === active?.id; return <div key={workspace.id} className={`${styles.menuItem}${isActive ? ` ${styles.on}` : ''}`}>
        <button type="button" className={styles.menuSelect} title={workspace.name} onClick={() => { closeMenu(); void onWorkspaceChange(workspace.id) }}><span className={`${styles.eye} ${isActive ? styles.isOpen : styles.isClosed} ${workspace.role === 'owner' ? styles.isOwner : styles.isMember}`}><VisibilityIcon /></span>
            {workspace.image_url && <img src={workspace.image_url} alt="" className={styles.menuLogo}/>}
            <span>{workspace.name}</span></button>
        {workspace.role === 'owner' && <div className={styles.menuActions}><button type="button" className={options === workspace.id ? 'more on' : 'more'} aria-label={`Opciones de ${workspace.name}`} onClick={(event) => { event.stopPropagation(); setOptions(options === workspace.id ? null : workspace.id) }}><DotsIcon /></button>{options === workspace.id && <div className={styles.optionsMenu}><button type="button" onClick={() => { setRename(workspace); setRenameName(workspace.name); closeMenu() }}><PencilIcon /> Renombrar</button><button type="button" className="danger" onClick={() => { setRemove(workspace); setConfirmation(''); closeMenu() }}><TrashIcon /> Eliminar</button></div>}</div>}
      </div>})}<div className={styles.separator} /><button type="button" className={styles.createLink} onClick={() => { closeMenu(); setCreate(true) }}><PlusIcon /><span>Nuevo workspace</span></button></div>}
    </div>
    {create && <CreateWorkspaceModal onClose={() => setCreate(false)} onSubmit={createWorkspace} />}
    {rename && <RenameWorkspaceModal value={renameName} onChange={setRenameName} onClose={() => { setRename(null); setRenameName('') }} onSubmit={renameWorkspace} />}
    {remove && <DeleteWorkspaceModal workspace={remove} confirmation={confirmation} onChange={setConfirmation} onClose={() => { setRemove(null); setConfirmation('') }} onConfirm={() => void deleteWorkspace()} />}
  </>
}
