import { useState } from 'react'
import type { Project } from '../../api'
import type { OpenTab } from '../../shared/ui'

export function useBoardTabs(projects: Project[]) {
  const [state, setState] = useState<{ tabs: OpenTab[]; activeId: number | null; selection: number }>(() => {
    const project = projects[0]
    const board = project?.boards[0]
    return {
      tabs: board ? [{ boardId: board.id, projectId: project.id, title: board.name }] : [],
      activeId: board?.id ?? null,
      selection: 0,
    }
  })

  function open(project: Project, board: { id: number; name: string }) {
    setState((current) => ({
      tabs: current.tabs.some((tab) => tab.boardId === board.id) ? current.tabs
        : [...current.tabs, { boardId: board.id, projectId: project.id, title: board.name }],
      activeId: board.id,
      selection: current.selection + 1,
    }))
  }

  function select(boardId: number) {
    setState((current) => ({ ...current, activeId: boardId, selection: current.selection + 1 }))
  }

  function close(boardId: number) {
    setState((current) => {
      const tabs = current.tabs.filter((tab) => tab.boardId !== boardId)
      return { ...current, tabs, activeId: current.activeId === boardId ? tabs.at(-1)?.boardId ?? null : current.activeId }
    })
  }

  function removeProject(projectId: number, remainingProjects: Project[]) {
    setState((current) => {
      const tabs = current.tabs.filter((tab) => tab.projectId !== projectId)
      const activeProject = projects.find((project) => project.boards.some((board) => board.id === current.activeId))
      const activeId = activeProject?.id === projectId
        ? tabs.at(-1)?.boardId ?? remainingProjects.at(-1)?.boards[0]?.id ?? null
        : current.activeId
      return { ...current, tabs, activeId }
    })
  }

  return { ...state, open, select, close, removeProject }
}
