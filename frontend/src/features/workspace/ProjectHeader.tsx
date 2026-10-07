import type { Project } from '../../api'
import { ProjectCubeIcon } from '../../shared/icons'

export function ProjectHeader({ project }: { project: Project }) { return <header className="project-hero"><div className="project-hero-identity"><div className="project-hero-icon" aria-hidden="true"><ProjectCubeIcon /></div><div><h1>{project.name}</h1><p className="subtitle">{project.client_name}</p></div></div><button className="icon-button" type="button" aria-label="Más opciones" title="Más opciones">···</button></header> }
