import { priorityLabel } from '../../shared/ui'
import { SideSelect } from './Kanban'

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
        <div className="field" role="group" aria-label="Persona">
          <span>Persona</span>
          <SideSelect
            value={props.assignee}
            options={[
              { value: '', label: 'Cualquiera' },
              ...props.members.map((member) => ({ value: String(member.id), label: member.name })),
            ]}
            onChange={props.onAssignee}
          />
        </div>
      )}
      {showAssignee && props.teams.length > 0 && (
        <div className="field" role="group" aria-label="Equipo">
          <span>Equipo</span>
          <SideSelect
            value={props.teamId}
            options={[
              { value: '', label: 'Cualquiera' },
              ...props.teams.map((team) => ({ value: String(team.id), label: team.name })),
            ]}
            onChange={props.onTeam}
          />
        </div>
      )}
      {showLabels && (
        <div className="field" role="group" aria-label="Etiqueta">
          <span>Etiqueta</span>
          <SideSelect
            value={props.label}
            options={[
              { value: '', label: 'Cualquiera' },
              ...props.labels.map((item) => ({ value: String(item.id), label: item.name })),
            ]}
            onChange={props.onLabel}
          />
        </div>
      )}
      {showPriority && (
        <div className="field" role="group" aria-label="Prioridad">
          <span>Prioridad</span>
          <SideSelect
            value={props.priority}
            options={[
              { value: '', label: 'Cualquiera' },
              ...Object.entries(priorityLabel).map(([value, label]) => ({ value, label })),
            ]}
            onChange={props.onPriority}
          />
        </div>
      )}
    </form>
  )
}
