import type { Profile } from '../../api'

export function GlobalHome({ profile }: { profile?: Profile }) {
  return <div className="global-surface"><h1>Inicio</h1><p className="subtitle">Una vista general de tu trabajo</p><div className="global-workspaces"><h2>Tus espacios de trabajo</h2>{profile?.workspaces.map((workspace) => <p key={workspace.id}><strong>{workspace.name}</strong><span className="muted">{workspace.plan}</span></p>)}</div></div>
}

export function InboxSurface() {
  return <div className="global-surface"><h1>Bandeja de entrada</h1><p className="subtitle">Aquí aparecerán menciones, asignaciones e invitaciones de todos tus espacios de trabajo.</p><div className="global-empty"><strong>No hay avisos todavía</strong><span className="muted">Tu bandeja está al día.</span></div></div>
}

export function MyTasksSurface() {
  return <div className="global-surface"><h1>Mis tareas</h1><p className="subtitle">Una vista global de las tareas que tienes asignadas.</p><div className="global-empty"><strong>Tus tareas aparecerán aquí</strong><span className="muted">La vista global estará disponible cuando exista un endpoint común para todos tus workspaces.</span></div></div>
}
