import { useState } from 'react'

export function useBoardFilters() {
  const [assignee, setAssignee] = useState('')
  const [teamId, setTeamId] = useState('')
  const [label, setLabel] = useState('')
  const [priority, setPriority] = useState('')
  const [open, setOpen] = useState(false)
  const [myTasksRequest, setMyTasksRequest] = useState(0)

  function resetAssignment() { setAssignee(''); setTeamId('') }
  function showMyTasks(userId: number) {
    setAssignee(String(userId)); setTeamId(''); setOpen(true)
    setMyTasksRequest((current) => current + 1)
  }

  return { assignee, teamId, label, priority, open, myTasksRequest,
    setAssignee, setTeamId, setLabel, setPriority, setOpen, resetAssignment, showMyTasks,
    active: Boolean(assignee || teamId || label || priority) }
}
