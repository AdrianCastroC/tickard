type Props = { label: string; floating?: boolean }

export function ProjectLoadingIndicator({ label, floating = false }: Props) {
  return (
    <div
      className={`project-loading-indicator${floating ? ' project-loading-indicator-floating' : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="project-loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
