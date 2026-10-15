import { useState } from 'react'
import type { Profile } from '../../api'
import { WorkspaceInvitations } from './WorkspaceInvitations'

type Props = { profile: Profile; workspaceId: number | null }

export function WorkspaceOverview({ profile, workspaceId }: Props) {
  const workspace = profile.workspaces.find((item) => item.id === workspaceId) ?? profile.workspaces[0]
  const [managingId, setManagingId] = useState<number | null>(null)
  const managing = managingId === workspace?.id

  if (!workspace) return <section className="workspace-overview"><h1>Sin Workspace</h1></section>

  return <section className="workspace-overview" style={{ overflowY: 'auto', minHeight: 0 }}>
    {managing && workspace.role === 'owner'
      ? <>
          <button type="button" className="ghost" onClick={() => setManagingId(null)}>← Volver al Workspace</button>
          <WorkspaceInvitations workspaceId={workspace.id} workspaceName={workspace.name}/>
        </>
      : <>
          <h1>{workspace.name}</h1>
          <p className="subtitle">Vista general del Workspace</p>
          <div className="workspace-overview-card"><strong>Proyectos</strong><span>{profile.projects.length}</span></div>
          {workspace.role === 'owner' && <div style={{ marginTop: 16 }}>
            <button type="button" className="primary" onClick={() => setManagingId(workspace.id)}>Miembros e invitaciones</button>
          </div>}
        </>}
  </section>
}
