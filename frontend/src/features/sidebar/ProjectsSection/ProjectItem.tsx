import type { Project } from '../../../api'
import { NavIcon } from '../../../shared/ui'

export function ProjectItem({ project, onOpen }: { project: Project; onOpen: () => void }) {
  return <div className="project"><div className="project-row"><button type="button" title={project.name} onClick={onOpen}><NavIcon><path d="M2 6h4M2 10h4M2 14h4M2 18h4" /><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M15 2v20M15 7h5M15 12h5M15 17h5" /></NavIcon><span className="side-label-text">{project.name}</span></button></div></div>
}
