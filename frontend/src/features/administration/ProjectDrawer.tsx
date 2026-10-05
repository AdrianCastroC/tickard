import { useState } from 'react'
import { api, type BoardPayload } from '../../api'
import { InviteForm } from './InviteForm'

export function ProjectDrawer({ board, onClose, onChange }: { board: BoardPayload; onClose: () => void; onChange: () => Promise<void> }) {
  const [visibility, setVisibility] = useState(board.visibility)
  const fields = [
    ['description', 'DescripciÃ³n'],
    ['assignee', 'AsignaciÃ³n'],
    ['due_date', 'Fecha lÃ­mite'],
    ['priority', 'Prioridad'],
    ['labels', 'Etiquetas'],
    ['comments', 'Comentarios'],
  ] as const

  return (
    <div className="drawer-back" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <h2>QuÃ© ve el cliente</h2>
        {fields.map(([key, label]) => (
          <label key={key} className="row">
            <input type="checkbox" checked={Boolean(visibility[key])} onChange={async (event) => {
              const next = { ...visibility, [key]: event.target.checked }
              setVisibility(next)
              await api(`/projects/${board.board.project_id}`, { method: 'PATCH', body: JSON.stringify({ [`show_${key}`]: event.target.checked }) })
              await onChange()
            }} />
            {label}
          </label>
        ))}
        <h2>Personas</h2>
        <ul className="notes">
          {board.members.map((member) => <li key={member.id}>{member.name} Â· {member.role}</li>)}
        </ul>
        <InviteForm projectId={board.board.project_id} />
      </aside>
    </div>
  )
}
