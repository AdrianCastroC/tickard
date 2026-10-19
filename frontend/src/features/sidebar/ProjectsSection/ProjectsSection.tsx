import { useState } from 'react'
import type { Profile, Project } from '../../../api'
import { NavIcon, PlusIcon } from '../../../shared/icons'
import { CreateProjectModal } from '../../workspace/CreateProjectModal'
import { ProjectItem } from './ProjectItem'

type Props = { profile: Profile; workspaceId: number | null; mini: boolean; onOpenProject: (project: Project) => void; onProjectsChanged: () => Promise<Profile> }

export function ProjectsSection({ profile, workspaceId, onOpenProject, onProjectsChanged }: Props) {
  const [open, setOpen] = useState(true)
  const [newProject, setNewProject] = useState(false)
  const workspace = profile.workspaces.find(item => item.id === workspaceId)
  const canCreate = profile.user.is_admin || workspace?.role === 'owner'

  async function createdProject(id: number) {
    const data = await onProjectsChanged()
    const created = data.projects.find(project => project.id === id)
    if (created) {
      setNewProject(false)
      onOpenProject(created)
    } else {
      // The project exists; avoid submitting a second create request.
      setNewProject(false)
    }
  }

  return <>
    <button type="button" className="nav-item side-section-toggle" title="Proyectos"
      onClick={() => setOpen(current => !current)}>
      <NavIcon><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 0 2 2v2"/></NavIcon>
      <span className="side-label-text">Proyectos</span><span className={`side-section-chevron${open ? ' open' : ''}`}>›</span>
    </button>
    {open && <>
      <span className="mini-section-indicator" aria-hidden="true"/>
      <div className="projects">
        {profile.projects.map(project => <ProjectItem key={project.id} project={project}
          onOpen={() => onOpenProject(project)}/>)}
        {profile.projects.length === 0 && <p className="muted side-label-text">Todavía no hay proyectos.</p>}
        {canCreate && workspaceId !== null && <button className="add-project" type="button"
          title="Nuevo proyecto" onClick={() => setNewProject(true)}>
          <PlusIcon/><span className="side-label-text">Nuevo proyecto</span>
        </button>}
      </div>
    </>}
    {newProject && canCreate && workspaceId !== null && <CreateProjectModal key={workspaceId}
      workspaceId={workspaceId} clientsEnabled={workspace?.show_clients ?? false}
      onClose={() => setNewProject(false)} onCreated={createdProject}/>}
  </>
}
