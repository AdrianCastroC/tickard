import type { Project } from '../../api'

export function ProjectHeader({ project }: { project: Project }) { return <header className="project-hero"><div className="project-hero-identity"><div className="project-hero-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.5 7.5 4 7.5-4M12 12v9" /></svg></div><div><h1>{project.name}</h1><p className="subtitle">{project.client_name}</p></div></div><button className="icon-button" type="button" aria-label="Más opciones" title="Más opciones">···</button></header> }
