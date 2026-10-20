import { useState } from 'react'
import type { CardDependencies, CardDependency } from '../../api'
import { LinkIcon } from '../../shared/icons'
import { SectionToggle } from './cardSectionUi'

const typeNames: Record<CardDependency['type'], string> = {
  fs: 'Fin → Inicio',
  ss: 'Inicio → Inicio',
  ff: 'Fin → Fin',
  sf: 'Inicio → Fin',
}

export function CardDependencyList({ dependencies, onOpenCard }: {
  dependencies: CardDependencies
  onOpenCard: (cardId: number, boardId: number, dependencyId: number) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const predecessors = dependencies.predecessors ?? []
  const successors = dependencies.successors ?? []
  if (!predecessors.length && !successors.length) return null

  function renderGroup(title: string, items: CardDependency[]) {
    if (!items.length) return null
    return <div className="card-dependency-group">
      <strong className="card-dependency-group-title">{title} ({items.length})</strong>
      <ul className="card-dependency-list">
        {items.map(item => <li key={item.id}>
          <button type="button" className="card-dependency-card"
            onClick={() => onOpenCard(item.card_id, item.board_id, item.id)}
            title={'Abrir Card: ' + item.title}>
            <span className="card-dependency-card-title">{item.title}</span>
            <span className="card-dependency-card-meta">
              {item.board_name ? item.board_name + ' · ' : ''}{typeNames[item.type]}
              {item.is_done === true ? ' · Completada' : ''}
            </span>
          </button>
        </li>)}
      </ul>
    </div>
  }

  return <section className={`card-modal-section card-dependency-section${collapsed ? ' is-collapsed' : ''}`}>
    <div className="section-head"><h3>
      <SectionToggle icon={<LinkIcon />} label="Dependencias" collapsed={collapsed}
        onToggle={() => setCollapsed(value => !value)}/>
      <button type="button" className="module-section-title-btn" aria-expanded={!collapsed}
        onClick={() => setCollapsed(value => !value)}>
        Dependencias ({predecessors.length + successors.length})
      </button>
    </h3></div>
    {!collapsed && <>
      {renderGroup('Predecesoras', predecessors)}
      {renderGroup('Sucesoras', successors)}
    </>}
  </section>
}
