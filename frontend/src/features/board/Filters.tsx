import { priorityLabel } from '../../shared/ui'

export function Filters(props: {
  clientView: boolean
  visibility: Record<string, boolean>
  members: { id: number; name: string }[]
  labels: { id: number; name: string }[]
  assignee: string
  teamId: string
  teams: { id: number; name: string }[]
  label: string
  priority: string
  onAssignee: (value: string) => void
  onTeam: (value: string) => void
  onLabel: (value: string) => void
  onPriority: (value: string) => void
}) {
  const showAssignee = !props.clientView || props.visibility.assignee
  const showPriority = !props.clientView || props.visibility.priority
  const showLabels = !props.clientView || props.visibility.labels
  return (
    <form className="filters" onSubmit={(event) => event.preventDefault()}>
      {showAssignee && (
        <label className="field">Persona
          <select value={props.assignee} onChange={(event) => props.onAssignee(event.target.value)}>
            <option value="">Cualquiera</option>
            {props.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
      )}
      {showAssignee && props.teams.length > 0 && (
        <label className="field">Equipo
          <select value={props.teamId} onChange={(event) => props.onTeam(event.target.value)}>
            <option value="">Cualquiera</option>
            {props.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
      )}
      {showLabels && (
        <label className="field">Etiqueta
          <select value={props.label} onChange={(event) => props.onLabel(event.target.value)}>
            <option value="">Cualquiera</option>
            {props.labels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      )}
      {showPriority && (
        <label className="field">Prioridad
          <select value={props.priority} onChange={(event) => props.onPriority(event.target.value)}>
            <option value="">Cualquiera</option>
            {Object.entries(priorityLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
      )}
    </form>
  )
}

