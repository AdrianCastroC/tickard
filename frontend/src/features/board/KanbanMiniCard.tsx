import { type Card } from '../../api'
import { AttachmentIcon } from '../../shared/icons'
import { Avatar, cardStripeStyle } from '../../shared/ui'

export type KanbanMiniCardProps = {
  card: Card
  workflowLabel?: string
  dateLabel?: string
  progressLabel?: string
  className?: string
}

export function CardProgressBar({ progress }: { progress?: Card['progress'] }) {
  if (!progress || progress.total < 1) return null

  return (
    <div className="card-progress" title={`${progress.done} de ${progress.total} completados`}>
      <div className="card-progress-track" aria-hidden="true">
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="card-progress-label">{progress.done}/{progress.total}</span>
    </div>
  )
}

export function CardAttachmentsIndicator({ card }: { card: Card }) {
  if (!card.attachments?.length) return null

  return (
    <span className="card-attachments-indicator" title="Tiene archivos adjuntos" aria-label="Tiene archivos adjuntos">
      <AttachmentIcon />
    </span>
  )
}

export function KanbanMiniCard({ card, workflowLabel, dateLabel, progressLabel, className = '' }: KanbanMiniCardProps) {
  return (
    <article className={`card overlay ${className}`.trim()} style={cardStripeStyle(card.color)}>
      {Boolean(card.attachments?.length) && <div className="card-tools"><CardAttachmentsIndicator card={card} /></div>}
      <strong>{card.title}</strong>
      <div className="meta">
        {card.teams?.map((team) => <span key={team.id} className="chip equipo">{team.name}</span>)}
        {card.labels?.map((item) => <span key={item.id} className={`chip ${item.tone}`}>{item.name}</span>)}
      </div>
      {(workflowLabel || dateLabel || progressLabel) && (
        <div className="card-mini-details">
          {workflowLabel && <span>{workflowLabel}</span>}
          {dateLabel && <span>{dateLabel}</span>}
          {progressLabel && <span>{progressLabel}</span>}
        </div>
      )}
      <footer>
        <div className="card-foot-top">
          <span className="faces">{card.assignees?.map((person) => <Avatar key={person.id} id={person.id} name={person.name} className="face" src={person.avatar_url} />)}</span>
        </div>
        <CardProgressBar progress={card.progress} />
      </footer>
    </article>
  )
}
