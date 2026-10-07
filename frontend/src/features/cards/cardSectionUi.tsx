import { type ReactNode } from 'react'
import { CalendarIcon, ChevronIcon } from '../../shared/icons'

export { CalendarIcon }


export function SectionToggle({ icon, label, collapsed, onToggle }: {
  icon: ReactNode
  label: string
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`section-toggle${collapsed ? ' is-collapsed' : ''}`}
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expandir ${label}` : `Colapsar ${label}`}
      title={collapsed ? 'Expandir' : 'Colapsar'}
    >
      <span className="section-toggle-face section-toggle-icon">{icon}</span>
      <span className="section-toggle-face section-toggle-chevron"><ChevronIcon className="section-ico" /></span>
    </button>
  )
}



