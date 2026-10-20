import { type FormEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, type Profile } from '../../../api'
import { PlusIcon, VisibilityIcon, WorkspaceBuildingIcon } from '../../../shared/icons'
import { CreateWorkspaceModal } from './CreateWorkspaceModal'
import styles from './WorkspaceSelector.module.css'

type Props = { profile: Profile; activeWorkspaceId: number | null; mini: boolean; activeContext?: boolean; onOpenOverview: () => void; onWorkspaceChange: (id: number) => void | Promise<void>; onProfileRefresh: (workspaceId?: number | null) => Promise<Profile | undefined> }
export function WorkspaceSelector({ profile, activeWorkspaceId, mini, activeContext = false, onOpenOverview, onWorkspaceChange, onProfileRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ left: number; bottom: number; width: number } | null>(null)
  const [create, setCreate] = useState(false)
  const active = profile.workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? profile.workspaces[0]

  function closeMenu() { setOpen(false) }
  useEffect(() => {
    if (!open) return
    function reposition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.max(235, rect.width)
      setMenuPosition({ left: Math.min(rect.left, window.innerWidth - width - 8), bottom: window.innerHeight - rect.top + 6, width })
    }
    reposition()
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) closeMenu()
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { closeMenu(); triggerRef.current?.querySelector('button')?.focus() } }
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  async function createWorkspace(event: FormEvent<HTMLFormElement>, name: string) {
    event.preventDefault()
    const created = await api<{ id: number }>('/workspaces', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
    setCreate(false); closeMenu(); await onWorkspaceChange(created.id)
  }

  return <>
    <div className={styles.header} ref={triggerRef}>
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
      {open && createPortal(<div ref={menuRef} className={styles.menu} style={menuPosition ? { position:'fixed', top:'auto', right:'auto', left:menuPosition.left, bottom:menuPosition.bottom, width:menuPosition.width } : { position:'fixed', visibility:'hidden' }}>{profile.workspaces.map((workspace) => { const isActive = workspace.id === active?.id; return <div key={workspace.id} className={`${styles.menuItem}${isActive ? ` ${styles.on}` : ''}`}>
        <button type="button" className={styles.menuSelect} title={workspace.name} onClick={() => { closeMenu(); void onWorkspaceChange(workspace.id) }}><span className={`${styles.eye} ${isActive ? styles.isOpen : styles.isClosed} ${workspace.role === 'owner' ? styles.isOwner : styles.isMember}`}><VisibilityIcon /></span>
            {workspace.image_url && <img src={workspace.image_url} alt="" className={styles.menuLogo}/>}
            <span>{workspace.name}</span></button>

      </div>})}<div className={styles.separator} /><button type="button" className={styles.createLink} onClick={() => { closeMenu(); setCreate(true) }}><PlusIcon /><span>Nuevo workspace</span></button></div>, document.body)}
    </div>
    {create && <CreateWorkspaceModal onClose={() => setCreate(false)} onSubmit={createWorkspace} />}
  </>
}
