import { useState } from 'react'
import { type CardDependency, type WorkflowState } from '../../../api'
import { CheckOffIcon, CheckOnIcon, ChecklistIcon } from '../../../shared/icons'
import { SectionToggle } from '../cardSectionUi'

const STATUS_LABELS: Record<WorkflowState, string> = {
  backlog: 'Backlog',
  pending: 'Pendiente',
  in_progress: 'En progreso',
  review: 'En revisión',
  done: 'Completada',
}

/** Checklist calculado desde las Cards de origen: nunca edita su estado. */
export function MilestoneDependencyChecklist({ predecessors }: { predecessors: CardDependency[] }) {
  const [collapsed, setCollapsed] = useState(false)
  const total = predecessors.length
  const done = predecessors.filter((dependency) => dependency.is_done === true).length

  return (
    <section className={`card-modal-section checklist milestone-dependencies${collapsed ? ' is-collapsed' : ''}`}>
      <div className="section-head checklist-head">
        <h3>
          <SectionToggle
            icon={<ChecklistIcon />}
            label="Cards necesarias para el hito"
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
          />
          Cards necesarias para el hito
          <span className="milestone-dependency-auto">(automático)</span>
        </h3>
        {total > 0 && (
          <div className="checklist-meter">
            <span className="checklist-meter-count">{done}/{total} · faltan {total - done}</span>
            <div
              className="checklist-bar"
              role="progressbar"
              aria-label="Dependencias del hito completadas"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              title={`${done} de ${total} Cards completadas`}
            >
              <span style={{ width: `${Math.round(done / total * 100)}%` }} />
            </div>
          </div>
        )}
      </div>
      {!collapsed && (
        total === 0
          ? <p className="milestone-dependency-empty">Este hito todavía no tiene Cards predecesoras.</p>
          : <ul className="check-list milestone-dependency-list">
            {predecessors.map((dependency) => {
              const complete = dependency.is_done === true
              return (
                <li key={dependency.id} className={complete ? 'done' : ''}>
                  <div className="check-main">
                    <span
                      className={`check-toggle${complete ? ' on' : ''}`}
                      role="img"
                      aria-label={complete ? 'Completada' : 'Pendiente'}
                      title="El estado se actualiza desde la Card vinculada"
                    >
                      {complete ? <CheckOnIcon /> : <CheckOffIcon />}
                    </span>
                    <span className="check-body">{dependency.title}</span>
                  </div>
                  <div className="check-meta">
                    <span className="milestone-dependency-state">
                      {STATUS_LABELS[dependency.workflow_state ?? 'pending']}
                    </span>
                    {dependency.board_name && (
                      <span className="milestone-dependency-board" title={dependency.board_name}>
                        {dependency.board_name}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
      )}
    </section>
  )
}
