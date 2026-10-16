import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Profile } from '../../api'
import { WorkspaceInvitations } from './WorkspaceInvitations'

type Props = { profile: Profile; workspaceId: number | null; onProfileRefresh: () => Promise<unknown> }

export function WorkspaceOverview({ profile, workspaceId, onProfileRefresh }: Props) {
  const workspace = profile.workspaces.find((item) => item.id === workspaceId) ?? profile.workspaces[0]
  const [managingId, setManagingId] = useState<number | null>(null)
  const managing = managingId === workspace?.id
  const [showBirthdays, setShowBirthdays] = useState(workspace?.show_birthdays ?? true)
  const [birthdayBusy, setBirthdayBusy] = useState(false)
  const [birthdayError, setBirthdayError] = useState('')
  useEffect(() => { setShowBirthdays(workspace?.show_birthdays ?? true); setBirthdayError('') }, [workspace?.id, workspace?.show_birthdays])

  async function changeBirthdaySetting(enabled: boolean) {
    if (!workspace || workspace.role !== 'owner' || birthdayBusy) return
    setBirthdayBusy(true); setBirthdayError('')
    try {
      await api('/workspaces/' + workspace.id + '/birthday-settings', {
        method: 'PATCH', body: JSON.stringify({ show_birthdays: enabled }),
      })
      setShowBirthdays(enabled)
      await onProfileRefresh()
    } catch (cause) {
      setBirthdayError(cause instanceof Error ? cause.message : 'No se pudo guardar la configuración.')
    } finally { setBirthdayBusy(false) }
  }

  if (!workspace) return <section className="workspace-overview"><h1>Sin Workspace</h1></section>

  return <section className={`workspace-overview${managing && workspace.role === 'owner' ? ' workspace-overview-invitations' : ''}`}>
    {managing && workspace.role === 'owner'
      ? <>
          <button type="button" className="ghost" onClick={() => setManagingId(null)}>← Volver al Workspace</button>
          <WorkspaceInvitations workspaceId={workspace.id} workspaceName={workspace.name}/>
        </>
      : <>
          <h1>{workspace.name}</h1>
          <p className="subtitle">Vista general del Workspace</p>
          <div className="workspace-overview-card"><strong>Proyectos</strong><span>{profile.projects.length}</span></div>
          {workspace.role === 'owner' && <>
            <div style={{ marginTop: 16 }}>
              <button type="button" className="primary" onClick={() => setManagingId(workspace.id)}>Miembros e invitaciones</button>
            </div>
            <section className="workspace-birthday-settings" aria-label="Configuración del Workspace">
              <h2>Configuración del Workspace</h2>
              <label className="workspace-birthday-toggle">
                <span><strong>Mostrar cumpleaños</strong><small>Mostrar en los calendarios de este Workspace los cumpleaños que sus miembros decidan compartir.</small></span>
                <input type="checkbox" checked={showBirthdays} disabled={birthdayBusy}
                  onChange={event => void changeBirthdaySetting(event.target.checked)}/>
              </label>
              {birthdayError && <p role="alert" className="error">{birthdayError}</p>}
            </section>
          </>}
        </>}
  </section>
}
