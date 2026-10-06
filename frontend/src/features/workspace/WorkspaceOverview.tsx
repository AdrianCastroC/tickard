import type { Profile } from '../../api'

type Props = { profile: Profile; workspaceId: number | null }

export function WorkspaceOverview({ profile, workspaceId }: Props) {
  const workspace = profile.workspaces.find((item) => item.id === workspaceId) ?? profile.workspaces[0]
  const projectCount = profile.projects.length
  return <section className="workspace-overview"><h1>{workspace?.name ?? 'Workspace'}</h1><p className="subtitle">Vista general</p><div className="workspace-overview-card"><strong>Proyectos</strong><span>{projectCount}</span></div></section>
}
