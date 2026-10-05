import { type FormEvent, useState } from 'react'
import { api, type Profile, type WorkspaceRef } from '../../../api'
import { DotsIcon, NavIcon, PencilIcon, PlusIcon, TrashIcon, VisibilityIcon } from '../../../shared/ui'
import { CreateWorkspaceModal } from './CreateWorkspaceModal'
import { DeleteWorkspaceModal } from './DeleteWorkspaceModal'
import { RenameWorkspaceModal } from './RenameWorkspaceModal'
import styles from './WorkspaceSelector.module.css'

type Props = { profile: Profile; activeWorkspaceId: number | null; mini: boolean; onToggleMini: () => void; onWorkspaceChange: (id: number) => void | Promise<void>; onProfileRefresh: (workspaceId?: number | null) => Promise<Profile | undefined> }
export function WorkspaceSelector({ profile, activeWorkspaceId, mini, onToggleMini, onWorkspaceChange, onProfileRefresh }: Props) {
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
      <div className={styles.headerMain}>
        <button type="button" className={styles.selector} title={mini ? 'Abrir panel' : active?.name ?? 'Workspace'} aria-expanded={!mini && open} onClick={() => mini ? onToggleMini() : setOpen((current) => !current)}>
          <svg className={styles.headerIcon} viewBox="0 0 640 640" aria-hidden="true"><path d="M192 64C156.7 64 128 92.7 128 128L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 128C512 92.7 483.3 64 448 64L192 64zM304 416L336 416C353.7 416 368 430.3 368 448L368 528L272 528L272 448C272 430.3 286.3 416 304 416zM224 176C224 167.2 231.2 160 240 160L272 160C280.8 160 288 167.2 288 176L288 208C288 216.8 280.8 224 272 224L240 224C231.2 224 224 216.8 224 208L224 176zM368 160L400 160C408.8 160 416 167.2 416 176L416 208C416 216.8 408.8 224 400 224L368 224C359.2 224 352 216.8 352 208L352 176C352 167.2 359.2 160 368 160zM224 304C224 295.2 231.2 288 240 288L272 288C280.8 288 288 295.2 288 304L288 336C288 344.8 280.8 352 272 352L240 352C231.2 352 224 344.8 224 336L224 304zM368 288L400 288C408.8 288 416 295.2 416 304L416 336C416 344.8 408.8 352 400 352L368 352C359.2 352 352 344.8 352 336L352 304C352 295.2 359.2 288 368 288z" /></svg>
          {!mini && <><span className={styles.headerName}>{active?.name ?? 'Workspace'}</span><span className={`${styles.headerChevron}${open ? ` ${styles.open}` : ''}`}>›</span></>}
        </button>
        {!mini && <button type="button" className={styles.headerAction} title="Minimizar panel" aria-label="Minimizar panel" onClick={() => { closeMenu(); onToggleMini() }}><NavIcon><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /><path d="m16 15-3-3 3-3" /></NavIcon></button>}
      </div>
      {!mini && open && <div className={styles.menu}>{profile.workspaces.map((workspace) => { const isActive = workspace.id === active?.id; return <div key={workspace.id} className={`${styles.menuItem}${isActive ? ` ${styles.on}` : ''}`}>
        <button type="button" className={styles.menuSelect} title={workspace.name} onClick={() => { closeMenu(); void onWorkspaceChange(workspace.id) }}><span className={`${styles.eye} ${isActive ? styles.isOpen : styles.isClosed} ${workspace.role === 'owner' ? styles.isOwner : styles.isMember}`}><VisibilityIcon /></span><span>{workspace.name}</span></button>
        {workspace.role === 'owner' && <div className={styles.menuActions}><button type="button" className={options === workspace.id ? 'more on' : 'more'} aria-label={`Opciones de ${workspace.name}`} onClick={(event) => { event.stopPropagation(); setOptions(options === workspace.id ? null : workspace.id) }}><DotsIcon /></button>{options === workspace.id && <div className={styles.optionsMenu}><button type="button" onClick={() => { setRename(workspace); setRenameName(workspace.name); closeMenu() }}><PencilIcon /> Renombrar</button><button type="button" className="danger" onClick={() => { setRemove(workspace); setConfirmation(''); closeMenu() }}><TrashIcon /> Eliminar</button></div>}</div>}
      </div>})}<div className={styles.separator} /><button type="button" className={styles.createLink} onClick={() => { closeMenu(); setCreate(true) }}><PlusIcon /><span>Nuevo workspace</span></button></div>}
    </div>
    {create && <CreateWorkspaceModal onClose={() => setCreate(false)} onSubmit={createWorkspace} />}
    {rename && <RenameWorkspaceModal value={renameName} onChange={setRenameName} onClose={() => { setRename(null); setRenameName('') }} onSubmit={renameWorkspace} />}
    {remove && <DeleteWorkspaceModal workspace={remove} confirmation={confirmation} onChange={setConfirmation} onClose={() => { setRemove(null); setConfirmation('') }} onConfirm={() => void deleteWorkspace()} />}
  </>
}
