import styles from './DepartmentsDashboard.module.css'
import { ProjectContentLoading } from '../workspace/ProjectContentLoading'

const placeholders = [0, 1, 2, 3, 4, 5]

/** Reuse the project Gantt loading animation in Workspace administration. */
export function AdministrationLoading({
  section,
}: {
  section: 'departments' | 'teams' | 'clients'
}) {
  const hasMetrics = section !== 'clients'
  const isCards = section === 'departments'
  const title = section === 'departments' ? 'Cargando Departamentos'
    : section === 'teams' ? 'Cargando Equipos' : 'Cargando Clientes'
  const description = section === 'departments'
    ? 'Preparando departamentos y sus asignaciones…'
    : section === 'teams' ? 'Preparando equipos, miembros y proyectos…'
      : 'Preparando clientes y proyectos…'

  return <div className={styles.loadingOverlay}>
    <ProjectContentLoading title={title} description={description}>
      <div className={styles.loadingSurface} data-no-metrics={!hasMetrics}>
    {hasMetrics && <div className={styles.loadingStats} aria-hidden="true">
      {placeholders.slice(0, 4).map(i => <span key={i}/>)}
    </div>}
    <div className={`${styles.loadingMain} ${!hasMetrics ? styles.loadingNoMetrics : ''}`}>
      <div className={styles.loadingToolbar} aria-hidden="true">
        <span className={styles.loadingSearch}/>
        <span className={styles.loadingControl}/>
        <span className={styles.loadingControl}/>
        <span className={styles.loadingAction}/>
      </div>
      <div className={isCards ? styles.loadingCards : styles.loadingTable} aria-hidden="true">
        {placeholders.map(i => <span key={i}/>)}
      </div>
    </div>
    <aside className={`${styles.loadingInspector} ${!hasMetrics ? styles.loadingNoMetrics : ''}`} aria-hidden="true">
      <div className={styles.loadingDetailHeader}>
        <span className={styles.loadingDetailAvatar}/>
        <div><span/><span/></div>
      </div>
      <div className={styles.loadingTabs}>
        {placeholders.slice(0, 4).map(i => <span key={i}/>)}
      </div>
      <div className={styles.loadingDetails}>
        {placeholders.map(i => <span key={i}/>)}
      </div>
    </aside>
      </div>
    </ProjectContentLoading>
  </div>
}
