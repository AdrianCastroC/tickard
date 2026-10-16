import type { CSSProperties } from 'react'
import styles from './GlobalViewLoading.module.css'

type Props = {
  title: string
  description: string
  variant: 'home' | 'tasks' | 'inbox'
}

const DOTS = Array.from({ length: 12 }, (_, index) => index)
const ROWS = Array.from({ length: 5 }, (_, index) => index)

export function GlobalViewLoading({ title, description, variant }: Props) {
  return <div className={`${styles.root} ${styles[variant]}`} role="status" aria-live="polite" aria-label={title}>
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.header}>
        <span className={styles.headerTitle}/>
        <span className={styles.headerAction}/>
      </div>
      {variant !== 'inbox' && <div className={styles.stats}>
        {Array.from({ length: 4 }, (_, i) => <div key={i} className={styles.stat}>
          <span/><strong/><small/>
        </div>)}
      </div>}
      <div className={styles.panels}>
        {variant === 'home' ? Array.from({ length: 4 }, (_, i) => <div key={i} className={styles.panel}>
          <span className={styles.panelTitle}/>
          {ROWS.map(j => <span key={j} className={styles.line}/>)}
        </div>) : <div className={styles.panel}>
          <span className={styles.panelTitle}/>
          {Array.from({ length: variant === 'tasks' ? 10 : 7 }, (_, i) => <span key={i} className={styles.line}/>)}
        </div>}
      </div>
    </div>
    <div className={styles.veil} aria-hidden="true"/>
    <div className={styles.message}>
      <div className={styles.dots} aria-hidden="true">
        {DOTS.map(index => <span key={index} className={styles.dotPosition}
          style={{ '--dot-index': index } as CSSProperties}>
          <span className={styles.dot}/>
        </span>)}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  </div>
}
