import { type Card } from '../../api'
import { AttachmentIcon, VisibilityIcon } from '../../shared/icons'
import { Avatar, cardStripeStyle } from '../../shared/ui'

export type KanbanMiniCardProps = {
  card: Pick<Card, 'title' | 'color' | 'is_internal' | 'is_milestone' | 'teams' | 'labels' | 'assignees' | 'attachments' | 'progress'>
  workflowLabel?: string
  dateLabel?: string
  progressLabel?: string
  className?: string
}

export function MilestoneIndicator() {
  return <span className="card-milestone-indicator" title="Hito" aria-label="Hito">◆</span>
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

export function CardAttachmentsIndicator({ card }: { card: Pick<Card, 'attachments'> }) {
  if (!card.attachments?.length) return null

  return (
    <span className="card-attachments-indicator" title="Tiene archivos adjuntos" aria-label="Tiene archivos adjuntos">
      <AttachmentIcon />
    </span>
  )
}

function CardVisibilityIndicator() {
  return (
    <span className="card-public" title="No interna" aria-label="Tarjeta no interna">
      <VisibilityIcon />
    </span>
  )
}

export function KanbanMiniCard({ card, workflowLabel, dateLabel, progressLabel, className = '' }: KanbanMiniCardProps) {
  const hasAttachments = Boolean(card.attachments?.length)
  const isVisibleToExternalUsers = card.is_internal === false

  return (
    <article className={`card overlay ${className}`.trim()} style={cardStripeStyle(card.color)}>
      {(hasAttachments || isVisibleToExternalUsers) && (
        <div className={`card-tools ${hasAttachments ? 'has-attachments' : 'no-attachments'}`}>
          {isVisibleToExternalUsers && <CardVisibilityIndicator />}
          {hasAttachments && <CardAttachmentsIndicator card={card} />}
        </div>
      )}
      <strong>{card.is_milestone && <MilestoneIndicator />}{card.title}</strong>
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
