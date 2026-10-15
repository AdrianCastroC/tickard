import { ProjectContentLoading } from './ProjectContentLoading'
import styles from './ProjectBoardsLoading.module.css'

const CARDS = Array.from({ length: 6 }, (_, i) => i)
const STATES = Array.from({ length: 5 }, (_, i) => i)
const PEOPLE = Array.from({ length: 4 }, (_, i) => i)

export function ProjectBoardsLoading({ count = 6 }: { count?: number }) {
  const visibleCards = Math.min(Math.max(count, 3), CARDS.length)

  return <ProjectContentLoading
    title="Cargando tableros"
    description="Preparando tareas, estados y planificación de los tableros del proyecto…"
  >
    <div className={styles.skeleton}>
      <div className={styles.toolbar}>
        <div className={styles.heading}><i /><i /></div>
        <div className={styles.actions}><i /><i /><i /><i /></div>
      </div>
      <div className={styles.cards}>
        {CARDS.slice(0, visibleCards).map((index) => <div key={index} className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.number} />
            <span className={styles.cardTitle}><i /><i /></span>
          </div>
          <i className={styles.date} />
          <div className={styles.body}>
            <div className={styles.donut}><span /></div>
            <div className={styles.legend}>
              {STATES.map((state) => <i key={state} className={styles.state}
                style={{ width: `${88 - state % 3 * 9}%` }}/>)}
            </div>
          </div>
          <div className={styles.footer}>
            <div className={styles.people}>{PEOPLE.map((person) => <i key={person} />)}</div>
            <i className={styles.updated} />
          </div>
        </div>)}
      </div>
    </div>
  </ProjectContentLoading>
}
