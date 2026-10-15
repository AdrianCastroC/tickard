import type { Profile } from '../../api'

export function GlobalHome({ profile }: { profile?: Profile }) {
  return <div className="global-surface"><h1>Inicio</h1><p className="subtitle">Una vista general de tu trabajo</p><div className="global-workspaces"><h2>Tus espacios de trabajo</h2>{profile?.workspaces.map((workspace) => <p key={workspace.id}><strong>{workspace.name}</strong><span className="muted">{workspace.plan}</span></p>)}</div></div>
}

