import styles from './DepartmentsDashboard.module.css'

const placeholders = [0, 1, 2, 3, 4, 5]

/** Consistent loading skeleton for the three Workspace administration views. */
export function AdministrationLoading({
  section,
}: {
  section: 'departments' | 'teams' | 'clients'
}) {
  const hasMetrics = section !== 'clients'
  const isCards = section === 'departments'
  const label = section === 'departments' ? 'Cargando departamentos'
    : section === 'teams' ? 'Cargando equipos' : 'Cargando clientes'

  return <div className={styles.loadingSurface} role="status" aria-label={label}>
    {hasMetrics && <div className={styles.loadingStats} aria-hidden="true">
      {placeholders.slice(0, 4).map(i => <span key={i}/>)}
    </div>}
    <div className={`${styles.loadingMain} ${!hasMetrics ? styles.loadingNoMetrics : ''}`} aria-hidden="true">
      <div className={styles.loadingToolbar}>
        <span className={styles.loadingSearch}/>
        <span className={styles.loadingControl}/>
        <span className={styles.loadingControl}/>
        <span className={styles.loadingAction}/>
      </div>
      <div className={isCards ? styles.loadingCards : styles.loadingTable}>
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
}
