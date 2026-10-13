import { useState } from 'react'
import type { Project } from '../../api'
export type ProjectContext = 'project' | number
export type OpenProjectTab = { projectId: number; title: string }
export function useProjectTabs(projects: Project[]) {
  const [state, setState] = useState<{ tabs: OpenProjectTab[]; activeProjectId: number | null; contexts: Record<number, ProjectContext>; selection: number }>(() => { const first = projects[0]; return { tabs: first ? [{ projectId: first.id, title: first.name }] : [], activeProjectId: first?.id ?? null, contexts: first ? { [first.id]: 'project' } : {}, selection: 0 } })
  const open = (project: Project) => setState((current) => ({ ...current, tabs: current.tabs.some((tab) => tab.projectId === project.id) ? current.tabs : [...current.tabs, { projectId: project.id, title: project.name }], activeProjectId: project.id, contexts: current.contexts[project.id] === undefined ? { ...current.contexts, [project.id]: 'project' } : current.contexts, selection: current.selection + 1 }))
  const select = (projectId: number) => setState((current) => ({ ...current, activeProjectId: projectId, selection: current.selection + 1 }))
  const showWorkspace = () => setState((current) => ({ ...current, activeProjectId: null, selection: current.selection + 1 }))
  const selectContext = (context: ProjectContext) => setState((current) => current.activeProjectId === null ? current : { ...current, contexts: { ...current.contexts, [current.activeProjectId]: context }, selection: current.selection + 1 })
  const selectBoard = (project: Project, boardId: number) => setState((current) => ({
    ...current,
    tabs: current.tabs.some((tab) => tab.projectId === project.id)
      ? current.tabs : [...current.tabs, { projectId: project.id, title: project.name }],
    activeProjectId: project.id,
    contexts: { ...current.contexts, [project.id]: boardId },
    selection: current.selection + 1,
  }))
  const close = (projectId: number) => setState((current) => { const tabs = current.tabs.filter((tab) => tab.projectId !== projectId); const activeProjectId = current.activeProjectId === projectId ? tabs.at(-1)?.projectId ?? null : current.activeProjectId; const contexts = { ...current.contexts }; delete contexts[projectId]; return { ...current, tabs, activeProjectId, contexts } })
  const removeProject = (projectId: number, remaining: Project[]) => setState((current) => { const tabs = current.tabs.filter((tab) => tab.projectId !== projectId); const activeProjectId = current.activeProjectId === projectId ? tabs.at(-1)?.projectId ?? remaining[0]?.id ?? null : current.activeProjectId; const contexts = { ...current.contexts }; delete contexts[projectId]; return { ...current, tabs, activeProjectId, contexts } })
  return { ...state, open, select, showWorkspace, selectContext, selectBoard, close, removeProject }
}
