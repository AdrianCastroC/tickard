import type { Project } from '../../api'
import { ProjectCubeIcon, SettingsIcon } from '../../shared/icons'

export function ProjectHeader({ project, settingsActive, onSettings }: {
  project: Project; settingsActive: boolean; onSettings: () => void
}) {
  return <header className="project-hero">
    <div className="project-hero-identity"><div className="project-hero-icon" aria-hidden="true">
      {project.image_url ? <img src={project.image_url} alt="" className="project-hero-logo"/> : <ProjectCubeIcon/>}
    </div>
      <div><h1>{project.name}</h1>{project.client_name && <p className="subtitle">{project.client_name}</p>}</div>
    </div>
    {project.role === 'responsable' && <button className="wd-settings-btn"
      type="button" aria-label="Configuración del proyecto" aria-pressed={settingsActive}
      title="Configuración del proyecto" onClick={onSettings}>
      <SettingsIcon/>
      Configuración
    </button>}
  </header>
}
