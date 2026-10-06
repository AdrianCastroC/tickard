import { useState } from 'react'
import type { ReactNode } from 'react'
import { api, type BoardPayload, type Project } from '../../api'
import { ProjectDrawer } from '../administration'
import { DeleteProjectModal } from '../sidebar/ProjectsSection/DeleteProjectModal'

type Props = { project: Project; board: BoardPayload | null; onRefresh: () => Promise<unknown>; onDeleted: (id: number, projects: Project[]) => void; onBoardSelect?: (id: number) => void }

export function ProjectSurface({ project, board, onRefresh, onDeleted, onBoardSelect = (id) => window.dispatchEvent(new CustomEvent('tickard:select-board', { detail: id })) }: Props) {
  const [configure, setConfigure] = useState(false)
  const [deleting, setDeleting] = useState(false)
  async function deleteProject(name: string) {
    await api(`/projects/${project.id}`, { method: 'DELETE', body: JSON.stringify({ confirmation_name: name }) })
    const profile = await onRefresh() as { projects: Project[] }
    onDeleted(project.id, profile.projects)
  }
  return <div className="workspace project-surface">
    <header className="project-hero"><div className="project-hero-identity"><div className="project-hero-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.5 7.5 4 7.5-4M12 12v9" /></svg></div><div><h1>{project.name}</h1><p className="subtitle">{project.client_name}</p></div></div><button className="icon-button" type="button" aria-label="Más opciones" title="Más opciones">···</button></header>
    <nav className="project-surface-nav" aria-label="Navegación del proyecto"><button className="on" type="button">Vista general</button><button type="button" onClick={() => board?.board.id && onBoardSelect?.(board.board.id)}>Tableros</button><button type="button" disabled>Gantt</button><button type="button" disabled>Calendario</button><button type="button" disabled>Archivos</button><button type="button" disabled>Equipo</button><button type="button" onClick={() => setConfigure(true)}>Configuración</button></nav>
    <section className="project-kpis" aria-label="Indicadores del proyecto"><Kpi label="Progreso general" value="—" /><Kpi label="Tareas" value="—" /><Kpi label="Fechas" value="Sin definir" /><Kpi label="Equipo" value="—" /></section>
    <section className="project-middle-grid"><ProjectPanel title="Tareas por categoría"><EmptyPanel text="No hay datos agregados del proyecto todavía." /></ProjectPanel><ProjectPanel title="Estado de tareas"><EmptyPanel text="No hay estados agregados del proyecto todavía." /></ProjectPanel><ProjectPanel title="Próximos hitos"><EmptyPanel text="Aún no hay hitos definidos." /></ProjectPanel></section>
    <section className="project-bottom-grid"><ProjectPanel title="Cronograma del proyecto"><div className="project-large-empty"><strong>Planifica el cronograma global del proyecto</strong><p className="muted">El Gantt del proyecto estará disponible cuando exista planificación agregada.</p><button className="ghost" type="button" disabled>Ver Gantt del proyecto</button></div></ProjectPanel><ProjectPanel title="Actividad reciente"><EmptyPanel text="No hay actividad agregada del proyecto todavía." /></ProjectPanel></section>
    {configure && <div className="project-config-area">{board ? <ProjectDrawer board={board} onClose={() => setConfigure(false)} onChange={async () => { await onRefresh() }} /> : <p className="muted">Este proyecto aún no tiene un tablero para configurar.</p>}<button className="danger" type="button" onClick={() => setDeleting(true)}>Eliminar proyecto</button></div>}{deleting && <DeleteProjectModal project={project} onClose={() => setDeleting(false)} onConfirm={deleteProject} />}
  </div>
}

function Kpi({ label, value }: { label: string; value: string }) { return <article className="project-kpi"><span>{label}</span><strong>{value}</strong></article> }
function ProjectPanel({ title, children }: { title: string; children: ReactNode }) { return <section className="project-panel"><h2>{title}</h2>{children}</section> }
function EmptyPanel({ text }: { text: string }) { return <div className="project-empty-panel"><span className="muted">{text}</span></div> }
