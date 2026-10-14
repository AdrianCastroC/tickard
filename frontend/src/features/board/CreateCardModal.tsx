import { type FormEvent, useState } from 'react'
import { api, type BoardPayload } from '../../api'
import { priorityLabel } from '../../shared/ui'
import { DateRangePicker } from './DateRangePicker'

export function CreateCardModal({ board, column, onClose, onCreated }: {
  board: BoardPayload
  column: { id: number; name: string }
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [start, setStart] = useState<string | null>(null)
  const [due, setDue] = useState<string | null>(null)
  const [priority, setPriority] = useState('media')
  const [isMilestone, setIsMilestone] = useState(false)
  const [milestoneAutoComplete, setMilestoneAutoComplete] = useState(true)
  const [assignees, setAssignees] = useState<string[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [error, setError] = useState('')
  const team = board.members.filter((member) => member.role !== 'cliente')
  const categories = board.categories ?? []
  const isBacklog = board.columns.find((item) => item.id === column.id)?.workflow_state === 'backlog'

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Escribe un título.')
      return
    }
    if (isMilestone && !due) {
      setError('Selecciona la fecha objetivo del hito.')
      return
    }
    try {
      await api(`/boards/${board.board.id}/cards`, {
        method: 'POST',
        body: JSON.stringify({
          column_id: column.id,
          category_id: categoryId ? Number(categoryId) : null,
          title: title.trim(),
          description,
          start_date: isMilestone ? due : start,
          due_date: due,
          priority,
          is_milestone: isMilestone,
          milestone_auto_complete: milestoneAutoComplete,
          assignee_ids: assignees.map(Number),
          team_ids: teams.map(Number),
        }),
      })
      await onCreated()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la tarjeta.')
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>Nueva tarjeta</h2>
        <p className="muted">{isMilestone ? "Se añadirá a En progreso." : `Se añade a ${column.name}.`}</p>
        <label className="field">Título<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="field">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
        {categories.length > 0 && (
          <label className="field">Categoría
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        )}
        <label className="row"><input type="checkbox" checked={isMilestone} onChange={(event) => setIsMilestone(event.target.checked)} /> Es un hito</label>
        {isMilestone ? (
          <>
            <label className="field">Fecha objetivo<input type="date" required value={due ?? ''} onChange={(event) => setDue(event.target.value || null)} /></label>
            <label className="row"><input type="checkbox" checked={milestoneAutoComplete} onChange={(event) => setMilestoneAutoComplete(event.target.checked)} /> Finalización automática (próxima fase)</label>
          </>
        ) : (
          <label className="field">Periodo
            {isBacklog ? <span className="muted">Disponible cuando la tarea salga de backlog.</span> : <DateRangePicker start={start} end={due} onChange={(nextStart, nextDue) => { setStart(nextStart); setDue(nextDue) }} />}
          </label>
        )}
        <label className="field">Prioridad
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            {Object.entries(priorityLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
        <label className="field">Personas
          <select multiple value={assignees} onChange={(event) => setAssignees([...event.target.selectedOptions].map((option) => option.value))}>
            {team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        {(board.teams ?? []).length > 0 && (
          <label className="field">Equipos
            <select multiple value={teams} onChange={(event) => setTeams([...event.target.selectedOptions].map((option) => option.value))}>
              {(board.teams ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="primary" type="submit">Añadir tarea</button>
          <button className="ghost" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}



